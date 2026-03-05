const stats = [
  { value: "2 000+", label: "Zadovoljnih klijenata", sub: "koji su rekli zbogom britvi" },
  { value: "60+", label: "Zona tretmana", sub: "za svaki deo tela" },
  { value: "12M+", label: "Minuta lasera", sub: "isporučeno s preciznošću" },
];

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
            <p className="font-playfair text-2xl text-gray-800 text-center">5 godina izvrsnosti</p>
            <p className="font-poppins text-sm text-gray-500 text-center leading-relaxed">
              Infinity Laser Studio je od 2019. prvi izbor za lasersku epilaciju u regionu.
            </p>
            <div className="flex gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <svg key={i} viewBox="0 0 16 16" className="w-4 h-4 text-yellow-400" fill="currentColor">
                  <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" />
                </svg>
              ))}
            </div>
            <p className="font-poppins text-xs text-gray-400">5.0 · 200+ recenzija</p>
          </div>
        </div>
      </div>
    </section>
  );
}
