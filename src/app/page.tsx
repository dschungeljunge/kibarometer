import Link from "next/link";

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-blue-50">
      {/* Hintergrund-Animation */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-blue-100 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-8">
        <h1 className="text-4xl md:text-6xl font-extrabold text-center text-gray-800 mb-6">
          edu-<span className="text-blue-700">KI&nbsp;Puls</span>
        </h1>
        <p className="max-w-2xl text-center text-lg md:text-xl text-gray-700 mb-10 leading-relaxed">
          Wie schlägt das Herz der Lehrpersonen gegenüber künstlicher Intelligenz? <br className="hidden md:block" />
          Finde deinen persönlichen <span className="font-semibold text-blue-700">KI&nbsp;Puls</span> heraus und vergleiche ihn mit der Community.
        </p>

        <Link href="/test">
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-lg md:text-xl font-medium px-8 py-4 rounded-lg shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300">
            Jetzt Test starten
          </button>
        </Link>
      </div>
    </main>
  );
}
