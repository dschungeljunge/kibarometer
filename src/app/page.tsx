import Link from "next/link";

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-blue-50">
      {/* Hintergrund-Animation */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-blue-100 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-8 text-center space-y-8">
        <div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-800 mb-4">
            edu-<span className="text-blue-700">KI&nbsp;Puls</span>
          </h1>
          <p className="max-w-2xl text-lg md:text-xl text-gray-700 leading-relaxed">
            Wie schlägt das Herz der Lehrpersonen gegenüber künstlicher Intelligenz?
            Erkunde deine Haltung – oder höre, welche Herausforderungen andere erleben.
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
          <Link href="/test" className="group">
            <div className="h-full rounded-2xl bg-blue-600 text-white px-8 py-6 shadow-lg transition-transform transform group-hover:scale-[1.02]">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">Fragebogen</p>
              <h2 className="text-xl md:text-2xl font-bold mt-1">Eigene Haltung erkunden</h2>
              <p className="mt-2 text-blue-100">
                Schneller KI-Stimmungscheck mit persönlicher Auswertung.
              </p>
            </div>
          </Link>

          <Link href="/herausforderungen" className="group">
            <div className="h-full rounded-2xl bg-white text-gray-900 px-8 py-6 shadow-lg border border-blue-100 transition-transform transform group-hover:scale-[1.02]">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Neu</p>
              <h2 className="text-xl md:text-2xl font-bold mt-1">Über Herausforderungen nachdenken</h2>
              <p className="mt-2 text-gray-700">
                Drei Beiträge anhören, gewichten und anschliessend selbst einsprechen (60&nbsp;s).
              </p>
            </div>
          </Link>
        </div>

        <p className="text-sm text-gray-600 max-w-xl">
          Du entscheidest: Haltung reflektieren oder kollegiale Herausforderungen hören und teilen.
        </p>
      </div>
    </main>
  );
}
