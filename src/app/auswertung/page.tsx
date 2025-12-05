"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link";

// Anzahl der Histogramm-Bins für Verteilungsdarstellungen
const BIN_COUNT = 20;

// Typdefinitionen
interface Answer {
  value: number;
  items: { category: string } | null;
}

interface Profile {
  Positiv: number;
  Negativ: number;
}

interface ExtendedAnswer extends Answer {
  response_id: number;
  responses: {
    role: string;
    school_level: string;
    age: string;
    experience: string;
    gender: string;
    consent: string;
  } | null;
}

interface DemographicComparison {
  userScore: number;
  populationAverage: number;
  userRank: number;
  totalResponses: number;
  percentile: number;
}

interface UserDemographics {
  role: string;
  schoolLevel: string;
  age: string;
  experience: string;
  gender: string;
}

interface InsightData {
  kiType: string;
  rarityScore: number;
  ageOptimismRank: number;
  ageSkepticismRank: number;
  roleOptimismRank: number;
  roleSkepticismRank: number;
  experienceOptimismRank: number;
  experienceSkepticismRank: number;
  ageOptimismTotal: number;
  ageSkepticismTotal: number;
  roleOptimismTotal: number;
  roleSkepticismTotal: number;
  experienceOptimismTotal: number;
  experienceSkepticismTotal: number;
  consistencyScore: number;
  extremeValues: string[];
  uniqueCombination: boolean;
  ageSkepticismHist: number[];
  roleSkepticismHist: number[];
  experienceSkepticismHist: number[];
  ageOptimismHist: number[];
  roleOptimismHist: number[];
  experienceOptimismHist: number[];
  ageSkepticismScores: number[];
  roleSkepticismScores: number[];
  experienceSkepticismScores: number[];
  ageOptimismScores: number[];
  roleOptimismScores: number[];
  experienceOptimismScores: number[];
}

// Hilfsfunktion zur Profilberechnung
const calculateProfile = (answers: Answer[]): Profile => {
  const profile: { [key: string]: { sum: number; count: number } } = {
    Positiv: { sum: 0, count: 0 },
    Negativ: { sum: 0, count: 0 },
  };

  answers.forEach(answer => {
    const category = answer.items?.category;
    if (category && (category === 'Positiv' || category === 'Negativ')) {
      const value = category === 'Negativ' ? 6 - answer.value : answer.value;
      profile[category].sum += value;
      profile[category].count++;
    }
  });

  return {
    Positiv: profile.Positiv.count > 0 ? profile.Positiv.sum / profile.Positiv.count : 0,
    Negativ: profile.Negativ.count > 0 ? profile.Negativ.sum / profile.Negativ.count : 0,
  };
};

// Hilfsfunktion für demographische Vergleiche
const calculateDemographicComparison = (
  userScore: number,
  allScores: number[]
): DemographicComparison => {
  const sortedScores = [...allScores].sort((a, b) => a - b);
  const userRank = sortedScores.filter(score => score < userScore).length + 1;
  const percentile = ((userRank - 1) / allScores.length) * 100;
  const populationAverage = allScores.reduce((a, b) => a + b, 0) / allScores.length;

  return {
    userScore,
    populationAverage,
    userRank,
    totalResponses: allScores.length,
    percentile: Math.round(percentile)
  };
};

// Hilfsfunktion für Interpretationstext
const getInterpretationText = (
  comparison: DemographicComparison, 
  isNegative: boolean = false
): string => {
  const { percentile } = comparison;
  
  if (isNegative) {
    if (percentile >= 75) {
      return `Du gehörst zu den ${100 - percentile}% mit der höchsten Skepsis gegenüber KI. KI-Risiken bereiten dir mehr Sorgen als den meisten anderen.`;
    } else if (percentile >= 50) {
      return `Du bist skeptischer als der Durchschnitt. KI-Risiken bereiten dir mehr Sorgen als den meisten anderen Teilnehmenden.`;
    } else if (percentile >= 25) {
      return `Du zeigst eine mittlere Skepsis gegenüber KI-Risiken - ähnlich wie die Mehrheit der anderen Teilnehmenden.`;
    } else {
      return `Du gehörst zu den ${percentile}% mit der geringsten Skepsis gegenüber KI. Du siehst die Risiken als weniger problematisch an als die meisten anderen.`;
    }
  } else {
    if (percentile >= 75) {
      return `Du gehörst zu den ${100 - percentile}% mit dem höchsten Optimismus gegenüber KI. Du siehst mehr Potentiale als die meisten anderen.`;
    } else if (percentile >= 50) {
      return `Du bist optimistischer als der Durchschnitt. KI-Potentiale siehst du zuversichtlicher als die meisten anderen Teilnehmenden.`;
    } else if (percentile >= 25) {
      return `Du zeigst einen mittleren Optimismus gegenüber KI-Potentialen - ähnlich wie die Mehrheit der anderen Teilnehmenden.`;
    } else {
      return `Du gehörst zu den ${percentile}% mit dem geringsten Optimismus gegenüber KI. Du siehst weniger Potentiale als die meisten anderen.`;
    }
  }
};

// Hilfsfunktion: Gendergerechter KI-Typ-Titel
const getGenderedTitle = (baseTitle: string, gender: string): string => {
  const femaleMap: Record<string, string> = {
    "Der Komplexe": "Die Komplexe",
    "Der Optimist": "Die Optimistin",
    "Der Skeptiker": "Die Skeptikerin",
    "Der Unentschlossene": "Die Unentschlossene",
    "Der Ausgewogene": "Die Ausgewogene",
    "Der Hoffnungsvolle": "Die Hoffnungsvolle",
    "Der Vorsichtige": "Die Vorsichtige"
  };

  const neutralMap: Record<string, string> = {
    "Der Komplexe": "Der/Die Komplexe",
    "Der Optimist": "Der/Die Optimist:in",
    "Der Skeptiker": "Der/Die Skeptiker:in",
    "Der Unentschlossene": "Der/Die Unentschlossene",
    "Der Ausgewogene": "Der/Die Ausgewogene",
    "Der Hoffnungsvolle": "Der/Die Hoffnungsvolle",
    "Der Vorsichtige": "Der/Die Vorsichtige"
  };

  const g = (gender || "").toLowerCase();
  if (g === "weiblich") return femaleMap[baseTitle] || baseTitle;
  if (g === "männlich") return baseTitle;
  return neutralMap[baseTitle] || baseTitle;
};

interface ScatterProps { scores: number[]; userScore: number; userColorClass?: string; othersClass?: string }
interface DotPoint { xPct: number; stack: number; isUser: boolean; id: number | string }
const DistributionScatter = ({ scores, userScore, userColorClass, othersClass = 'bg-blue-500' }: ScatterProps) => {
  const dotSize = 10; // px - größer für bessere Lesbarkeit
  // Gruppiere nach gerundetem Prozentwert (1% Schritte)
  const stackMap: Record<number, number> = {};
  const dots: DotPoint[] = scores.map((s, idx) => {
    const xPct = ((s - 1) / 4) * 100; // 0-100
    const key = Math.round(xPct);
    const stack = stackMap[key] || 0;
    stackMap[key] = stack + 1;
    return { xPct, stack, isUser: false, id: idx };
  });

  // User Punkt zuletzt, damit er oben liegt
  const userXPct = ((userScore - 1) / 4) * 100;
  const userKey = Math.round(userXPct);
  const userStack = (stackMap[userKey] || 0);
  const userDot: DotPoint = { xPct: userXPct, stack: userStack, isUser: true, id: 'user' };
  dots.push(userDot);

  return (
    <div className="relative w-full h-[100px]" >
      {dots.map(dot => (
        <div
          key={dot.id}
          className={`${dot.isUser ? (userColorClass || 'bg-blue-200 border-2 border-white') : othersClass} rounded-full absolute`}
          style={{
            width: dotSize,
            height: dotSize,
            left: `calc(${dot.xPct}% - ${dotSize / 2}px)`,
            bottom: `${dot.stack * (dotSize + 4)}px`,
            zIndex: dot.isUser ? 10 : 1,
          }}
        />
      ))}
      {/* Achse */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-blue-400"></div>
      <div className="absolute -bottom-4 left-0 w-full flex justify-between text-[12px] text-blue-300 select-none">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
      </div>
    </div>
  );
};

function AuswertungContent() {
  const searchParams = useSearchParams();
  const responseId = searchParams.get("response_id");
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [negativeComparison, setNegativeComparison] = useState<DemographicComparison | null>(null);
  const [positiveComparison, setPositiveComparison] = useState<DemographicComparison | null>(null);
  const [userDemo, setUserDemo] = useState<UserDemographics | null>(null);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // Lade alle Antworten mit Pagination
      const allAnswersPages = [];
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from("answers")
          .select(`
            value, 
            response_id,
            items ( category )
          `)
          .range(page * 1000, (page + 1) * 1000 - 1);
        
        if (pageError) {
          console.error("Fehler beim Laden der Antworten:", pageError);
          setLoading(false);
          return;
        }
        
        allAnswersPages.push(...pageData);
        hasMore = pageData.length === 1000;
        page++;
      }

      // Lade alle Responses mit Pagination
      const allResponsesPages = [];
      page = 0;
      hasMore = true;
      
      while (hasMore) {
        const { data: pageData, error: pageError } = await supabase
          .from("responses")
          .select("id, role, school_level, age, experience, gender, consent")
          .range(page * 1000, (page + 1) * 1000 - 1);
        
        if (pageError) {
          console.error("Fehler beim Laden der Responses:", pageError);
          setLoading(false);
          return;
        }
        
        allResponsesPages.push(...pageData);
        hasMore = pageData.length === 1000;
        page++;
      }
      
      const { data: userAnswersData, error: userAnswersError } = await supabase
        .from("answers")
        .select(`value, items ( category )`)
        .eq('response_id', responseId);

      if (userAnswersError) {
        console.error("Fehler beim Laden der User-Daten:", userAnswersError);
        setLoading(false);
        return;
      }

      console.log(`Auswertung: ${allAnswersPages.length} Antworten und ${allResponsesPages.length} Responses geladen`);

      const responseMap: Record<string, {
        role?: string;
        school_level?: string;
        age?: string;
        experience?: string;
        gender?: string;
        consent?: string;
      }> = {};
      allResponsesPages.forEach(r => {
        if (r.id) {
          responseMap[r.id.toString()] = r;
        }
      });

      const userAnswers: Answer[] = userAnswersData as unknown as Answer[];
      const extendedAnswers: ExtendedAnswer[] = allAnswersPages as unknown as ExtendedAnswer[];
      
      const calculatedUserProfile = calculateProfile(userAnswers);
      
      // Berechne Vergleichsdaten für alle Teilnehmer
      const allProfiles: { [response_id: string]: Profile & {age?: string, role?: string, experience?: string} } = {};
      const answersStorage: { [response_id: string]: ExtendedAnswer[] } = {};
      
      extendedAnswers.forEach(answer => {
        if (!answer.response_id || !answer.items?.category) return;
        
        const respId = answer.response_id.toString();
        if (!allProfiles[respId]) {
          allProfiles[respId] = { Positiv: 0, Negativ: 0 };
        }
        
        if (!answersStorage[respId]) {
          answersStorage[respId] = [];
        }
        answersStorage[respId].push(answer);
      });
      
      // Berechne Profile für alle Teilnehmer
      const allNegativeScores: number[] = [];
      const allPositiveScores: number[] = [];
      
      Object.keys(answersStorage).forEach(respId => {
        const answers = answersStorage[respId];
        if (answers.length > 0) {
          const profile = calculateProfile(answers);
          allNegativeScores.push(profile.Negativ);
          allPositiveScores.push(profile.Positiv);
          
          const demo = responseMap[respId] || {};
          allProfiles[respId] = {
            ...profile,
            age: demo.age || 'Unbekannt',
            role: demo.role || 'Unbekannt',
            experience: demo.experience || 'Unbekannt'
          };
        }
      });
      
      const negComp = calculateDemographicComparison(calculatedUserProfile.Negativ, allNegativeScores);
      const posComp = calculateDemographicComparison(calculatedUserProfile.Positiv, allPositiveScores);
      
      const userDemographics = responseId ? responseMap[responseId] || null : null;
      const demographics: UserDemographics = {
        role: userDemographics?.role || 'Unbekannt',
        schoolLevel: userDemographics?.school_level || 'Unbekannt',
        age: userDemographics?.age || 'Unbekannt',
        experience: userDemographics?.experience || 'Unbekannt',
        gender: userDemographics?.gender || 'Unbekannt'
      };
      
      // Berechne erweiterte Insights mit separaten Rankings
      const calculateAdvancedInsights = (): InsightData => {
        const userPos = calculatedUserProfile.Positiv;
        const userNeg = calculatedUserProfile.Negativ;
        
        // KI-Typ bestimmen
        let kiType = "Ausgewogen";
        if (userPos > 4 && userNeg > 4) kiType = "Der Komplexe";
        else if (userPos > 4 && userNeg < 2.5) kiType = "Der Optimist";
        else if (userPos < 2.5 && userNeg > 4) kiType = "Der Skeptiker";
        else if (userPos < 2.5 && userNeg < 2.5) kiType = "Der Unentschlossene";
        else if (Math.abs(userPos - userNeg) < 0.5) kiType = "Der Ausgewogene";
        else if (userPos > userNeg + 1) kiType = "Der Hoffnungsvolle";
        else if (userNeg > userPos + 1) kiType = "Der Vorsichtige";
        
        // Separate Rankings berechnen
        const sameAgeProfiles = Object.entries(allProfiles)
          .filter(([, profile]) => profile.age === demographics.age);
        const ageOptimismScores = sameAgeProfiles.map(([, profile]) => profile.Positiv);
        const ageSkepticismScores = sameAgeProfiles.map(([, profile]) => profile.Negativ);
        const ageOptimismRank = ageOptimismScores.filter(score => score < userPos).length + 1;
        const ageSkepticismRank = ageSkepticismScores.filter(score => score < userNeg).length + 1;
        
        const sameRoleProfiles = Object.entries(allProfiles)
          .filter(([, profile]) => profile.role === demographics.role);
        const roleOptimismScores = sameRoleProfiles.map(([, profile]) => profile.Positiv);
        const roleSkepticismScores = sameRoleProfiles.map(([, profile]) => profile.Negativ);
        const roleOptimismRank = roleOptimismScores.filter(score => score < userPos).length + 1;
        const roleSkepticismRank = roleSkepticismScores.filter(score => score < userNeg).length + 1;
        
        const sameExperienceProfiles = Object.entries(allProfiles)
          .filter(([, profile]) => profile.experience === demographics.experience);
        const experienceOptimismScores = sameExperienceProfiles.map(([, profile]) => profile.Positiv);
        const experienceSkepticismScores = sameExperienceProfiles.map(([, profile]) => profile.Negativ);
        const experienceOptimismRank = experienceOptimismScores.filter(score => score < userPos).length + 1;
        const experienceSkepticismRank = experienceSkepticismScores.filter(score => score < userNeg).length + 1;
        
        // Seltene Kombination berechnen
        const similarProfiles = Object.values(allProfiles).filter(profile => 
          Math.abs(profile.Positiv - userPos) < 0.5 && Math.abs(profile.Negativ - userNeg) < 0.5
        );
        const rarityScore = Math.round((1 - similarProfiles.length / Object.keys(allProfiles).length) * 100);
        
        // Konsistenz
        const consistencyScore = Math.round(((5 - Math.abs(userPos - userNeg)) / 5) * 100);
        
        // Extreme Werte
        const extremeValues: string[] = [];
        if (userPos >= 4.5) extremeValues.push("Sehr stark optimistisch");
        if (userNeg >= 4.5) extremeValues.push("Sehr stark skeptisch");
        if (userPos <= 1.5) extremeValues.push("Ungewöhnlich wenig optimistisch");
        if (userNeg <= 1.5) extremeValues.push("Ungewöhnlich wenig skeptisch");
        
        const uniqueCombination = rarityScore >= 85;
        
        const buildHist = (scores: number[]): number[] => {
          const bins = Array(BIN_COUNT).fill(0);
          scores.forEach(s => {
            const idx = Math.floor(((s - 1) / 4) * BIN_COUNT);
            bins[Math.max(0, Math.min(BIN_COUNT - 1, idx))]++;
          });
          return bins;
        };

        const ageSkepticismHist = buildHist(ageSkepticismScores);
        const ageOptimismHist = buildHist(ageOptimismScores);
        const roleSkepticismHist = buildHist(roleSkepticismScores);
        const roleOptimismHist = buildHist(roleOptimismScores);
        const experienceSkepticismHist = buildHist(experienceSkepticismScores);
        const experienceOptimismHist = buildHist(experienceOptimismScores);
        
        return {
          kiType,
          rarityScore,
          ageOptimismRank,
          ageSkepticismRank,
          roleOptimismRank,
          roleSkepticismRank,
          experienceOptimismRank,
          experienceSkepticismRank,
          ageOptimismTotal: ageOptimismScores.length,
          ageSkepticismTotal: ageSkepticismScores.length,
          roleOptimismTotal: roleOptimismScores.length,
          roleSkepticismTotal: roleSkepticismScores.length,
          experienceOptimismTotal: experienceOptimismScores.length,
          experienceSkepticismTotal: experienceSkepticismScores.length,
          consistencyScore,
          extremeValues,
          uniqueCombination,
          ageSkepticismHist,
          roleSkepticismHist,
          experienceSkepticismHist,
          ageOptimismHist,
          roleOptimismHist,
          experienceOptimismHist,
          ageSkepticismScores,
          roleSkepticismScores,
          experienceSkepticismScores,
          ageOptimismScores,
          roleOptimismScores,
          experienceOptimismScores
        };
      };
      
      const calculatedInsights = calculateAdvancedInsights();
      
      setUserProfile(calculatedUserProfile);
      setNegativeComparison(negComp);
      setPositiveComparison(posComp);
      setUserDemo(demographics);
      setInsights(calculatedInsights);
      setLoading(false);
    }
    
    fetchData();
  }, [responseId]);

  if (loading) return <div className="text-center p-8">Lade deine KI-Haltungsanalyse...</div>;
  
  if (!responseId) return (
    <div className="max-w-xl mx-auto bg-white shadow p-8 mt-12 text-center rounded-lg">
      <h1 className="text-3xl font-bold mb-4">Noch kein Ergebnis verfügbar</h1>
      <p className="mb-6">Du hast den Test noch nicht abgeschlossen. Mach jetzt mit, um deine persönliche KI-Haltungsanalyse zu erfahren.</p>
      <Link href="/test" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow transition">Zum Test</Link>
    </div>
  );
  
  if (!userProfile || !negativeComparison || !positiveComparison || !userDemo || !insights) {
    return <main className="text-center p-8">Fehler bei der Auswertung. Bitte den Test erneut durchführen.</main>;
  }

  // Hilfsfunktion für Prozentberechnung (Position in sortierter Liste)
  const calcPercent = (rank: number, total: number) => {
    const skeptPct = Math.round(((rank - 1) / Math.max(total - 1, 1)) * 100);
    return { skeptPct, trustPct: 100 - skeptPct };
  };

  // Prozentwerte für Skepsis-Vergleichskarten
  const agePerc = calcPercent(insights.ageSkepticismRank, insights.ageSkepticismTotal);
  const rolePerc = calcPercent(insights.roleSkepticismRank, insights.roleSkepticismTotal);
  const expPerc = calcPercent(insights.experienceSkepticismRank, insights.experienceSkepticismTotal);

  // Optimismus-Percents für Punkteskala
  const ageOptPerc = calcPercent(insights.ageOptimismRank, insights.ageOptimismTotal);
  const roleOptPerc = calcPercent(insights.roleOptimismRank, insights.roleOptimismTotal);
  const expOptPerc = calcPercent(insights.experienceOptimismRank, insights.experienceOptimismTotal);

  const userNegScore = userProfile.Negativ;
  const userPosScore = userProfile.Positiv;

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-blue-50 via-white to-blue-50 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-blue-900">
            Deine KI-Haltung: Zwischen Licht und Schatten
          </h1>
          <p className="text-xl text-blue-700 max-w-2xl mx-auto leading-relaxed">
            Künstliche Intelligenz weckt sowohl Hoffnungen als auch Bedenken. 
            Hier erfährst du, wie du persönlich zu KI stehst.
          </p>
        </div>
      </div>

      {/* KI-Typ Reveal */}
      <section className="bg-white py-20 border-t border-blue-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="mb-8">
            <h2 className="text-2xl text-blue-600 mb-4">Dein KI-Persönlichkeitstyp</h2>
          </div>
          
          <div className="bg-gradient-to-b from-blue-50 to-white rounded-3xl p-12 mb-8 border border-blue-200 shadow-lg">
            <div className="text-6xl mb-6">
              {insights.kiType === "Der Komplexe" ? "🧠" : 
               insights.kiType === "Der Optimist" ? "⭐" :
               insights.kiType === "Der Skeptiker" ? "🔍" :
               insights.kiType === "Der Unentschlossene" ? "❓" :
               insights.kiType === "Der Ausgewogene" ? "⚖️" :
               insights.kiType === "Der Hoffnungsvolle" ? "🌅" :
               insights.kiType === "Der Vorsichtige" ? "🛡️" : "🎯"}
            </div>
            <h3 className="text-4xl font-bold mb-6 text-blue-700">{getGenderedTitle(insights.kiType, userDemo.gender)}</h3>
            <p className="text-xl text-blue-700 leading-relaxed max-w-3xl mx-auto">
              {insights.kiType === "Der Komplexe" ? "Du erkennst sowohl große Chancen als auch ernste Risiken in der KI. Diese differenzierte Sichtweise zeigt, dass du das Thema wirklich durchdacht hast." :
               insights.kiType === "Der Optimist" ? "Du siehst vor allem die positiven Möglichkeiten der KI und bist bereit, neue Wege zu erkunden. Dein Vertrauen in die Technologie ist bemerkenswert." :
               insights.kiType === "Der Skeptiker" ? "Du betrachtest die Risiken der KI als besonders wichtig und gehst vorsichtig an das Thema heran. Diese kritische Haltung ist wertvoll für eine verantwortungsvolle Entwicklung." :
               insights.kiType === "Der Unentschlossene" ? "Du erkundest noch, was KI für dich bedeutet. Das ist völlig normal bei diesem komplexen und sich schnell wandelnden Thema." :
               insights.kiType === "Der Ausgewogene" ? "Du hältst Chancen und Risiken der KI in einer durchdachten Balance. Diese ausgewogene Perspektive ist sehr wertvoll." :
               insights.kiType === "Der Hoffnungsvolle" ? "Du siehst mehr Chancen als Risiken, bleibst aber realistisch und bedacht. Diese optimistische Grundhaltung ist inspirierend." :
               "Du siehst mehr Risiken als Chancen, verschließt dich aber nicht gänzlich den Möglichkeiten. Diese vorsichtige Offenheit ist sehr vernünftig."}
            </p>
          </div>

          {insights.uniqueCombination && (
            <div className="bg-blue-100 rounded-2xl p-8 mb-6 border border-blue-200">
              <h4 className="text-2xl font-bold text-blue-700 mb-3">Besondere Perspektive</h4>
              <p className="text-lg text-blue-800">
                Nur {100 - insights.rarityScore}% aller Teilnehmenden haben eine ähnliche KI-Haltung wie du. 
                Du bringst eine seltene und wertvolle Perspektive in die Diskussion ein.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Die skeptische Seite der KI - mit Rankings */}
      <section className="bg-blue-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-6 text-blue-100">Die skeptische Seite der KI</h2>
            <p className="text-lg text-blue-200 mb-8 max-w-2xl mx-auto leading-relaxed">
              KI bringt reale Herausforderungen mit sich: Datenschutz, Arbeitsplätze, ethische Fragen. 
              Hier siehst du, wie du diese Risiken einschätzt.
            </p>
          </div>

          <div className="bg-blue-800 rounded-xl p-8 mb-8 border border-blue-700">
            <h3 className="text-2xl font-semibold mb-8 text-center text-blue-200">Deine Risikowahrnehmung</h3>
            
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="text-center">
                <div className="text-6xl font-bold text-blue-300 mb-4">
                  {userProfile.Negativ.toFixed(1)}
                </div>
                <div className="text-blue-200 mb-2 text-lg">Dein Wert</div>
                <div className="text-sm text-blue-300">
                  Durchschnitt aller: {negativeComparison.populationAverage.toFixed(1)}
                </div>
                <div className="text-sm text-blue-400 mt-2">
                  Skala: 1 (geringe Bedenken) bis 5 (große Bedenken)
                </div>
              </div>
              
              <div className="bg-blue-700 p-6 rounded-lg border border-blue-600">
                <p className="text-blue-100 leading-relaxed mb-4">
                  {getInterpretationText(negativeComparison, true)}
                </p>
              </div>
            </div>

            {/* Skepsis-Vergleiche */}
            <div className="mt-10">
              <h4 className="text-lg font-semibold mb-2 text-center text-blue-200">Wie skeptisch bist du im Vergleich?</h4>
              <p className="text-center text-sm text-blue-300 mb-6">Jeder blaue Punkt repräsentiert eine Antwort aus deiner Vergleichsgruppe, dein eigener Wert ist als weißer Punkt hervorgehoben.</p>
              
              <div className="bg-blue-700 rounded-lg p-6 mb-8">
                <div className="relative">
                  <div className="flex justify-between text-xs text-blue-300 mb-2">
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                  </div>
                  <div className="relative h-12 bg-blue-600 rounded-full">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded-full opacity-60" />
                    <div className="absolute top-0 w-1 h-12 bg-blue-200 rounded" style={{ left: `${((negativeComparison.populationAverage - 1) / 4) * 100}%` }} />
                    <div className="absolute -top-7 text-xs text-blue-300 transform -translate-x-1/2" style={{ left: `${((negativeComparison.populationAverage - 1) / 4) * 100}%` }}>⌀ {negativeComparison.populationAverage.toFixed(1)}</div>
                    <div className="absolute top-0 w-3 h-12 bg-blue-300 rounded border-2 border-white" style={{ left: `${((userProfile.Negativ - 1) / 4) * 100 - 1.5}%` }} />
                    <div className="absolute -bottom-8 text-sm text-blue-200 font-bold transform -translate-x-1/2" style={{ left: `${((userProfile.Negativ - 1) / 4) * 100}%` }}>Du: {userProfile.Negativ.toFixed(1)}</div>
                  </div>
                  <div className="flex justify-between text-xs text-blue-300 mt-10"><span>Wenig Bedenken</span><span>Mittlere Bedenken</span><span>Große Bedenken</span></div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {/* Altersgruppen-Vergleich */}
                <div className="bg-blue-700 rounded-lg p-6 border border-blue-600">
                  <div className="text-center mb-4">
                    <div
                      className="text-xl font-bold text-blue-200 mb-2"
                      title={`Nur ${agePerc.skeptPct}% deiner Altersgruppe sind skeptischer als du`}
                    >
                      Altersgruppe
                    </div>
                    <div className="text-blue-100 text-sm mb-1">
                      Geringere Skepsis als {agePerc.trustPct}% deiner Altersgruppe
                    </div>
                    <div className="text-blue-400 text-xs">Generation {userDemo.age}</div>
                  </div>
                  
                  <DistributionScatter scores={insights.ageSkepticismScores} userScore={userNegScore} />
                </div>

                {/* Berufsgruppen-Vergleich */}
                <div className="bg-blue-700 rounded-lg p-6 border border-blue-600">
                  <div className="text-center mb-4">
                    <div
                      className="text-xl font-bold text-blue-200 mb-2"
                      title={`Nur ${rolePerc.skeptPct}% der Personen in der Berufsgruppe ${userDemo.role} sind skeptischer als du`}
                    >
                      Beruf
                    </div>
                    <div className="text-blue-100 text-sm mb-1">
                      Geringere Skepsis als {rolePerc.trustPct}% von {userDemo.role}
                    </div>
                    <div className="text-blue-400 text-xs">{userDemo.role}</div>
                  </div>
                  
                  <DistributionScatter scores={insights.roleSkepticismScores} userScore={userNegScore} />
                </div>

                {/* Erfahrungs-Vergleich */}
                <div className="bg-blue-700 rounded-lg p-6 border border-blue-600">
                  <div className="text-center mb-4">
                    <div
                      className="text-xl font-bold text-blue-200 mb-2"
                      title={`Nur ${expPerc.skeptPct}% der Personen mit ${userDemo.experience} Jahren Erfahrung sind skeptischer als du`}
                    >
                      Erfahrung
                    </div>
                    <div className="text-blue-100 text-sm mb-1">
                      Geringere Skepsis als {expPerc.trustPct}% mit {userDemo.experience} Jahren
                    </div>
                    <div className="text-blue-400 text-xs">{userDemo.experience} Jahre Erfahrung</div>
                  </div>
                  
                  <DistributionScatter scores={insights.experienceSkepticismScores} userScore={userNegScore} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Die optimistische Seite der KI - mit Rankings */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-6 text-blue-900">Die optimistische Seite der KI</h2>
            <p className="text-lg text-blue-700 mb-8 max-w-2xl mx-auto leading-relaxed">
              KI eröffnet beeindruckende Möglichkeiten: Effizienz, Innovation, neue Lernwege. 
              Hier siehst du, wie du diese Chancen bewertest.
            </p>
          </div>

          <div className="bg-blue-50 rounded-xl p-8 mb-8 border border-blue-200 shadow-lg">
            <h3 className="text-2xl font-semibold mb-8 text-center text-blue-700">Deine Chancenwahrnehmung</h3>
            
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="text-center">
                <div className="text-6xl font-bold text-blue-600 mb-4">
                  {userProfile.Positiv.toFixed(1)}
                </div>
                <div className="text-blue-700 mb-2 text-lg">Dein Wert</div>
                <div className="text-sm text-blue-600">
                  Durchschnitt aller: {positiveComparison.populationAverage.toFixed(1)}
                </div>
                <div className="text-sm text-blue-500 mt-2">
                  Skala: 1 (wenig Potentiale erkannt) bis 5 (große Chancen gesehen)
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-blue-200">
                <p className="text-blue-700 leading-relaxed mb-4">
                  {getInterpretationText(positiveComparison, false)}
                </p>
              </div>
            </div>

            {/* Optimismus-Vergleiche */}
            <div className="mt-10">
              <h4 className="text-lg font-semibold mb-2 text-center text-blue-700">Wie optimistisch bist du im Vergleich?</h4>
              <p className="text-center text-sm text-blue-600 mb-6">Jeder hellblaue Punkt steht für eine Antwort deiner Vergleichsgruppe, dein Wert ist dunkelblau markiert.</p>
              
              <div className="bg-blue-100 rounded-lg p-6 border border-blue-200 mb-8">
                <div className="relative">
                  <div className="flex justify-between text-xs text-blue-600 mb-2"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
                  <div className="relative h-12 bg-blue-300 rounded-full">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-300 via-yellow-300 to-green-400 rounded-full opacity-70" />
                    <div className="absolute top-0 w-1 h-12 bg-blue-700 rounded" style={{ left: `${((positiveComparison.populationAverage - 1) / 4) * 100}%` }} />
                    <div className="absolute -top-7 text-xs text-blue-700 transform -translate-x-1/2" style={{ left: `${((positiveComparison.populationAverage - 1) / 4) * 100}%` }}>⌀ {positiveComparison.populationAverage.toFixed(1)}</div>
                    <div className="absolute top-0 w-3 h-12 bg-blue-600 rounded border-2 border-blue-600" style={{ left: `${((userProfile.Positiv - 1) / 4) * 100 - 1.5}%` }} />
                    <div className="absolute -bottom-8 text-sm text-blue-700 font-bold transform -translate-x-1/2" style={{ left: `${((userProfile.Positiv - 1) / 4) * 100}%` }}>Du: {userProfile.Positiv.toFixed(1)}</div>
                  </div>
                  <div className="flex justify-between text-xs text-blue-600 mt-10"><span>Wenig Chancen</span><span>Mittlere Chancen</span><span>Große Chancen</span></div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {/* Altersgruppen-Vergleich */}
                <div className="bg-white rounded-lg p-6 border border-blue-200 shadow-sm">
                  <div className="text-center mb-4">
                    <div className="text-xl font-bold text-blue-600 mb-2">Altersgruppe</div>
                    <div className="text-blue-700 text-sm mb-1">
                      Optimistischer als {ageOptPerc.trustPct}% deiner Altersgruppe
                    </div>
                    <div className="text-blue-500 text-xs">Generation {userDemo.age}</div>
                  </div>
                  
                  <DistributionScatter scores={insights.ageOptimismScores} userScore={userPosScore} userColorClass="bg-blue-600 border-2 border-blue-600" othersClass="bg-white border border-blue-400" />
                </div>

                {/* Berufsgruppen-Vergleich */}
                <div className="bg-white rounded-lg p-6 border border-blue-200 shadow-sm">
                  <div className="text-center mb-4">
                    <div className="text-xl font-bold text-blue-600 mb-2">Beruf</div>
                    <div className="text-blue-700 text-sm mb-1">
                      Optimistischer als {roleOptPerc.trustPct}% der {userDemo.role}
                    </div>
                    <div className="text-blue-500 text-xs">{userDemo.role}</div>
                  </div>
                  
                  <DistributionScatter scores={insights.roleOptimismScores} userScore={userPosScore} userColorClass="bg-blue-600 border-2 border-blue-600" othersClass="bg-white border border-blue-400" />
                </div>

                {/* Erfahrungs-Vergleich */}
                <div className="bg-white rounded-lg p-6 border border-blue-200 shadow-sm">
                  <div className="text-center mb-4">
                    <div className="text-xl font-bold text-blue-600 mb-2">Erfahrung</div>
                    <div className="text-blue-700 text-sm mb-1">
                      Optimistischer als {expOptPerc.trustPct}% mit {userDemo.experience} Jahren
                    </div>
                    <div className="text-blue-500 text-xs">{userDemo.experience} Jahre Erfahrung</div>
                  </div>
                  
                  <DistributionScatter scores={insights.experienceOptimismScores} userScore={userPosScore} userColorClass="bg-blue-600 border-2 border-blue-600" othersClass="bg-white border border-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Extreme Values & Special Insights */}
      {insights.extremeValues.length > 0 && (
        <section className="bg-blue-50 py-16 border-t border-blue-100">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-8 text-blue-900">Besondere Merkmale</h2>
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-blue-200">
              <p className="text-xl mb-6 text-blue-700">Du hast sehr ausgeprägte Werte in folgenden Bereichen:</p>
              <div className="space-y-4">
                {insights.extremeValues.map((extreme, index) => (
                  <div key={index} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-lg font-semibold text-blue-800">{extreme}</div>
                  </div>
                ))}
              </div>
              <p className="text-lg text-blue-600 mt-6">
                Du gehörst zu den wenigen Menschen, die so klare Positionen haben. 
                Das zeigt eine durchdachte und gefestigte Meinung.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Synthese */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-20 border-t border-blue-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-6 text-blue-900">Dein vollständiges KI-Profil</h2>
            <p className="text-lg text-blue-700 max-w-2xl mx-auto leading-relaxed">
              Skepsis und Optimismus schließen sich nicht aus. Hier siehst du beide Aspekte deiner KI-Haltung im Überblick.
            </p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg border border-blue-200">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-4 text-blue-900">Konsistenz deiner Antworten</h3>
                <div className="text-4xl font-bold text-blue-600 mb-4">{insights.consistencyScore}%</div>
                <p className="text-blue-700">
                  {insights.consistencyScore > 80 ? "Sehr konsistent: Du hast eine klare, einheitliche Linie in deinen Antworten." :
                   insights.consistencyScore > 60 ? "Ziemlich konsistent: Du zeigst eine relativ einheitliche Haltung." :
                   insights.consistencyScore > 40 ? "Ausgewogen: Du differenzierst je nach Situation und Kontext." :
                   "Flexibel: Du passt deine Einschätzungen stark an verschiedene Aspekte an."}
                </p>
              </div>
              
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-4 text-blue-900">Einzigartigkeit deiner Sichtweise</h3>
                <div className="text-4xl font-bold text-blue-600 mb-4">{insights.rarityScore}%</div>
                <p className="text-blue-700">
                  Wie selten deine Kombination von Einstellungen ist. Höhere Werte bedeuten individuellere Sichtweisen.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Share Section */}
      <section className="bg-white py-20 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-8 text-gray-800">Teile deine Ergebnisse</h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Fandest du diese Auswertung interessant? Teile sie mit anderen, um ihre Perspektive auf KI zu erfahren.
          </p>
          <button
            onClick={handleShare}
            className="bg-blue-600 text-white font-bold py-3 px-8 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-300 ease-in-out shadow-lg transform hover:scale-105"
          >
            {isCopied ? 'Link kopiert!' : 'Ergebnisse teilen'}
          </button>
        </div>
      </section>
    </main>
  );
}

export default function AuswertungPage() {
  return (
    <Suspense fallback={<div className="text-center p-8">Lade deine Auswertung...</div>}>
      <AuswertungContent />
    </Suspense>
  );
} 