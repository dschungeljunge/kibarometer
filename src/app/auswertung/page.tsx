"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/utils/supabaseClient";
// recharts imports removed as they are not used in the current design
import Link from "next/link";

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
  userRank: number; // Position von unten (1 = niedrigster Wert)
  totalResponses: number;
  percentile: number; // Prozent der Population, die niedriger scored hat
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
  generationRank: number;
  roleRank: number;
  experienceEffect: string;
  consistencyScore: number;
  extremeValues: string[];
  uniqueCombination: boolean;
  polarityIndex: number;
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
      // Negative Items sind umgekehrt skaliert. Eine 5 ist hier eine 1 in der Haltung.
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
    // Für negative/skeptische Haltung
    if (percentile >= 75) {
      return `Du gehörst zu den ${100 - percentile}% mit der geringsten Skepsis gegenüber KI. Du siehst die Risiken als weniger problematisch an als die meisten anderen.`;
    } else if (percentile >= 50) {
      return `Du bist weniger skeptisch als der Durchschnitt. KI-Risiken bereitest dir weniger Sorgen als den meisten anderen Teilnehmenden.`;
    } else if (percentile >= 25) {
      return `Du zeigst eine mittlere Skepsis gegenüber KI-Risiken - ähnlich wie die Mehrheit der anderen Teilnehmenden.`;
    } else {
      return `Du gehörst zu den ${100 - percentile}% mit der höchsten Skepsis gegenüber KI. KI-Risiken bereiten dir mehr Sorgen als den meisten anderen.`;
    }
  } else {
    // Für positive/optimistische Haltung  
    if (percentile >= 75) {
      return `Du gehörst zu den ${100 - percentile}% mit dem geringsten Optimismus gegenüber KI. Du siehst weniger Potentiale als die meisten anderen.`;
    } else if (percentile >= 50) {
      return `Du bist weniger optimistisch als der Durchschnitt. KI-Potentiale siehst du zurückhaltender als die meisten anderen Teilnehmenden.`;
    } else if (percentile >= 25) {
      return `Du zeigst einen mittleren Optimismus gegenüber KI-Potentialen - ähnlich wie die Mehrheit der anderen Teilnehmenden.`;
    } else {
      return `Du gehörst zu den ${100 - percentile}% mit dem höchsten Optimismus gegenüber KI. Du siehst mehr Potentiale als die meisten anderen.`;
    }
  }
};

function AuswertungNeuContent() {
  const searchParams = useSearchParams();
  const responseId = searchParams.get("response_id");
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [negativeComparison, setNegativeComparison] = useState<DemographicComparison | null>(null);
  const [positiveComparison, setPositiveComparison] = useState<DemographicComparison | null>(null);
  const [userDemo, setUserDemo] = useState<UserDemographics | null>(null);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!responseId) {
        setLoading(false);
        return;
      }

      // Erweiterte Datenabfrage für alle Teilnehmer
      const { data: allAnswersWithDemo, error: answersError } = await supabase
        .from("answers")
        .select(`
          value, 
          response_id,
          items ( category ),
          responses ( role, school_level, age, experience, gender, consent )
        `);

      if (answersError) {
        console.error("Fehler beim Laden der Daten:", answersError);
        setLoading(false);
        return;
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

      const userAnswers: Answer[] = userAnswersData as unknown as Answer[];
      const extendedAnswers: ExtendedAnswer[] = allAnswersWithDemo as unknown as ExtendedAnswer[];
      
      const calculatedUserProfile = calculateProfile(userAnswers);
      
      // Berechne Vergleichsdaten für alle Teilnehmer
      const allProfiles: { [response_id: string]: Profile & {age?: string, role?: string} } = {};
      const answersStorage: { [response_id: string]: ExtendedAnswer[] } = {};
      
      extendedAnswers.forEach(answer => {
        if (!answer.response_id || !answer.items?.category) return;
        
        const respId = answer.response_id.toString();
        if (!allProfiles[respId]) {
          allProfiles[respId] = { Positiv: 0, Negativ: 0 };
        }
        
        // Sammle Antworten für diese Response-ID
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
          
          // Store profile with demographics
          allProfiles[respId] = {
            ...profile,
            age: answers[0]?.responses?.age,
            role: answers[0]?.responses?.role
          };
        }
      });
      
      // Berechne Vergleiche
      const negComp = calculateDemographicComparison(calculatedUserProfile.Negativ, allNegativeScores);
      const posComp = calculateDemographicComparison(calculatedUserProfile.Positiv, allPositiveScores);
      
      // Finde User-Demographics
      const userDemographics = extendedAnswers.find(a => a.response_id.toString() === responseId)?.responses;
      const demographics: UserDemographics = {
        role: userDemographics?.role || 'Unbekannt',
        schoolLevel: userDemographics?.school_level || 'Unbekannt',
        age: userDemographics?.age || 'Unbekannt',
        experience: userDemographics?.experience || 'Unbekannt',
        gender: userDemographics?.gender || 'Unbekannt'
      };
      
      // Berechne erweiterte Insights
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
        
        // Seltene Kombination berechnen
        const similarProfiles = Object.values(allProfiles).filter(profile => 
          Math.abs(profile.Positiv - userPos) < 0.5 && Math.abs(profile.Negativ - userNeg) < 0.5
        );
        const rarityScore = Math.round((1 - similarProfiles.length / Object.keys(allProfiles).length) * 100);
        
        // Generationsrank
        const sameAgeProfiles = Object.entries(allProfiles)
          .filter(([, profile]) => profile.age === demographics.age)
          .map(([, profile]) => profile.Positiv + profile.Negativ);
        const userTotal = userPos + userNeg;
        const generationRank = sameAgeProfiles.filter(score => score < userTotal).length + 1;
        
        // Rollenrank
        const sameRoleProfiles = Object.entries(allProfiles)
          .filter(([, profile]) => profile.role === demographics.role)
          .map(([, profile]) => profile.Positiv + profile.Negativ);
        const roleRank = sameRoleProfiles.filter(score => score < userTotal).length + 1;
        
        // Erfahrungseffekt
        const experienceMap: { [key: string]: number } = {
          '0-5': 1, '6-10': 2, '11-15': 3, '16-20': 4, '21-30': 5, '31+': 6
        };
        const userExpLevel = experienceMap[demographics.experience] || 3;
        let experienceEffect = "neutral";
        if (userExpLevel <= 2 && userPos > 3.5) experienceEffect = "young-optimist";
        else if (userExpLevel >= 5 && userNeg > 3.5) experienceEffect = "experienced-skeptic";
        else if (userExpLevel >= 4 && userPos > 3.8) experienceEffect = "wise-optimist";
        
        // Konsistenz (vereinfacht)
        const consistencyScore = Math.round(((5 - Math.abs(userPos - userNeg)) / 5) * 100);
        
        // Extreme Werte
        const extremeValues: string[] = [];
        if (userPos >= 4.5) extremeValues.push("Extrem optimistisch");
        if (userNeg >= 4.5) extremeValues.push("Extrem skeptisch");
        if (userPos <= 1.5) extremeValues.push("Ungewöhnlich wenig optimistisch");
        if (userNeg <= 1.5) extremeValues.push("Ungewöhnlich wenig skeptisch");
        
        // Unique Kombination
        const uniqueCombination = rarityScore >= 85;
        
        // Polaritäts-Index
        const polarityIndex = Math.round(Math.abs(userPos - userNeg) * 20);
        
        return {
          kiType,
          rarityScore,
          generationRank,
          roleRank,
          experienceEffect,
          consistencyScore,
          extremeValues,
          uniqueCombination,
          polarityIndex
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

  // radarData removed as it's not used in the current design

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-blue-50 via-white to-blue-50 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-800">
            Deine KI-Haltung: Zwischen Licht und Schatten
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
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
               insights.kiType === "Der Optimist" ? "🌟" :
               insights.kiType === "Der Skeptiker" ? "🔍" :
               insights.kiType === "Der Unentschlossene" ? "🤔" :
               insights.kiType === "Der Ausgewogene" ? "⚖️" :
               insights.kiType === "Der Hoffnungsvolle" ? "🌅" :
               insights.kiType === "Der Vorsichtige" ? "🛡️" : "🎯"}
            </div>
            <h3 className="text-4xl font-bold mb-6 text-blue-700">{insights.kiType}</h3>
            <p className="text-xl text-gray-700 leading-relaxed max-w-3xl mx-auto">
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
              <div className="text-4xl mb-3">✨</div>
              <h4 className="text-2xl font-bold text-blue-700 mb-3">Besondere Perspektive!</h4>
              <p className="text-lg text-blue-800">
                Nur {100 - insights.rarityScore}% aller Teilnehmenden haben eine ähnliche KI-Haltung wie du. 
                Du bringst eine seltene und wertvolle Perspektive in die Diskussion ein.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Wichtige Kennzahlen */}
      <section className="bg-gray-50 py-20 border-t border-blue-100">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4 text-gray-800">Deine Kennzahlen im Überblick</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Diese Werte zeigen, wie du im Vergleich zu anderen Teilnehmenden stehst.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Percentile Card */}
            <div className="bg-white rounded-xl p-8 text-center shadow-md border border-blue-100">
              <div className="text-4xl font-bold mb-2 text-blue-600">{Math.max(positiveComparison.percentile, negativeComparison.percentile)}%</div>
              <div className="text-lg mb-3 text-gray-700">übertroffen</div>
              <div className="text-sm text-gray-500">
                {Math.max(positiveComparison.percentile, negativeComparison.percentile)}% der Teilnehmenden haben schwächer ausgeprägte KI-Meinungen als du.
              </div>
            </div>

            {/* Generation Rank */}
            <div className="bg-white rounded-xl p-8 text-center shadow-md border border-blue-100">
              <div className="text-4xl font-bold mb-2 text-blue-600">#{insights.generationRank}</div>
              <div className="text-lg mb-3 text-gray-700">in Generation {userDemo.age}</div>
              <div className="text-sm text-gray-500">
                Deine Position unter Personen deiner Altersgruppe ({userDemo.age} Jahre).
              </div>
            </div>

            {/* Role Performance */}
            <div className="bg-white rounded-xl p-8 text-center shadow-md border border-blue-100">
              <div className="text-4xl font-bold mb-2 text-blue-600">#{insights.roleRank}</div>
              <div className="text-lg mb-3 text-gray-700">als {userDemo.role}</div>
              <div className="text-sm text-gray-500">
                Deine Position im Vergleich zu anderen in deinem Beruf.
              </div>
            </div>

            {/* Konsistenz */}
            <div className="bg-white rounded-xl p-8 text-center shadow-md border border-blue-100">
              <div className="text-4xl font-bold mb-2 text-blue-600">{insights.consistencyScore}%</div>
              <div className="text-lg mb-3 text-gray-700">Konsistenz</div>
              <div className="text-sm text-gray-500">
                Wie einheitlich deine Antworten waren. Hohe Werte zeigen klare Überzeugungen.
              </div>
            </div>

            {/* Rarity Score */}
            <div className="bg-white rounded-xl p-8 text-center shadow-md border border-blue-100">
              <div className="text-4xl font-bold mb-2 text-blue-600">{insights.rarityScore}%</div>
              <div className="text-lg mb-3 text-gray-700">Einzigartigkeit</div>
              <div className="text-sm text-gray-500">
                Wie selten deine Kombination von Einstellungen ist. Höhere Werte bedeuten individuellere Sichtweisen.
              </div>
            </div>

            {/* Experience Years */}
            <div className="bg-white rounded-xl p-8 text-center shadow-md border border-blue-100">
              <div className="text-4xl mb-2 text-blue-600">
                {insights.experienceEffect === "young-optimist" ? "🚀" :
                 insights.experienceEffect === "experienced-skeptic" ? "🧙‍♂️" :
                 insights.experienceEffect === "wise-optimist" ? "🦉" : "🌱"}
              </div>
              <div className="text-lg mb-3 text-gray-700">{userDemo.experience} Jahre</div>
              <div className="text-sm text-gray-500">
                Deine Berufserfahrung und wie sie deine KI-Haltung prägt.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Extreme Values & Special Insights */}
      {insights.extremeValues.length > 0 && (
        <section className="bg-gray-100 py-16 border-t border-blue-100">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-8 text-gray-800">🎯 Besondere Merkmale</h2>
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-blue-200">
              <p className="text-xl mb-6 text-gray-700">Du hast sehr ausgeprägte Werte in folgenden Bereichen:</p>
              <div className="space-y-4">
                {insights.extremeValues.map((extreme, index) => (
                  <div key={index} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-lg font-semibold text-blue-800">{extreme}</div>
                  </div>
                ))}
              </div>
              <p className="text-lg text-gray-600 mt-6">
                Du gehörst zu den wenigen Menschen, die so klare Positionen haben. 
                Das zeigt eine durchdachte und gefestigte Meinung.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Vergleiche mit anderen Gruppen */}
      <section className="bg-white py-20 border-t border-blue-100">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4 text-gray-800">📊 Wie du im Vergleich stehst</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Hier siehst du, wie sich deine KI-Haltung zu anderen demografischen Gruppen verhält.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Altersgruppen-Vergleich */}
            <div className="bg-blue-50 rounded-xl p-8 border border-blue-200">
              <h3 className="text-xl font-bold mb-6 text-blue-800">🎂 Vergleich mit deiner Generation</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-white rounded-lg border border-blue-100">
                  <span className="text-gray-700">Generation {userDemo.age}</span>
                  <span className="text-2xl font-bold text-blue-600">#{insights.generationRank}</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {insights.generationRank <= 5 ? 
                    "Du zeigst eine überdurchschnittlich ausgeprägte KI-Haltung in deiner Altersgruppe. Deine Ansichten sind stärker entwickelt als bei den meisten Gleichaltrigen." :
                    "Deine KI-Haltung entspricht dem typischen Spektrum deiner Generation. Du liegst im Mainstream deiner Altersgruppe."
                  }
                </p>
              </div>
            </div>

            {/* Berufsgruppen-Vergleich */}
            <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
              <h3 className="text-xl font-bold mb-6 text-gray-800">💼 Vergleich in deinem Beruf</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-white rounded-lg border border-gray-200">
                  <span className="text-gray-700">{userDemo.role}</span>
                  <span className="text-2xl font-bold text-gray-600">#{insights.roleRank}</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {userDemo.role === "Lehrperson" ? 
                    "Als Lehrperson bist du in einer wichtigen Position: Du kannst die KI-Kompetenz der nächsten Generation prägen." :
                  userDemo.role === "Dozent:in" ? 
                    "Als Dozent:in hast du besonderen Einfluss auf die KI-Bildung und -Einstellung zukünftiger Fachkräfte." :
                    "Deine berufliche Perspektive bringt wichtige Einsichten in die praktische Anwendung von KI ein."
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Consistency Score */}
          <div className="mt-12 bg-blue-50 rounded-xl p-8 border border-blue-200">
            <h3 className="text-2xl font-bold text-center mb-6 text-blue-800">🎯 Konsistenz deiner Antworten</h3>
            <div className="text-center max-w-2xl mx-auto">
              <div className="text-5xl font-bold text-blue-600 mb-4">{insights.consistencyScore}%</div>
              <p className="text-lg text-gray-700 mb-6">
                {insights.consistencyScore > 80 ? "Sehr konsistent: Du hast eine klare, einheitliche Linie in deinen Antworten." :
                 insights.consistencyScore > 60 ? "Ziemlich konsistent: Du zeigst eine relativ einheitliche Haltung." :
                 insights.consistencyScore > 40 ? "Ausgewogen: Du differenzierst je nach Situation und Kontext." :
                 "Flexibel: Du passt deine Einschätzungen stark an verschiedene Aspekte an."}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${insights.consistencyScore}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500">
                Diese Metrik zeigt, wie einheitlich deine Antworten waren. 
                {insights.consistencyScore < 50 ? " Niedrige Werte können auf differenziertes Denken hinweisen." : " Hohe Werte zeigen klare Überzeugungen."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dunkle Seite der KI */}
      <section className="bg-slate-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-6 text-gray-200">🌑 Die skeptische Seite der KI</h2>
            <p className="text-lg text-blue-200 mb-8 max-w-2xl mx-auto leading-relaxed">
              KI bringt reale Herausforderungen mit sich: Datenschutz, Arbeitsplätze, ethische Fragen. 
              Hier siehst du, wie du diese Risiken einschätzt.
            </p>
          </div>

          <div className="bg-slate-800 rounded-xl p-8 mb-8 border border-slate-700">
            <h3 className="text-2xl font-semibold mb-8 text-center text-blue-200">Deine Risikowahrnehmung</h3>
            
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="text-center">
                <div className="text-6xl font-bold text-blue-400 mb-4">
                  {userProfile.Negativ.toFixed(1)}
                </div>
                <div className="text-gray-300 mb-2 text-lg">Dein Wert</div>
                <div className="text-sm text-gray-400">
                  Durchschnitt aller: {negativeComparison.populationAverage.toFixed(1)}
                </div>
                <div className="text-sm text-blue-300 mt-2">
                  Skala: 1 (geringe Bedenken) bis 5 (große Bedenken)
                </div>
              </div>
              
              <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
                <p className="text-gray-200 leading-relaxed mb-4">
                  {getInterpretationText(negativeComparison, true)}
                </p>
                <div className="text-sm text-blue-300 bg-slate-800 p-3 rounded">
                  <strong>Einordnung:</strong> {negativeComparison.percentile}% der {negativeComparison.totalResponses} Teilnehmenden 
                  sind weniger skeptisch als du, {100 - negativeComparison.percentile}% sind skeptischer.
                </div>
              </div>
            </div>

            {/* Visualisierung für negative Haltung */}
            <div className="mt-10">
              <h4 className="text-lg font-semibold mb-6 text-center text-blue-200">Deine Position in der Gesamtgruppe</h4>
              
              {/* Horizontale Skala */}
              <div className="bg-slate-700 rounded-lg p-6">
                <div className="relative">
                  {/* Skala */}
                  <div className="flex justify-between text-xs text-gray-300 mb-2">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </div>
                  
                  {/* Hauptbalken */}
                  <div className="relative h-8 bg-gray-600 rounded-full">
                    {/* Gradient für Bereiche */}
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded-full opacity-60"></div>
                    
                    {/* Durchschnitt-Markierung */}
                    <div 
                      className="absolute top-0 w-1 h-8 bg-gray-200 rounded"
                      style={{ left: `${((negativeComparison.populationAverage - 1) / 4) * 100}%` }}
                    ></div>
                    <div 
                      className="absolute -top-6 text-xs text-gray-300 transform -translate-x-1/2"
                      style={{ left: `${((negativeComparison.populationAverage - 1) / 4) * 100}%` }}
                    >
                      ⌀ {negativeComparison.populationAverage.toFixed(1)}
                    </div>
                    
                    {/* User-Position */}
                    <div 
                      className="absolute top-0 w-3 h-8 bg-blue-400 rounded border-2 border-white"
                      style={{ left: `${((userProfile.Negativ - 1) / 4) * 100 - 1.5}%` }}
                    ></div>
                    <div 
                      className="absolute -bottom-6 text-sm text-blue-300 font-bold transform -translate-x-1/2"
                      style={{ left: `${((userProfile.Negativ - 1) / 4) * 100}%` }}
                    >
                      Du: {userProfile.Negativ.toFixed(1)}
                    </div>
                  </div>
                  
                  {/* Beschriftungen */}
                  <div className="flex justify-between text-xs text-gray-400 mt-8">
                    <span>Wenig Bedenken</span>
                    <span>Mittlere Bedenken</span>
                    <span>Große Bedenken</span>
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <div className="text-sm text-blue-300">
                    Du stehst im <strong>{negativeComparison.percentile}. Perzentil</strong> - das heißt, 
                    {negativeComparison.percentile}% sind weniger skeptisch und {100 - negativeComparison.percentile}% sind skeptischer als du.
                  </div>
                </div>
              </div>
              
              <p className="text-center text-sm text-gray-400 mt-4">
                Diese Skala zeigt deine Position bei der Wahrnehmung von KI-Risiken im Vergleich zur gesamten Gruppe.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Übergangsbereich */}
      <div className="bg-gradient-to-b from-slate-900 via-gray-100 to-white py-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="bg-white/90 backdrop-blur-sm rounded-full p-6 inline-block shadow-lg border border-blue-200">
            <p className="text-lg text-gray-700">
              Aber KI hat auch eine hoffnungsvolle Seite...
            </p>
          </div>
        </div>
      </div>

      {/* Helle Seite der KI */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">☀️ Die optimistische Seite der KI</h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
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
                <div className="text-gray-700 mb-2 text-lg">Dein Wert</div>
                <div className="text-sm text-gray-500">
                  Durchschnitt aller: {positiveComparison.populationAverage.toFixed(1)}
                </div>
                <div className="text-sm text-blue-600 mt-2">
                  Skala: 1 (wenig Potentiale erkannt) bis 5 (große Chancen gesehen)
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-blue-200">
                <p className="text-gray-700 leading-relaxed mb-4">
                  {getInterpretationText(positiveComparison, false)}
                </p>
                <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded">
                  <strong>Einordnung:</strong> {positiveComparison.percentile}% der {positiveComparison.totalResponses} Teilnehmenden 
                  sehen weniger Chancen als du, {100 - positiveComparison.percentile}% sehen mehr Chancen.
                </div>
              </div>
            </div>

            {/* Visualisierung für positive Haltung */}
            <div className="mt-10">
              <h4 className="text-lg font-semibold mb-6 text-center text-blue-700">Deine Position in der Gesamtgruppe</h4>
              
              {/* Horizontale Skala */}
              <div className="bg-blue-100 rounded-lg p-6 border border-blue-200">
                <div className="relative">
                  {/* Skala */}
                  <div className="flex justify-between text-xs text-gray-600 mb-2">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </div>
                  
                  {/* Hauptbalken */}
                  <div className="relative h-8 bg-gray-300 rounded-full">
                    {/* Gradient für Bereiche */}
                    <div className="absolute inset-0 bg-gradient-to-r from-red-300 via-yellow-300 to-green-400 rounded-full opacity-70"></div>
                    
                    {/* Durchschnitt-Markierung */}
                    <div 
                      className="absolute top-0 w-1 h-8 bg-gray-600 rounded"
                      style={{ left: `${((positiveComparison.populationAverage - 1) / 4) * 100}%` }}
                    ></div>
                    <div 
                      className="absolute -top-6 text-xs text-gray-600 transform -translate-x-1/2"
                      style={{ left: `${((positiveComparison.populationAverage - 1) / 4) * 100}%` }}
                    >
                      ⌀ {positiveComparison.populationAverage.toFixed(1)}
                    </div>
                    
                    {/* User-Position */}
                    <div 
                      className="absolute top-0 w-3 h-8 bg-blue-600 rounded border-2 border-white"
                      style={{ left: `${((userProfile.Positiv - 1) / 4) * 100 - 1.5}%` }}
                    ></div>
                    <div 
                      className="absolute -bottom-6 text-sm text-blue-700 font-bold transform -translate-x-1/2"
                      style={{ left: `${((userProfile.Positiv - 1) / 4) * 100}%` }}
                    >
                      Du: {userProfile.Positiv.toFixed(1)}
                    </div>
                  </div>
                  
                  {/* Beschriftungen */}
                  <div className="flex justify-between text-xs text-gray-500 mt-8">
                    <span>Wenig Chancen</span>
                    <span>Mittlere Chancen</span>
                    <span>Große Chancen</span>
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <div className="text-sm text-blue-700">
                    Du stehst im <strong>{positiveComparison.percentile}. Perzentil</strong> - das heißt, 
                    {positiveComparison.percentile}% sehen weniger Chancen und {100 - positiveComparison.percentile}% sehen mehr Chancen als du.
                  </div>
                </div>
              </div>
              
              <p className="text-center text-sm text-gray-500 mt-4">
                Diese Skala zeigt deine Position bei der Wahrnehmung von KI-Potentialen im Vergleich zur gesamten Gruppe.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Synthese und Radar Chart */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-20 border-t border-blue-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">🎯 Dein vollständiges KI-Profil</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Skepsis und Optimismus schließen sich nicht aus. Hier siehst du beide Aspekte deiner KI-Haltung im Überblick.
            </p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg border border-blue-200">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-xl font-semibold mb-6 text-gray-800">Deine KI-Haltung im Detail</h3>
                
                {/* Skepsis Skala */}
                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">🔍 KI-Skepsis (Risikowahrnehmung)</h4>
                  <div className="relative">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>1</span>
                      <span>2</span>
                      <span>3</span>
                      <span>4</span>
                      <span>5</span>
                    </div>
                    
                    <div className="relative h-6 bg-gray-200 rounded-full">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-300 via-yellow-300 to-red-400 rounded-full opacity-60"></div>
                      
                      {/* Durchschnitt */}
                      <div 
                        className="absolute top-0 w-0.5 h-6 bg-gray-600"
                        style={{ left: `${((negativeComparison.populationAverage - 1) / 4) * 100}%` }}
                      ></div>
                      <div 
                        className="absolute -top-5 text-xs text-gray-600 transform -translate-x-1/2"
                        style={{ left: `${((negativeComparison.populationAverage - 1) / 4) * 100}%` }}
                      >
                        ⌀
                      </div>
                      
                      {/* User Position */}
                      <div 
                        className="absolute top-0 w-2 h-6 bg-blue-600 rounded border border-white"
                        style={{ left: `${((userProfile.Negativ - 1) / 4) * 100 - 1}%` }}
                      ></div>
                      <div 
                        className="absolute -bottom-5 text-xs text-blue-700 font-bold transform -translate-x-1/2"
                        style={{ left: `${((userProfile.Negativ - 1) / 4) * 100}%` }}
                      >
                        {userProfile.Negativ.toFixed(1)}
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500 mt-6">
                      <span>Wenig Bedenken</span>
                      <span>Große Bedenken</span>
                    </div>
                  </div>
                </div>

                {/* Optimismus Skala */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">🌟 KI-Optimismus (Chancenwahrnehmung)</h4>
                  <div className="relative">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>1</span>
                      <span>2</span>
                      <span>3</span>
                      <span>4</span>
                      <span>5</span>
                    </div>
                    
                    <div className="relative h-6 bg-gray-200 rounded-full">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-300 via-yellow-300 to-green-400 rounded-full opacity-60"></div>
                      
                      {/* Durchschnitt */}
                      <div 
                        className="absolute top-0 w-0.5 h-6 bg-gray-600"
                        style={{ left: `${((positiveComparison.populationAverage - 1) / 4) * 100}%` }}
                      ></div>
                      <div 
                        className="absolute -top-5 text-xs text-gray-600 transform -translate-x-1/2"
                        style={{ left: `${((positiveComparison.populationAverage - 1) / 4) * 100}%` }}
                      >
                        ⌀
                      </div>
                      
                      {/* User Position */}
                      <div 
                        className="absolute top-0 w-2 h-6 bg-blue-600 rounded border border-white"
                        style={{ left: `${((userProfile.Positiv - 1) / 4) * 100 - 1}%` }}
                      ></div>
                      <div 
                        className="absolute -bottom-5 text-xs text-blue-700 font-bold transform -translate-x-1/2"
                        style={{ left: `${((userProfile.Positiv - 1) / 4) * 100}%` }}
                      >
                        {userProfile.Positiv.toFixed(1)}
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500 mt-6">
                      <span>Wenig Chancen</span>
                      <span>Große Chancen</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-3 bg-blue-50 rounded text-center">
                  <p className="text-xs text-blue-700">
                    <span className="font-semibold">Legende:</span> Dünne Linie = Durchschnitt aller | Blauer Balken = Deine Position
                  </p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-3">Interpretation deiner Haltung</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {userProfile.Negativ > 3.5 && userProfile.Positiv > 3.5 ? 
                      "Du zeigst eine differenzierte Sichtweise: Du erkennst sowohl Chancen als auch Risiken der KI. Diese ausgewogene Betrachtung ist sehr wertvoll für fundierte Entscheidungen." :
                    userProfile.Negativ > 3.5 ? 
                      "Du gehst vorsichtig an KI heran und achtest besonders auf mögliche Risiken. Diese kritische Haltung ist wichtig für den verantwortungsvollen Umgang mit der Technologie." :
                    userProfile.Positiv > 3.5 ?
                      "Du siehst großes Potential in KI und bist offen für ihre Möglichkeiten. Diese positive Grundhaltung ermöglicht Innovation und Fortschritt." :
                      "Du hast eine ausgewogene, besonnene Haltung zu KI - weder übermäßig skeptisch noch unkritisch optimistisch. Diese Besonnenheit ist sehr vernünftig."
                    }
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-slate-100 rounded-lg border border-slate-200">
                    <div className="text-2xl font-bold text-slate-600">
                      {negativeComparison.percentile}%
                    </div>
                    <div className="text-sm text-slate-700">
                      sind weniger skeptisch als du
                    </div>
                  </div>
                  
                  <div className="text-center p-4 bg-blue-100 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">
                      {positiveComparison.percentile}%
                    </div>
                    <div className="text-sm text-blue-700">
                      sehen weniger Chancen als du
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Zusammenfassung der wichtigsten Erkenntnisse */}
      <section className="bg-gray-50 py-20 border-t border-blue-100">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4 text-gray-800">🏆 Deine wichtigsten Erkenntnisse</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Hier sind die fünf wichtigsten Punkte über deine KI-Haltung zusammengefasst.
          </p>
          
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold text-blue-600 bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">1</div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Dein KI-Typ: {insights.kiType}</h3>
                  <p className="text-gray-600">Beschreibt deine grundlegende Haltung gegenüber KI</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold text-blue-600 bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">2</div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Ausgeprägter als {Math.max(positiveComparison.percentile, negativeComparison.percentile)}% der anderen
                  </h3>
                  <p className="text-gray-600">Deine KI-Haltung ist klarer ausgeprägt als bei den meisten anderen</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold text-blue-600 bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">3</div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {insights.rarityScore}% Einzigartigkeit
                  </h3>
                  <p className="text-gray-600">
                    {insights.rarityScore > 70 ? "Deine KI-Haltung ist sehr individuell und selten" : "Du gehörst zu einer besonderen Gruppe mit ähnlichen Ansichten"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold text-blue-600 bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">4</div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Position #{insights.generationRank} in Generation {userDemo.age}
                  </h3>
                  <p className="text-gray-600">
                    {insights.generationRank <= 3 ? "Du gehörst zu den Top 3 in deiner Altersgruppe" : "Du liegst im typischen Bereich deiner Generation"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold text-blue-600 bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">5</div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {insights.consistencyScore}% Konsistenz
                  </h3>
                  <p className="text-gray-600">
                    {insights.consistencyScore > 60 ? "Du zeigst eine sehr einheitliche Haltung" : "Du differenzierst je nach Kontext"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Zukunftsausblick */}
      <section className="bg-blue-50 py-16 border-t border-blue-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-8 text-gray-800">🔮 Deine KI-Zukunft</h2>
          
          <div className="bg-white rounded-3xl p-8 mb-8 shadow-lg border border-blue-200">
            <div className="text-5xl mb-6">🌟</div>
            <h3 className="text-2xl font-bold mb-4 text-blue-800">Was deine Haltung bedeutet</h3>
            <p className="text-lg text-gray-700 leading-relaxed max-w-2xl mx-auto">
              {insights.kiType === "Der Komplexe" && userProfile.Positiv > 3.5 ? 
                "Du wirst wahrscheinlich zu den frühen, aber besonnenen KI-Anwendern gehören. Deine differenzierte Sichtweise macht dich zu einer wertvollen Stimme in KI-Diskussionen." :
              insights.kiType === "Der Optimist" ? 
                "Du wirst wahrscheinlich zu den ersten gehören, die neue KI-Möglichkeiten erkunden und nutzen. Deine Offenheit ermöglicht Innovation." :
              insights.kiType === "Der Skeptiker" ? 
                "Du wirst eine wichtige Rolle als kritische Stimme spielen und dabei helfen, KI verantwortungsvoll zu entwickeln und einzusetzen." :
              userProfile.Positiv > 3.8 ? 
                "Deine positive Einstellung macht dich zu einem wichtigen Vermittler für KI-Potentiale in deinem Umfeld." :
                "Deine ausgewogene Haltung wird dabei helfen, durchdachte und nachhaltige KI-Lösungen zu schaffen."}
            </p>
          </div>

          <div className="bg-blue-100 rounded-2xl p-6 border border-blue-200">
            <h4 className="text-xl font-bold text-blue-800 mb-3">💡 Wusstest du?</h4>
            <p className="text-lg text-blue-900">
              Menschen mit deinem KI-Profil ({insights.kiType}) zeichnen sich besonders dadurch aus, dass sie
              {insights.kiType === "Der Komplexe" ? " sowohl Chancen als auch Risiken gut abwägen können" :
               insights.kiType === "Der Optimist" ? " andere für die Möglichkeiten neuer Technologien begeistern" :
               insights.kiType === "Der Skeptiker" ? " wichtige Sicherheitsaspekte und Risiken frühzeitig erkennen" :
               " ausgewogene und nachhaltige technologische Lösungen entwickeln"}.
            </p>
          </div>
        </div>
      </section>

      {/* Ergebnisse teilen */}
      <section className="bg-white py-16 border-t border-blue-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-8 text-gray-800">📤 Deine Ergebnisse</h2>
          
          <div className="bg-blue-50 rounded-2xl p-8 mb-8 border border-blue-200">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-2xl font-bold mb-6 text-blue-800">Zusammenfassung deiner KI-Haltung</h3>
            <div className="grid grid-cols-2 gap-4 text-sm max-w-md mx-auto">
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="text-blue-600 font-semibold">KI-Typ</div>
                <div className="font-bold text-gray-800">{insights.kiType}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="text-blue-600 font-semibold">Ausgeprägter als</div>
                <div className="font-bold text-gray-800">{Math.max(positiveComparison.percentile, negativeComparison.percentile)}%</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="text-blue-600 font-semibold">Einzigartigkeit</div>
                <div className="font-bold text-gray-800">{insights.rarityScore}%</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="text-blue-600 font-semibold">Generation</div>
                <div className="font-bold text-gray-800">#{insights.generationRank}</div>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            <p className="mb-2">🔗 Link zu deinen persönlichen Ergebnissen:</p>
            <div className="bg-gray-100 px-4 py-2 rounded border border-gray-200 text-blue-600 font-mono text-xs break-all">
              {typeof window !== 'undefined' ? window.location.href : '/auswertung-neu?response_id=' + responseId}
            </div>
          </div>
        </div>
      </section>

      {/* Fazit */}
      <section className="bg-gradient-to-b from-slate-900 via-gray-900 to-black text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 mb-12 transform hover:scale-105 transition-all duration-300">
            <div className="text-6xl mb-6">🎭</div>
            <h2 className="text-4xl font-bold mb-6 text-purple-100">Das Fazit deiner KI-Reise</h2>
            <p className="text-xl text-purple-200 mb-8 max-w-3xl mx-auto leading-relaxed">
              Als <strong className="text-yellow-300">{insights.kiType}</strong> mit einem <strong className="text-yellow-300">{insights.rarityScore}% Seltenheitswert</strong> 
              bringst du eine einzigartige Perspektive in die KI-Diskussion ein. 
              Du stehst an <strong className="text-yellow-300">Position #{Math.min(insights.generationRank, insights.roleRank)}</strong> in deiner Peer-Gruppe 
              und zeigst damit, dass du KI wirklich durchdacht betrachtest.
            </p>
            
            <div className="bg-black/20 rounded-2xl p-6 mb-6">
              <h3 className="text-2xl font-bold text-cyan-300 mb-4">Deine KI-Superkraft</h3>
              <p className="text-lg text-cyan-100">
                {insights.kiType === "Der Komplexe" ? "Du kannst sowohl Chancen als auch Risiken gleichzeitig sehen - das macht dich zu einem wertvollen Berater in KI-Entscheidungen." :
                 insights.kiType === "Der Optimist" ? "Deine positive Energie und Offenheit machen dich zum perfekten KI-Botschafter und Early Adopter." :
                 insights.kiType === "Der Skeptiker" ? "Deine kritische Analyse hilft dabei, KI verantwortungsvoll und sicher zu implementieren." :
                 insights.kiType === "Der Ausgewogene" ? "Deine ausgewogene Sichtweise macht dich zum idealen Vermittler zwischen KI-Enthusiasten und -Skeptikern." :
                 "Deine durchdachte und nuancierte Herangehensweise bringt Stabilität in schnelllebige KI-Diskussionen."}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-gradient-to-b from-emerald-700 to-teal-800 rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">🌱</div>
              <h4 className="text-lg font-bold text-emerald-200 mb-2">Deine Rolle</h4>
              <p className="text-emerald-100 text-sm">
                In der KI-Zukunft wirst du als {insights.kiType} eine wichtige Stimme sein.
              </p>
            </div>
            
            <div className="bg-gradient-to-b from-blue-700 to-indigo-800 rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">🤝</div>
              <h4 className="text-lg font-bold text-blue-200 mb-2">Gemeinsam stark</h4>
              <p className="text-blue-100 text-sm">
                Alle Perspektiven - von skeptisch bis optimistisch - sind wichtig für eine verantwortungsvolle KI-Entwicklung.
              </p>
            </div>
            
            <div className="bg-gradient-to-b from-purple-700 to-pink-800 rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">🚀</div>
              <h4 className="text-lg font-bold text-purple-200 mb-2">Weiter lernen</h4>
              <p className="text-purple-100 text-sm">
                Deine Haltung wird sich weiterentwickeln - und das ist gut so! Bleib neugierig.
              </p>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-slate-800 to-gray-800 rounded-2xl p-8 border border-gray-600">
            <div className="text-4xl mb-4">🙏</div>
            <h3 className="text-2xl font-bold text-gray-200 mb-4">Danke für deine Teilnahme!</h3>
            <p className="text-gray-300 text-lg mb-4">
              Mit deinen Antworten hilfst du uns zu verstehen, wie Menschen über KI denken. 
              Diese Forschung trägt zu einer besseren und verantwortungsvolleren KI-Zukunft bei.
            </p>
            <div className="flex justify-center gap-4 text-sm text-gray-400">
              <span>✨ Insights generiert</span>
              <span>📊 Daten analysiert</span>
              <span>🧠 Wissen erweitert</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function AuswertungNeuPage() {
  return (
    <Suspense fallback={<div className="text-center p-8">Lade deine KI-Haltungsanalyse...</div>}>
      <AuswertungNeuContent />
    </Suspense>
  );
} 