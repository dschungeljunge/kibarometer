import Link from "next/link";
import { Activity, MessageSquare, ArrowRight, ShieldCheck, Clock } from "lucide-react";

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50/30 font-sans">
      {/* Hintergrund-Animation - dezent */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="w-[800px] h-[800px] bg-blue-100/40 rounded-full blur-3xl animate-pulse opacity-50" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6 text-center space-y-12 max-w-6xl mx-auto">
        
        {/* Hero Section */}
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm text-blue-700 text-sm font-medium border border-blue-100 shadow-sm mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Der Puls der Lehrkräfte
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900">
            edu-<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">KI&nbsp;Puls</span>
          </h1>
          
          <p className="text-xl text-slate-600 leading-relaxed">
            Künstliche Intelligenz verändert die Schule. <br className="hidden md:block" />
            Wie gehst du damit um? Teile deine Haltung oder höre dir echte Herausforderungen aus dem Kollegium an.
          </p>
        </div>

        {/* Cards Section */}
        <div className="grid w-full gap-6 md:grid-cols-2 md:gap-8 max-w-4xl mx-auto">
          
          {/* Card 1: Test */}
          <Link href="/test" className="group relative block h-full">
            <div className="absolute inset-0 bg-blue-600 rounded-3xl transform translate-y-2 translate-x-2 group-hover:translate-y-3 group-hover:translate-x-3 transition-transform opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative h-full bg-white rounded-3xl p-8 text-left border border-slate-200 hover:border-blue-500 transition-colors shadow-xl flex flex-col overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity className="w-24 h-24 text-blue-600 transform rotate-12" />
              </div>
              
              <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform duration-300">
                <Activity className="w-7 h-7" />
              </div>
              
              <h2 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                Eigene Haltung testen
              </h2>
              <p className="text-slate-600 mb-6 flex-grow z-10">
                Mache den wissenschaftlichen Test und erhalte sofort eine persönliche Auswertung im Vergleich zu anderen.
              </p>
              
              <div className="flex items-center gap-5 text-sm text-slate-500 mt-auto pt-6 border-t border-slate-100 z-10">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> <span>~5 Min.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> <span>Anonym</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Card 2: Challenges */}
          <Link href="/herausforderungen" className="group relative block h-full">
            <div className="absolute inset-0 bg-emerald-500 rounded-3xl transform translate-y-2 translate-x-2 group-hover:translate-y-3 group-hover:translate-x-3 transition-transform opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative h-full bg-white rounded-3xl p-8 text-left border border-slate-200 hover:border-emerald-500 transition-colors shadow-xl flex flex-col overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <MessageSquare className="w-24 h-24 text-emerald-600 transform -rotate-12" />
              </div>

              <div className="flex justify-between items-start mb-6">
                <div className="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform duration-300">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase rounded-full tracking-wide">Neu</span>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-emerald-600 transition-colors">
                Herausforderungen
              </h2>
             
              <p className="text-slate-600 mb-6 flex-grow z-10">
                Höre dir konkrete Fälle aus dem Schulalltag an, bewerte sie und teile optional deine eigene Perspektive.
              </p>

              <div className="flex items-center gap-5 text-sm text-slate-500 mt-auto pt-6 border-t border-slate-100 z-10">
                 <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> <span>~3 Min.</span>
                </div>
                 <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <span>Reinhören</span> <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        <p className="text-sm text-slate-400 pt-8">
          Ein Projekt zur Förderung der KI-Kompetenz an Schulen.
        </p>
      </div>
    </main>
  );
}
