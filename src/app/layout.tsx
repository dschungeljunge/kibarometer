import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "edu-KI Puls – Dein KI-Stimmungscheck für den Unterricht",
  description: "Teste deine Haltung zu Künstlicher Intelligenz im Bildungsbereich und vergleiche dich mit anderen Lehrpersonen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`flex flex-col min-h-screen bg-gray-50 ${geistSans.variable} ${geistMono.variable}`}>
        {/* Hauptnavigation */}
        <nav className="w-full bg-white shadow">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-blue-700 hover:text-blue-800">edu-KI&nbsp;Puls</Link>
            <div className="flex gap-6 text-neutral-700">
              <Link href="/test">Test</Link>
              <Link href="/auswertung">KI&nbsp;Puls</Link>
            </div>
          </div>
        </nav>

        {/* Seiteninhalt */}
        <main className="flex-grow">
          {children}
        </main>

        {/* Footer mit weniger prominenten Links */}
        <footer className="w-full bg-gray-100 py-4">
          <div className="max-w-4xl mx-auto px-4 text-center flex justify-center gap-6 text-sm text-neutral-600">
            <Link href="/forschung" className="hover:text-primary-600 underline">Statistik</Link>
            <Link href="/impressum" className="hover:text-primary-600 underline">Impressum</Link>
            <Link href="/datenschutz" className="hover:text-primary-600 underline">Datenschutz</Link>
            <a href="https://github.com/dschungeljunge/kibarometer" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 underline">GitHub</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
