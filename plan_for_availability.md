# Plan: Upravljanje radnim vremenom (otvaranje/zatvaranje termina) iz admin panela

## Cilj
Prebaciti raspored dostupnosti iz koda (`SPECIAL_AVAILABILITY` u `lib/supabase.ts`) u Supabase
i dodati UI u `/admin`, tako da se termini otvaraju/zatvaraju klikom — bez editovanja koda i deploy-a.

Model u dva sloja:
1. **Nedeljni šablon** — default sati po danu u nedelji, podese se jednom.
2. **Izuzeci po datumu** — odstupanja od šablona (kao ceo jul), jedan klik po danu.

Pravilo razrešavanja za datum D: `izuzetak ako postoji, inače nedeljni šablon`.

---

## Trenutno stanje (zašto je komplikovano)
- Javni booking: `BookingModal.tsx` čita `SPECIAL_AVAILABILITY` (statična mapa) + `getBusinessWindows()`.
- Admin rezervacija: `AdminReservationModal.tsx` čita `getAdminBusinessWindows()` → `ADMIN_WEEKLY_SCHEDULE`.
- Dakle **dva odvojena izvora istine** za radno vreme, oba u kodu.
- Zauzeti termini se već računaju iz `reservations` tabele i automatski izbacuju — to ostaje netaknuto.

Posledica plana: **jedan izvor istine** (baza) za oba potrošača.

---

## 1. Baza (Supabase)

### Tabela `weekly_schedule` (nedeljni šablon — 7 redova)
| kolona     | tip       | napomena                                            |
|------------|-----------|-----------------------------------------------------|
| `weekday`  | smallint PK | 0=Ponedeljak … 6=Nedelja (Monday-index, kao u kodu) |
| `windows`  | jsonb     | niz `{ "start": <min>, "end": <min> }`; `[]` = zatvoreno |

`start`/`end` su minuti od ponoći (npr. 13:00 = 780) — isti format kao postojeći `BusinessWindow`,
tako da front-end logika (`getAvailableSlots`) ostaje nepromenjena.

### Tabela `availability_overrides` (izuzeci po datumu)
| kolona       | tip         | napomena                                           |
|--------------|-------------|----------------------------------------------------|
| `date`       | date PK     | jedan red po danu-izuzetku                          |
| `windows`    | jsonb       | niz `{start,end}`; **`[]` = izričito zatvoreno**    |
| `updated_at` | timestamptz | default now()                                       |

Ključna razlika:
- **Nema reda** za datum → koristi se nedeljni šablon.
- **Postoji red sa `[]`** → dan je izričito zatvoren (npr. zatvaramo dan koji je inače otvoren).
- **Postoji red sa prozorima** → ti prozori zamenjuju šablon za taj dan.

### RLS
- `anon` READ na obe tabele (booking modal radi client-side sa anon ključem).
- WRITE: vidi „Bezbednost" dole.

### Seed / migracija postojećih podataka (jednokratno)
1. `weekly_schedule` se popuni iz trenutnog `ADMIN_WEEKLY_SCHEDULE`:
   - Pon 15–20, Uto 15–20, Sre 15–20, Čet 13–18, Pet 10–15, Sub 10–17, Ned zatvoreno.
   - (Po želji odmah podesimo „pravi" tvoj uobičajeni šablon.)
2. `availability_overrides` se popuni iz **svih** datuma trenutno u `SPECIAL_AVAILABILITY`
   (ceo april–jul raspored). Tako se ponašanje sajta ne menja ni za jedan postojeći dan,
   a budući dani (avgust+) počinju da prate šablon.

---

## 2. Kod — čitanje dostupnosti

### Novi modul `lib/availability.ts`
- `type BusinessWindow = { start: number; end: number }` (premešten iz `supabase.ts`).
- `resolveWindows(dateStr, template, overridesMap): BusinessWindow[] | null`
  - override postoji → `override.windows` (prazno ⇒ `null` = zatvoreno)
  - inače → `template[weekday]` (prazno ⇒ `null`)
- `buildCandidateDates(horizonDays, template, overridesMap)` → lista budućih datuma
  koji imaju bar jedan prozor (zamena za `Object.keys(SPECIAL_AVAILABILITY)`).
- `fetchAvailability()` → učita 7 redova `weekly_schedule` + `availability_overrides`
  za horizont (`date >= danas` i `<= danas + N`).

### `BookingModal.tsx` (izmene)
- Ukloniti import `SPECIAL_AVAILABILITY` / `getBusinessWindows`.
- Pri otvaranju modala (ili na ulasku u korak 3) jednom `fetchAvailability()` → u state.
- `buildDayOptions` koristi `buildCandidateDates(horizon)` umesto fiksne mape.
  - **Odluka:** horizont vidljivosti, npr. **60 dana** unapred (ranije ga je mapa prirodno ograničavala).
- `windows` za izabrani datum se računa iz state-a (`resolveWindows`), bez novog upita.

### `AdminReservationModal.tsx` (izmene)
- Zameniti `getAdminBusinessWindows()` istim `resolveWindows()` izvorom.
- Time admin i javni sajt dele **isti** raspored (kraj duplikata).

> Napomena: `getBusinessWindows`/`getAdminBusinessWindows`/`SPECIAL_AVAILABILITY`/`ADMIN_WEEKLY_SCHEDULE`
> se brišu iz `lib/supabase.ts` nakon migracije. Potrošača ima samo 2 — refaktor je lokalizovan.

---

## 3. Admin UI (`/admin`)

### A. Editor nedeljnog šablona
- Nova sekcija/tab „Radno vreme".
- 7 redova (Pon–Ned), svaki sa:
  - čip-prikaz prozora (npr. `13–18`, `19–21`)
  - preseti-dugmići: `10–15`, `13–18`, `13–20`, `15–20`, `10–21`, `Zatvoreno`
  - custom „od–do" unos + „dodaj prozor" (za dane sa dva termina)
- Snimi → upsert u `weekly_schedule`.

### B. Izuzeci po danu (iz kalendara)
- Klik na zaglavlje dana (ili „uredi" ikonicu) → mali popover/modal:
  - prikaže efektivne sate (iz override-a ili šablona)
  - isti preseti + custom + „Dodaj drugi prozor"
  - `Zatvoreno` → upiše override sa `[]`
  - `Vrati na default` → obriše override red
- Snimi → upsert/delete u `availability_overrides`, pa refetch kalendara.

### C. Vizuelni prikaz na kalendaru
- Otvoreni prozori se crtaju kao svetla pozadinska traka u koloni dana
  (grid već mapira minute→px preko `toTop`/`toHeight`).
- **Odluka/posledica:** grid je sada zakucan na 10:00–19:00 (`BIZ_START=10*60`, 10 labela).
  Pošto raspon ide i 9:00–21:00, grid treba proširiti (npr. **8:00–22:00**) da bi se svi
  termini i trake videli. Mala ali realna izmena u `app/admin/page.tsx`.

---

## 4. Bezbednost (treba odluka)
Trenutno je admin „lozinka" samo client-side (`NEXT_PUBLIC_ADMIN_PASSWORD`), a upisi idu anon ključem
(isto kao rezervacije danas). Ako availability upisi idu istim putem, tehnički bi bilo ko preko API-ja
mogao da menja sate.
- **Opcija 1 (konzistentno sa sadašnjim):** anon upisi — najbrže, ali slabo obezbeđeno.
- **Opcija 2 (preporuka za kasnije):** upisi kroz server route sa service-role ključem + provera lozinke.
  Van obima ovog plana osim ako ne želiš da uđe odmah.

---

## 5. Faze isporuke
1. **Baza:** tabele `weekly_schedule` + `availability_overrides`, RLS, seed migracija iz postojeće mape.
2. **Čitanje:** `lib/availability.ts`; refaktor `BookingModal` da čita iz baze. (Sajt radi isto kao sad.)
3. **Admin čitanje:** `AdminReservationModal` na isti izvor (uklanjanje duplikata).
4. **Admin UI:** editor nedeljnog šablona + izuzeci po danu.
5. **Vizuelno:** traka radnog vremena na kalendaru + proširenje raspona grida (8–22h).
6. **QA:** provera da zauzeti termini ostaju skriveni, da „Zatvoreno" i „Vrati na default" rade,
   da horizont i današnji 2h-rok i dalje važe.

## Otvorene odluke (pre starta)
- Horizont vidljivosti na sajtu: **60 dana** (predlog) — ok?
- Početni nedeljni šablon: preuzeti postojeći `ADMIN_WEEKLY_SCHEDULE` ili odmah uneti tvoj pravi?
- Bezbednost upisa: Opcija 1 sada, Opcija 2 sada, ili Opcija 2 kasnije?
- Raspon grida na admin kalendaru: 8:00–22:00 dovoljno?
