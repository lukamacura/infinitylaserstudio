import type { CSSProperties } from "react";
import Image from "next/image";
import { ArrowUpRight, Sparkles, Star } from "lucide-react";
import ReviewsCarousel from "./ReviewsCarousel";

// Ažurirati povremeno prema stvarnom stanju na Google profilu.
// Poslednja provera: 20.07.2026.
const GOOGLE_RATING = "5.0";

// Otvara Google panel sa recenzijama direktno (#lrd = local reviews dialog).
// ludocid / lrd koriste isti feature ID kao embed mape u lib/locations.ts.
const GOOGLE_REVIEWS_URL =
  "https://www.google.com/search?q=Infinity+Laser+Studio+Novi+Sad&ludocid=13466329434848326391#lrd=0x475b116b6f148971:0xbae20345f88572f7,1";

// Klijentkinjin video sa Instagrama. Naslovna slika je sačuvana lokalno
// (Instagram CDN linkovi ističu), a klik vodi na objavu.
const REEL_URL = "https://www.instagram.com/p/Dc3FRfQN-kX/";
const REEL_COVER = "/ugc/reel-cover.jpg";

// Posters live in /public/regije/zene/<slug>.webp
const REGION_SLUGS = ["celo-telo", "noge", "intima", "pazuh", "ruke", "nausnice", "brada", "celo-lice", "pola-nogu", "pola-ruku"];

const regions = REGION_SLUGS.map((slug) => ({
  src: `/regije/zene/${slug}.webp`,
  alt: slug.replace(/-/g, " "),
}));

const testimonials = [
  {
    name: "Jana Marković",
    quote:
      "Divno iskustvo, prezadovoljna sam, epilacija me uopšte nije bolela, sve je na vrhunskom nivou i profesionalno, sve vam se lepo objasni šta i kako. Devojka koja radi je toliko fina i prijatna i profesionalna. 🩷",
  },
  {
    name: "Radmila Uzelac",
    quote:
      "Sve pohvale i preporuke! Nasmejani, ljubazni, profesionalni! ❤️ Rezultati vidljivi nakon prvog tretmana! 😍",
  },
  {
    name: "Vanja Kekić",
    quote:
      "Ako želite profesionalnu uslugu s kojom ćete biti veoma zadovoljni, ovo je pravo mesto za vas. Rezultati su vidljivi i nakon prvog tretmana laserske epilacije. Stručan i veoma ljubazan tim mladih ljudi koji besprekorno brine o vašoj lepoti!",
  },
  {
    name: "Julija Đilasov",
    quote:
      "Drage dame, zadovoljstvo mi je što sam vas upoznala, vaša stručnost i kompletan tretman su za svaku pohvalu. Želim vam mnogo uspeha sa novim idejama. Vidimo se u septembru!",
  },
];

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C2.9 17.3 2 20.5 2 24s.9 6.7 2.5 9.9l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
    </svg>
  );
}

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" />
    </svg>
  );
}

function Stars({ size = "w-4 h-4" }: { size?: string }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label="5 od 5 zvezdica">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`${size} text-yellow-400`} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      ))}
    </div>
  );
}

function step(i: number): CSSProperties {
  return { "--rv-i": i } as CSSProperties;
}

const card = "relative overflow-hidden rounded-3xl border border-foreground/10 bg-surface";

export default function StatsSection() {
  return (
    <section className="section-y px-6 bg-background-alt">
      {/* Heading */}
      <div data-rv className="max-w-6xl mx-auto text-center section-head">
        <h2 className="font-playfair text-title sm:text-[2.75rem] md:text-[3.25rem] text-foreground leading-[1.15]">
          Rezultati koji{" "}
          <span className="text-rose">ostaju na koži</span>
        </h2>
      </div>

      {/* Bento: studio, numbers, zones and a client's video */}
      <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-12 lg:grid-rows-[auto_auto] gap-4">
        {/* 5 godina - the studio itself */}
        <div data-rv="zoom" className={`${card} col-span-2 lg:col-span-5 min-h-[22rem] lg:min-h-[21rem] flex flex-col justify-end p-6`}>
          <Image
            src="/hero/phone.webp"
            alt="Enterijer Infinity Laser Studija"
            fill
            sizes="(min-width: 1024px) 450px, 92vw"
            // Same quality as the hero, so phones reuse the hero's download.
            quality={70}
            className="object-cover object-[50%_55%]"
          />
          <div className="absolute inset-0 bg-linear-to-t from-surface from-20% via-surface/75 via-42% to-transparent to-65%" />

          <span className="absolute top-5 right-5 inline-flex items-center rounded-full border border-foreground/15 bg-background/60 px-3 py-1 font-poppins text-[11px] font-semibold tracking-[0.18em] text-accent uppercase backdrop-blur-sm">
            Od 2021.
          </span>

          <div className="relative">
            <p className="font-playfair text-[1.75rem] sm:text-3xl text-foreground">5 godina postojanja</p>
            <p className="font-poppins text-copy text-foreground/70 mt-1.5 max-w-sm">
              Infinity Laser Studio je od 2021. prvi izbor za lasersku epilaciju u regionu.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <Stars />
            </div>
          </div>
        </div>

        {/* 5/5 on Google */}
        <div data-rv="zoom" style={step(1)} className={`${card} notes-body col-span-1 lg:col-span-3 flex flex-col p-5 sm:p-6`}>
          {/* The studio's Google profile, edge to edge and uncropped - the box keeps the image's own ratio */}
          <div className="relative -mx-5 -mt-5 sm:-mx-6 sm:-mt-6 aspect-[634/570]">
            <Image
              src="/services/google-profil.webp"
              alt="Infinity Laser Studio na Google-u: ocena 5.0 i 102 recenzije"
              fill
              sizes="(min-width: 1024px) 280px, 46vw"
              className="object-cover"
            />
            {/* Only the empty strip under the text melts into the card */}
            <div className="absolute inset-x-0 bottom-0 h-[10%] bg-linear-to-t from-surface to-transparent" />
            {/* Rating and review count circled in red pen, same stroke as the calculator's total */}
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 634 570" fill="none" preserveAspectRatio="none" aria-hidden>
              <path
                className="notes-draw"
                style={{ "--w": 1.5 } as CSSProperties}
                pathLength={1}
                d="M64 417 C178 405 386 405 469 419 C526 430 511 456 386 465 C243 473 53 467 17 446 C-14 425 100 408 308 411"
                stroke="#C8405B"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <p className="metal-text mt-auto pt-2 font-playfair text-[2.5rem] sm:text-6xl leading-none">5.0</p>
          <p className="font-poppins text-sm font-semibold text-foreground/85 mt-4">prosečna ocena</p>
        </div>

        {/* 70-90% */}
        <div data-rv="zoom" style={step(2)} className={`${card} col-span-1 lg:col-span-3 flex flex-col p-5 sm:p-6`}>
          <Image
            src="/services/dlacice.webp"
            alt="Laserska epilacija nogu u Infinity Laser Studiju"
            fill
            sizes="(min-width: 1024px) 520px, 90vw"
            className="object-cover object-[56%_50%]"
          />
          <div className="absolute inset-0 bg-linear-to-t from-surface from-30% via-surface/80 via-52% to-transparent to-80%" />

          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-background/60 text-accent backdrop-blur-sm">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="metal-text relative mt-auto pt-10 font-playfair text-[2rem] sm:text-5xl leading-none whitespace-nowrap">70-90%</p>
          {/* The range, drawn: solid up to 70, lighter up to 90 */}
          <div className="relative mt-4 h-1.5 rounded-full bg-foreground/10 overflow-hidden" aria-hidden="true">
            <span className="absolute inset-y-0 left-0 w-[90%] rounded-full bg-accent/35" />
            <span className="metal absolute inset-y-0 left-0 w-[70%] rounded-full" />
          </div>
          <p className="relative font-poppins text-sm font-semibold text-foreground/85 mt-4">Dlačica</p>
          <p className="relative font-poppins text-meta text-foreground/60 mt-0.5">uklonjeno zauvek</p>
        </div>

        {/* 20+ zona - the region posters drift past */}
        <div data-rv="zoom" style={step(3)} className={`${card} col-span-2 lg:col-span-5 flex flex-col justify-between gap-4 py-5`}>
          <div className="flex items-center gap-5 px-6">
            <p className="metal-text font-playfair text-5xl sm:text-6xl leading-none">20+</p>
            <div className="border-l-2 border-rose pl-5">
              <p className="font-poppins text-sm font-semibold text-foreground/85">Zona tretmana</p>
              <p className="font-poppins text-meta text-foreground/60 mt-0.5">za svaki deo tela, za žene i muškarce</p>
            </div>
          </div>

          <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="region-marquee">
              {/* Second copy only feeds the loop - hidden from assistive tech */}
              {[0, 1].map((copy) => (
                <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 gap-3 pr-3">
                  {regions.map((r) => (
                    <li key={r.src} className="w-32 sm:w-36 aspect-square shrink-0 rounded-full border-2 border-accent p-1">
                      <div className="relative h-full w-full overflow-hidden rounded-full">
                        <Image src={r.src} alt={copy === 0 ? r.alt : ""} fill sizes="144px" className="object-cover" />
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>

        {/* Client video - opens the post on Instagram */}
        <a
          data-rv="zoom"
          style={step(2)}
          href={REEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Pogledaj video iskustvo klijentkinje na Instagramu"
          className={`${card} group col-span-2 lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:row-span-2 w-full max-w-sm lg:max-w-none mx-auto aspect-[5/7] lg:aspect-auto block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent`}
        >
          <Image
            src={REEL_COVER}
            alt="Klijentkinja priča o svom iskustvu sa laserskom epilacijom"
            fill
            sizes="(min-width: 1024px) 360px, 384px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-linear-to-b from-black/55 via-transparent via-30% to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/85 to-transparent" />

          <div className="absolute top-4 left-4 right-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-tr from-[#F9CE34] via-[#EE2A7B] to-[#6228D7] text-white">
              <InstagramGlyph className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-poppins text-sm font-semibold text-white">@infinitylaserstudio</span>
              <span className="block font-poppins text-eyebrow text-white/75">Video · Instagram</span>
            </span>
          </div>

          <div className="absolute inset-x-4 bottom-4">
            <p className="font-playfair text-2xl text-white leading-tight">Iskustvo iz prve ruke</p>
            <span className="mt-4 flex items-center justify-between gap-3 rounded-full bg-white/12 pl-5 pr-1.5 py-1.5 font-poppins text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md transition-colors duration-300 group-hover:bg-white/20">
              Pogledaj na Instagramu
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 ease-out group-hover:rotate-45">
                <ArrowUpRight size={18} strokeWidth={2.2} />
              </span>
            </span>
          </div>
        </a>
      </div>

      {/* Testimonials */}
      <div className="max-w-6xl mx-auto mt-14 md:mt-20">
        <div data-rv className="flex flex-col items-center text-center mb-8">
          <GoogleG className="w-7 h-7 mb-3" />
          <h3 className="font-playfair text-[1.75rem] sm:text-3xl text-foreground">
            Šta kažu <span className="text-rose">naše klijentkinje</span>
          </h3>
          <div className="flex flex-col items-center gap-1 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="font-poppins text-xs font-semibold text-foreground/85">{GOOGLE_RATING}</span>
              <Stars size="w-3 h-3" />
            </div>
            <span className="font-poppins text-sm text-foreground/60">prosečna ocena na Google-u</span>
          </div>
        </div>

        <div data-rv>
          <ReviewsCarousel
            reviews={testimonials}
            header={
              <div className="flex items-center justify-between">
                <Stars size="w-3.5 h-3.5" />
                <GoogleG className="w-4 h-4 shrink-0 opacity-70" />
              </div>
            }
          />
        </div>

        {/* No reveal here - the link to all reviews is always on screen */}
        <div className="flex justify-center mt-6">
          <a
            href={GOOGLE_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-surface border border-foreground/12 rounded-full px-6 py-3 font-poppins text-sm font-medium text-foreground/85 shadow-sm transition hover:shadow-md hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <GoogleG className="w-4 h-4" />
            Pogledaj sve recenzije
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-foreground/50" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
