import type { Metadata } from "next";
import type { ReactNode } from "react";
import CenovnikFooter from "../cenovnik/CenovnikFooter";
import { OG_BASE, SITE_URL } from "@/lib/seo";
import { LOCATIONS, fullAddress } from "@/lib/locations";

const PAGE_URL = `${SITE_URL}/uslovi-koriscenja`;
const LAST_UPDATED = "30. septembar 2026.";
const EMAIL = "ana.infinitystudio@gmail.com";

/** Registered business details (APR), required on the site by law. */
const COMPANY_NAME = "Dragan Kasap PR Kozmetički studio INFINITY 2024 Sombor";
const COMPANY_SEAT = "J.N.A 30, 25101 Sombor, Srbija";
const COMPANY: [string, string][] = [
  ["Naziv", COMPANY_NAME],
  ["Sedište", COMPANY_SEAT],
  ["PIB", "114648234"],
  ["Matični broj", "67744845"],
  ["Delatnost", "9602 - Delatnost frizerskih i kozmetičkih salona"],
];

export const metadata: Metadata = {
  title: "Uslovi korišćenja i politika privatnosti",
  description:
    "Uslovi korišćenja sajta Infinity Laser Studio i politika privatnosti: zakazivanje i otkazivanje termina, cene, zdravstveni uslovi i zaštita podataka.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    ...OG_BASE,
    title: "Uslovi korišćenja i politika privatnosti | Infinity Laser Studio",
    description:
      "Uslovi korišćenja sajta Infinity Laser Studio i politika privatnosti: zakazivanje i otkazivanje termina, cene, zdravstveni uslovi i zaštita podataka.",
    url: PAGE_URL,
  },
};

const link = "text-accent underline underline-offset-4 hover:text-accent-soft transition-colors";

type Section = { title: string; body: ReactNode };

const termsSections: Section[] = [
  {
    title: "Opšte odredbe",
    body: (
      <>
        <p>
          Ova stranica ima dva dela. Uslovi korišćenja uređuju korišćenje sajta
          infinitylaserstudio.com i zakazivanje termina u studijima Infinity Laser Studio (
          {LOCATIONS.map(fullAddress).join(" i ")}). Politika privatnosti objašnjava kako
          postupamo sa Vašim podacima.
        </p>
        <p>Sajt i studije vodi:</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl border border-foreground/10 p-4 sm:p-5">
          {COMPANY.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-foreground/50">{label}</dt>
              <dd className="text-foreground/80">{value}</dd>
            </div>
          ))}
        </dl>
        <p>
          Korišćenjem sajta i zakazivanjem termina potvrđujete da ste uslove pročitali i da ih
          prihvatate.
        </p>
        <p>
          Uslove možemo povremeno izmeniti. Važeća verzija je uvek objavljena na ovoj stranici, sa
          datumom poslednje izmene. Za već zakazan termin važe uslovi koji su bili objavljeni u
          trenutku zakazivanja.
        </p>
      </>
    ),
  },
  {
    title: "Informacije na sajtu",
    body: (
      <>
        <p>
          Sadržaj sajta je informativnog karaktera i ne predstavlja medicinski savet, dijagnozu
          niti zamenu za pregled kod lekara.
        </p>
        <p>
          Rezultati laserske epilacije zavise od tipa kože i dlake, hormonskog statusa i
          redovnosti tretmana, pa se razlikuju od osobe do osobe. Broj tretmana koji navodimo na
          sajtu je prosek, pa Vama može biti potrebno više ili manje tretmana. Zato ne možemo
          da garantujemo isti rezultat za svakoga.
        </p>
      </>
    ),
  },
  {
    title: "Zakazivanje termina",
    body: (
      <>
        <p>
          Termin zakazujete preko forme na sajtu ili telefonom. Dužni ste da unesete tačne
          podatke, kako bismo mogli da Vas kontaktiramo.
        </p>
        <p>
          Termin je zakazan kada se na sajtu prikaže poruka da je zakazivanje uspelo. Potvrdu
          šaljemo i na email. Ako ne stigne, proverite neželjenu poštu ili nas kontaktirajte.
        </p>
        <p>
          U izuzetnim slučajevima (kvar uređaja, bolest osoblja, viša sila) možemo pomeriti ili
          otkazati termin. O tome ćemo Vas obavestiti što pre i ponuditi novi termin.
        </p>
      </>
    ),
  },
  {
    title: "Otkazivanje i pomeranje termina",
    body: (
      <>
        <p>
          Termin možete besplatno otkazati ili pomeriti najkasnije 24 sata pre tretmana,
          telefonom ili odgovorom na email sa potvrdom.
        </p>
        <p>
          Ako termin otkažete u poslednja 24 sata bez opravdanog razloga ili se ne pojavite,
          naplaćuje se 50% cene tretmana pri sledećem zakazivanju.
        </p>
        <p>
          Bolest, povreda ili hitan slučaj se ne naplaćuju. Dovoljno je da nas obavestite i
          naći ćemo novi termin.
        </p>
      </>
    ),
  },
  {
    title: "Cene i plaćanje",
    body: (
      <>
        <p>
          Cene su izražene u dinarima (RSD) i nalaze se na stranici{" "}
          <a href="/cenovnik" className={link}>
            Cenovnik
          </a>
          . Zadržavamo pravo izmene cena i ponude, a za već zakazan termin važi cena iz potvrde
          termina.
        </p>
        <p>
          Plaćanje se ne vrši preko sajta, već u studiju. Paket tretmana plaća se u celosti na
          prvom tretmanu.
        </p>
        <p>
          Popusti i akcije važe pod uslovima koji su navedeni uz ponudu, ne sabiraju se i ne mogu
          se zameniti za novac. Studentski popust važi samo uz indeks pokazan u studiju.
        </p>
      </>
    ),
  },
  {
    title: "Ko može na tretman",
    body: (
      <>
        <p>
          Tretman se ne radi trudnicama, dojiljama, osobama koje boluju od malignih bolesti i
          progresivnih neuroloških oboljenja. Oprez je potreban kod dijabetesa, proširenih vena,
          psorijaze i epilepsije.
        </p>
        <p>
          Tretman radimo osobama starijim od 15 godina. Maloletnim licima potrebna je saglasnost
          roditelja ili staratelja i prethodna konsultacija sa doktorkom.
        </p>
        <p>
          Pre tretmana ste dužni da nam date tačne podatke o zdravstvenom stanju, terapiji koju
          koristite i skorašnjem izlaganju suncu. Na osnovu konsultacija možemo odložiti ili
          odbiti tretman ako procenimo da za Vas nije bezbedan.
        </p>
        <p>
          Ne odgovaramo za posledice nastale zbog netačnih ili prećutanih podataka, niti zbog
          nepoštovanja uputstava datih pre i posle tretmana.
        </p>
      </>
    ),
  },
  {
    title: "Autorska prava",
    body: (
      <p>
        Tekstovi, fotografije, video snimci, logo i dizajn sajta vlasništvo su Infinity Laser
        Studija. Nije dozvoljeno njihovo kopiranje ni korišćenje bez naše pisane saglasnosti.
      </p>
    ),
  },
  {
    title: "Odgovornost",
    body: (
      <>
        <p>
          Trudimo se da podaci na sajtu budu tačni i da sajt radi bez prekida, ali to ne možemo
          da garantujemo. Ne odgovaramo za sadržaj spoljnih sajtova do kojih vode linkovi.
        </p>
        <p>
          Ništa u ovim uslovima ne ograničava prava koja imate po Zakonu o zaštiti potrošača i
          drugim propisima Republike Srbije.
        </p>
      </>
    ),
  },
  {
    title: "Reklamacije i sporovi",
    body: (
      <>
        <p>
          Reklamaciju možete podneti na email ili telefon iz tačke Kontakt, a odgovorićemo u roku
          od 8 dana. Kao potrošač imate pravo i na vansudsko rešavanje spora pred telom sa liste
          ministarstva nadležnog za trgovinu.
        </p>
        <p>
          Na ove uslove primenjuje se pravo Republike Srbije. Sporove ćemo pokušati da rešimo
          dogovorom, a ako to nije moguće, nadležan je sud u Somboru, osim ako zakon za
          potrošače ne predviđa drugačije.
        </p>
      </>
    ),
  },
  {
    title: "Kontakt",
    body: (
      <p>
        Za sva pitanja pišite nam na{" "}
        <a href={`mailto:${EMAIL}`} className={link}>
          {EMAIL}
        </a>{" "}
        ili pozovite{" "}
        <a href="tel:+381653738991" className={link}>
          065 373 8991
        </a>{" "}
        ili{" "}
        <a href="tel:+381677747301" className={link}>
          067 774 7301
        </a>
        .
      </p>
    ),
  },
];

const list = "list-disc pl-5 flex flex-col gap-2";

const privacySections: Section[] = [
  {
    title: "Ko obrađuje podatke",
    body: (
      <p>
        Rukovalac podacima je {COMPANY_NAME}, {COMPANY_SEAT}. Za sva pitanja o podacima pišite
        na{" "}
        <a href={`mailto:${EMAIL}`} className={link}>
          {EMAIL}
        </a>
        .
      </p>
    ),
  },
  {
    title: "Koje podatke prikupljamo i zašto",
    body: (
      <>
        <p>
          Pri zakazivanju prikupljamo ime i prezime, email adresu, broj telefona, izabrane
          tretmane, studio i termin. Bez ovih podataka ne možemo da zakažemo termin. Koristimo ih
          za zakazivanje, potvrdu i organizaciju termina i za komunikaciju sa Vama u vezi sa
          terminom.
        </p>
        <p>
          Zdravstvenu napomenu upisujete dobrovoljno. Koristimo je isključivo da procenimo da li
          je tretman bezbedan za Vas.
        </p>
        <p>Vaše podatke ne prodajemo.</p>
      </>
    ),
  },
  {
    title: "Kolačići, analitika i oglašavanje",
    body: (
      <>
        <p>Sajt koristi sledeće alate:</p>
        <ul className={list}>
          <li>Vercel Analytics meri posećenost sajta, bez kolačića.</li>
          <li>
            Microsoft Clarity beleži kako se sajt koristi (klikove, skrolovanje, kretanje po
            stranici). Polja u koja unosite lične podatke su u tim snimcima sakrivena.
          </li>
          <li>
            Meta Pixel meri uspešnost naših oglasa na Facebooku i Instagramu. Kompanija Meta
            dobija podatke o poseti (IP adresu, podatke o pregledaču, kolačiće), a kada zakažete
            termin i vrednost rezervacije i heširan, nečitljiv oblik Vaše email adrese i broja
            telefona.
          </li>
          <li>Wistia prikazuje video na početnoj strani i beleži njegovo gledanje.</li>
        </ul>
        <p>Kolačiće možete obrisati ili blokirati u podešavanjima svog pregledača.</p>
      </>
    ),
  },
  {
    title: "Ko ima pristup podacima",
    body: (
      <p>
        Podatke o terminima vide samo zaposleni kojima su potrebni za rad. Tehnički ih za nas
        obrađuju Supabase (baza podataka), Vercel (hosting sajta) i Resend (slanje email
        potvrda), kao i Meta, Microsoft i Wistia kroz alate iz prethodne tačke. Neki od njih
        čuvaju podatke na serverima van Srbije.
      </p>
    ),
  },
  {
    title: "Koliko dugo čuvamo podatke",
    body: (
      <p>
        Podatke o terminima čuvamo dok ste naš klijent i onoliko koliko nas propisi obavezuju. Na
        Vaš zahtev brišemo ih i ranije, osim podataka koje po zakonu moramo da čuvamo.
      </p>
    ),
  },
  {
    title: "Vaša prava",
    body: (
      <>
        <p>U skladu sa Zakonom o zaštiti podataka o ličnosti imate pravo da:</p>
        <ul className={list}>
          <li>dobijete uvid u svoje podatke i njihovu kopiju,</li>
          <li>tražite ispravku ili brisanje podataka,</li>
          <li>tražite ograničenje obrade ili joj prigovorite,</li>
          <li>tražite prenos podataka,</li>
          <li>opozovete pristanak koji ste dali.</li>
        </ul>
        <p>
          Zahtev pošaljite na{" "}
          <a href={`mailto:${EMAIL}`} className={link}>
            {EMAIL}
          </a>
          . Odgovorićemo najkasnije u roku od 30 dana. Imate pravo i na pritužbu Povereniku za
          informacije od javnog značaja i zaštitu podataka o ličnosti.
        </p>
      </>
    ),
  },
];

/** Both documents live on this one page; the footer links to each part by id. */
const parts: { id: string; title: string; sections: Section[] }[] = [
  { id: "uslovi", title: "Uslovi korišćenja", sections: termsSections },
  { id: "privatnost", title: "Politika privatnosti", sections: privacySections },
];

export default function UsloviKoriscenjaPage() {
  return (
    <main>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <section className="bg-surface pt-32 pb-20 px-6 text-center relative overflow-hidden">
        <div
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "var(--accent)" }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "var(--accent-deep)" }}
        />

        <div className="relative max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/50 mb-6">
            <span className="w-6 h-px bg-accent inline-block" />
            Infinity Laser Studio
          </span>

          <h1 className="font-playfair text-4xl sm:text-6xl text-foreground mb-4 leading-tight">
            Pravila i uslovi
          </h1>

          <p className="font-poppins text-base text-foreground/60">
            Poslednja izmena: {LAST_UPDATED}
          </p>

          <div
            className="mx-auto mt-8 h-px w-32 rounded-full"
            style={{
              background:
                "linear-gradient(to right, transparent, var(--accent), transparent)",
            }}
          />

          <nav
            aria-label="Delovi stranice"
            className="mt-8 flex flex-wrap justify-center gap-3 font-poppins text-sm"
          >
            {parts.map((p, i) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="rounded-full border border-foreground/15 px-5 py-2.5 text-foreground/70 hover:border-accent hover:text-foreground transition-colors"
              >
                <span className="text-accent mr-1.5">{i + 1}.</span>
                {p.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {parts.map((part, p) => (
        <section
          key={part.id}
          id={part.id}
          className={`scroll-mt-20 py-16 sm:py-20 px-6 ${p % 2 === 0 ? "bg-background-alt" : "bg-surface"}`}
        >
          <div className="max-w-3xl mx-auto">
            <header className="mb-12 border-b border-foreground/10 pb-8">
              <span className="inline-flex items-center gap-2 font-poppins text-sm text-foreground/50 mb-3">
                <span className="w-6 h-px bg-accent inline-block" />
                Deo {p + 1} od {parts.length}
              </span>
              <h2 className="font-playfair text-3xl sm:text-5xl text-foreground leading-tight">
                {part.title}
              </h2>
            </header>

            <div className="flex flex-col gap-10">
              {part.sections.map((s, i) => (
                <article key={s.title}>
                  <h3 className="font-playfair text-2xl sm:text-3xl text-foreground mb-4">
                    <span className="text-accent mr-2">{i + 1}.</span>
                    {s.title}
                  </h3>
                  <div className="flex flex-col gap-3 font-poppins text-sm sm:text-base text-foreground/70 leading-relaxed">
                    {s.body}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <CenovnikFooter />
    </main>
  );
}
