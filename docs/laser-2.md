# Laser 2 u Novom Sadu – šta se promenilo

Datum: 13. 11. 2026.

## Ukratko

Svaki laser ima **svoje termine i svoje radno vreme**. Novi Sad ima dva lasera (**Stari** i **Novi**), Sombor jedan.

- Svaki termin pripada jednom laseru.
- Svaki laser ima svoj nedeljni šablon radnog vremena i svoje izuzetke po datumu.
- Na sajtu je vreme slobodno ako bar jedan laser **radi u to vreme** i nema termin. Klijent vidi 13:00 samo jednom.
  Vreme nestaje tek kada nijedan laser koji tada radi nije slobodan.
- Termin sa sajta ide na prvi takav laser, Stari pre Novog.

Primer: Stari radi 9–15, Novi 14–20. U 10:00 nudi se samo Stari, u 14:00 oba, a u 18:00 samo Novi.

## Šta je novo u bazi

| Šta | Vrsta | Čemu služi |
|---|---|---|
| `lasers` | nova tabela | Spisak lasera po studiju: broj (1, 2), ime (Stari, Novi) i `active_from`, prvi dan od kog laser prima termine |
| `reservations.laser` | nova kolona | Na kom laseru je termin |
| `weekly_schedule.laser` | nova kolona | Nedeljno radno vreme je po laseru |
| `availability_overrides.laser` | nova kolona | Izuzeci po datumu su po laseru |
| `free_laser()` | nova funkcija | Jedino pravilo za „ima li mesta": laser koji tada radi i nema termin |
| `admin_set_laser()` | nova funkcija | Prebacuje termin na drugi laser (isti dan i vreme) |
| `public_busy_slots` | izmenjena | Vraća i laser svakog termina |
| `public_create_booking` | izmenjena | Rezervacija sa sajta: radno vreme i zauzetost proverava za svaki laser posebno |
| `admin_create_booking` | izmenjena | Admin i dalje može da zakaže i van radnog vremena. Prvo bira laser koji tada radi, i to onaj koji je otvoren u adminu |
| `admin_move_reservation` | izmenjena | Pomeranje: prvo laser koji tada radi, svoj pre drugog |

Postojeći termini i postojeće radno vreme pripadaju Laseru 1 (Stari), pa se za Stari ništa ne menja.
Ništa nije obrisano. Zaključavanje po danu ostaje, pa dve osobe i dalje ne mogu da dobiju isti laser u isto vreme.

## Šta je novo u adminu

- **Prekidač Stari | Novi** (pored Novi Sad | Sombor) na kalendaru i u **Radno vreme**, samo za Novi Sad.
- **Kalendar** prikazuje termine i radno vreme jednog lasera.
- **Radno vreme**: nedeljni šablon se upisuje za laser koji je izabran. „Ko radi" važi za ceo studio.
- **Prozor za dan** (klik na dan): radno vreme tog lasera za taj datum. Novi ne radi tog dana = izuzetak „zatvoreno" dok je izabran Novi.
- **Novi termin**: admin i dalje može da zakaže i van radnog vremena. Termin ide prvo na laser koji tada radi, a od takvih na onaj koji je otvoren.
  Ekran uspeha kaže na koji laser je termin upisan.
- **Detalji termina → Laser**: dugme za prebacivanje na drugi laser (isti dan i vreme, klijent ne dobija mejl).
- **Pomeri termin**: piše ako termin prelazi na drugi laser.
- Infy (asistent) računa slobodne termine i popunjenost po laserima, svaki u svom radnom vremenu. Zna da Novi Sad ima Stari i Novi: kaže na kom je laseru termin i radno vreme svakog lasera, rupe u pregledu su po laseru, a papir piše laser („Novi Sad · Novi laser“). Na traženi laser zakazuje i pomera („na Novom“), a „prebaci Anu na Novi“ prebacuje termin na drugi laser u isto vreme, bez mejla klijentu. Bez traženog lasera bira server: laser koji tada radi, Stari pre Novog.
- Pozivi, Klijenti, Finansije, Statistike i Kartoni rade kao i do sada, za ceo studio.

## Redosled puštanja (live se ne dira do tvog „može")

1. **`sql/lasers_phase1.sql`**, pre deploy-a. Posle njega postoji samo Laser 1, a sve postojeće radno vreme i svi termini su njegovi, pa live sajt i admin rade potpuno isto.
   Ako je tekst live funkcija drugačiji od očekivanog, fajl staje i ništa ne menja. Može da se pokrene više puta.
2. **Deploy koda** (Vercel). Admin i Infy traže korak 1. Javni sajt radi i bez njega, kao jedan laser.
3. **`sql/lasers_phase2.sql`**, posle deploy-a. Menja ključeve tabela radnog vremena, da Novi može da ima svoje, i dodaje Novi laser sa datumom `active_from`. Datum upisuješ u fajl.
4. **Admin → Radno vreme → Novi**: upišeš radno vreme Novog lasera. Pre toga Novi je zatvoren svaki dan.

Korak 3 ne sme pre deploy-a: stari admin čuva radno vreme po starim ključevima.

Provera posle koraka 1: `select * from public.lasers;` treba da vrati dva reda (novi_sad 1 Stari, sombor 1 Laser).

## Kako da se vrati na jedan laser

Najlakše je da Novom obrišeš radno vreme u adminu. Drugi način:
`update public.lasers set active_from = date '2099-01-01' where location = 'novi_sad' and laser = 2;`
Termini koji su već na Novom ostaju, pa ih prebaci ručno.
