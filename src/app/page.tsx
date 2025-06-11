import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-3xl font-bold mb-4">KI-Barometer</h1>
        <p className="mb-6 text-lg">Die Website spiegelt die Haltung der Lehrpersonen aller Schulstufen gegenüber der KI in der Bildung. Mach den Test und vergleiche deine Haltung mit der Gesamtpopulation!</p>
        <Link href="/test">
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition">Test starten</button>
        </Link>
      </div>
    </main>
  );
}
