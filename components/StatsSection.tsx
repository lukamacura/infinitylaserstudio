const stats = [
  { value: "2000+", label: "Zadovoljnih klijenata", sub: "koji su rekli zbogom brijaču" },
  { value: "20+", label: "Zona tretmana", sub: "za svaki deo tela" },
  { value: "70-90%", label: "Dlačica", sub: "uklonjeno zauvek" },
];

// Ažurirati povremeno prema stvarnom stanju na Google profilu.
// Poslednja provera: 20.07.2026.
const GOOGLE_RATING = "5.0";

// Otvara Google panel sa recenzijama direktno (#lrd = local reviews dialog).
// ludocid / lrd koriste isti feature ID kao embed mape u MapSection.tsx.
const GOOGLE_REVIEWS_URL =
  "https://www.google.com/search?q=Infinity+Laser+Studio+Novi+Sad&ludocid=13466329434848326391#lrd=0x475b116b6f148971:0xbae20345f88572f7,1";

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

export default function StatsSection() {
  return (
    <section className="py-20 px-6 bg-cream">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Left: text + stats */}
        <div>
          <span className="inline-flex items-center gap-2 font-poppins text-sm text-gray-500 mb-4">
            <span className="w-6 h-px bg-teal inline-block" />
            Brojke koje govore
          </span>
          <h2 className="font-playfair text-4xl md:text-5xl text-gray-800 leading-tight mb-10">
            Rezultati koji{" "}
            <span className="text-rose">ostaju na koži</span>
          </h2>

          <div className="flex flex-col gap-8">
            {stats.map((s) => (
              <div key={s.label} className="flex items-start gap-5">
                <div className="min-w-[5rem]">
                  <p className="font-playfair text-4xl text-gray-800">{s.value}</p>
                </div>
                <div className="border-l-2 border-pink pl-5">
                  <p className="font-poppins text-sm font-semibold text-gray-700">{s.label}</p>
                  <p className="font-poppins text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: visual */}
        <div className="relative flex justify-center">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-teal opacity-25" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-pink opacity-40" />

          <div className="relative z-10 bg-white rounded-3xl shadow-lg p-10 flex flex-col items-center gap-4 w-72">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal to-mint flex items-center justify-center">
              <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
                <path d="M20 8l2 6h6l-5 3.6 1.9 6L20 20l-4.9 3.6L17 20l-5-3.6L18 14h6L20 8z" fill="white" opacity="0.9" />
              </svg>
            </div>
            <p className="font-playfair text-2xl text-gray-800 text-center">5 godina postojanja</p>
            <p className="font-poppins text-sm text-gray-500 text-center leading-relaxed">
              Infinity Laser Studio je od 2021. prvi izbor za lasersku epilaciju u regionu.
            </p>
            <div className="flex gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <svg key={i} viewBox="0 0 16 16" className="w-4 h-4 text-yellow-400" fill="currentColor">
                  <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" />
                </svg>
              ))}
            </div>
            <p className="font-poppins text-xs text-gray-400">
              {GOOGLE_RATING} prosečna ocena na Google-u
            </p>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="max-w-6xl mx-auto mt-20">
        <div className="flex flex-col items-center text-center mb-8">
          <GoogleG className="w-7 h-7 mb-3" />
          <h3 className="font-playfair text-3xl text-gray-800">
            Šta kažu <span className="text-rose">naše klijentkinje</span>
          </h3>
          <div className="flex items-center gap-2 mt-3">
            <span className="font-poppins text-sm font-semibold text-gray-700">{GOOGLE_RATING}</span>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <svg key={i} viewBox="0 0 16 16" className="w-4 h-4 text-yellow-400" fill="currentColor">
                  <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" />
                </svg>
              ))}
            </div>
            <span className="font-poppins text-sm text-gray-500">· prosečna ocena na Google-u</span>
          </div>
        </div>

        <div className="columns-1 md:columns-2 gap-4 [column-fill:_balance]">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="break-inside-avoid mb-4 bg-white rounded-2xl shadow-sm border border-pink/20 px-5 py-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} viewBox="0 0 16 16" className="w-3.5 h-3.5 text-yellow-400" fill="currentColor">
                      <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" />
                    </svg>
                  ))}
                </div>
                <GoogleG className="w-4 h-4 shrink-0 opacity-70" />
              </div>
              <p className="font-poppins text-sm text-gray-700 leading-relaxed">{t.quote}</p>
              <p className="font-poppins text-xs font-semibold text-gray-500">{t.name}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-8">
          <a
            href={GOOGLE_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-white border border-gray-200 rounded-full px-6 py-3 font-poppins text-sm font-medium text-gray-700 shadow-sm transition hover:shadow-md hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
          >
            <GoogleG className="w-4 h-4" />
            Pogledaj sve recenzije na Google-u
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
