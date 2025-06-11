"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import { BarChart, Bar, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, LineChart, Line } from "recharts";

// Typdefinitionen
interface Answer {
  value: number;
  items: { category: string } | null;
}
interface Profile {
  Positiv: number;
  Negativ: number;
}
interface ProfileChartData {
  subject: string;
  user: number;
  average: number;
}

// Neue Interface für Ranglisten
interface RankingItem {
  group: string;
  score: number;
  count: number;
}

interface ExtendedAnswer extends Answer {
  response_id: number;
  responses: {
    role: string;
    school_level: string;
    age: string;
    experience: string;
  } | null;
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
      // Annahme: Negative Items sind umgekehrt skaliert. Eine 5 ist hier eine 1 in der Haltung.
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

// Hilfsfunktion zur Altersgruppen-Konvertierung
const convertToAgeGroup = (ageValue: string | null): string | null => {
  if (!ageValue) return null;
  
  // Bereits eine Kategorie
  if (['unter 25', '25-34', '35-44', '45-54', '55-64', '65+'].includes(ageValue)) {
    return ageValue;
  }
  
  // Numerischer Wert - konvertiere zu Kategorie
  const numAge = parseInt(ageValue);
  if (isNaN(numAge)) return null;
  
  if (numAge < 25) return 'unter 25';
  if (numAge >= 25 && numAge <= 34) return '25-34';
  if (numAge >= 35 && numAge <= 44) return '35-44';
  if (numAge >= 45 && numAge <= 54) return '45-54';
  if (numAge >= 55 && numAge <= 64) return '55-64';
  if (numAge >= 65) return '65+';
  
  return null;
};

// Hilfsfunktion zur Berufserfahrungs-Konvertierung
const convertToExperienceGroup = (experienceValue: string | null): string | null => {
  if (!experienceValue) return null;
  
  // Bereits eine Kategorie
  if (['0-5', '6-10', '11-15', '16-20', '21-30', '31+'].includes(experienceValue)) {
    return experienceValue;
  }
  
  // Numerischer Wert - konvertiere zu Kategorie
  const numExp = parseInt(experienceValue);
  if (isNaN(numExp)) return null;
  
  if (numExp >= 0 && numExp <= 5) return '0-5';
  if (numExp >= 6 && numExp <= 10) return '6-10';
  if (numExp >= 11 && numExp <= 15) return '11-15';
  if (numExp >= 16 && numExp <= 20) return '16-20';
  if (numExp >= 21 && numExp <= 30) return '21-30';
  if (numExp >= 31) return '31+';
  
  return null;
};

export default function AuswertungPage() {
  const searchParams = useSearchParams();
  const responseId = searchParams.get("response_id");
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [averageProfile, setAverageProfile] = useState<Profile | null>(null);
  const [rankings, setRankings] = useState<{
    rolePositive: RankingItem[];
    roleNegative: RankingItem[];
    schoolPositive: RankingItem[];
    schoolNegative: RankingItem[];
  } | null>(null);
  const [ageData, setAgeData] = useState<{
    group: string;
    positive: number;
    negative: number;
    count: number;
  }[] | null>(null);
  const [experienceData, setExperienceData] = useState<{
    group: string;
    positive: number;
    negative: number;
    count: number;
  }[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!responseId) {
        setLoading(false);
        return;
      }

      // Erweiterte Datenabfrage für Ranglisten
      const { data: allAnswersWithDemo, error: answersError } = await supabase
        .from("answers")
        .select(`
          value, 
          response_id,
          items ( category ),
          responses ( role, school_level, age, experience )
        `);

      if (answersError) {
        setLoading(false);
        return;
      }
      
       const { data: userAnswersData, error: userAnswersError } = await supabase
       .from("answers")
       .select(`value, items ( category )`)
       .eq('response_id', responseId);

      if (userAnswersError) {
        setLoading(false);
        return;
      }

      const userAnswers: Answer[] = userAnswersData as any;
      const allAnswersTyped: Answer[] = allAnswersWithDemo as any;
      const extendedAnswers: ExtendedAnswer[] = allAnswersWithDemo as any;
      
      console.log('Extended answers sample:', extendedAnswers.slice(0, 3));
      console.log('Extended answers length:', extendedAnswers.length);
      
      // Debug: Prüfe age Feld
      const samplesWithAge = extendedAnswers.slice(0, 5).map(answer => ({
        response_id: answer.response_id,
        age: answer.responses?.age,
        role: answer.responses?.role,
        school_level: answer.responses?.school_level
      }));
      console.log('Samples with age field:', samplesWithAge);
      
      const calculatedUserProfile = calculateProfile(userAnswers);
      const calculatedAverageProfile = calculateProfile(allAnswersTyped);
      
      // Berechnung der Ranglisten
      const calculateRankings = () => {
        // Gruppierung der Antworten nach Personen (response_id)
        const personData: { [response_id: string]: { 
          role: string; 
          schoolLevel: string; 
          age: string;
          positiveAnswers: number[]; 
          negativeAnswers: number[]; 
        } } = {};
        
        extendedAnswers.forEach(answer => {
          if (!answer.responses || !answer.items?.category) return;
          
          const responseId = answer.response_id?.toString() || 'unknown';
          const role = answer.responses.role;
          const schoolLevel = answer.responses.school_level;
          const age = answer.responses.age;
          const category = answer.items.category;
          
          if (category !== 'Positiv' && category !== 'Negativ') return;
          
          if (!personData[responseId]) {
            personData[responseId] = {
              role,
              schoolLevel,
              age,
              positiveAnswers: [],
              negativeAnswers: []
            };
          }
          
          const value = category === 'Negativ' ? 6 - answer.value : answer.value;
          
          if (category === 'Positiv') {
            personData[responseId].positiveAnswers.push(value);
          } else {
            personData[responseId].negativeAnswers.push(value);
          }
        });
        
        // Gruppierung nach Rolle und Schulstufe
        const groupedData: { [key: string]: { 
          positiveScores: number[]; 
          negativeScores: number[]; 
        } } = {};
        
        Object.values(personData).forEach(person => {
          // Berechne Durchschnittswerte pro Person
          const positiveAvg = person.positiveAnswers.length > 0 
            ? person.positiveAnswers.reduce((a, b) => a + b, 0) / person.positiveAnswers.length 
            : null;
          const negativeAvg = person.negativeAnswers.length > 0 
            ? person.negativeAnswers.reduce((a, b) => a + b, 0) / person.negativeAnswers.length 
            : null;
          
          // Gruppierung nach Rolle
          const roleKey = `role_${person.role}`;
          if (!groupedData[roleKey]) {
            groupedData[roleKey] = { positiveScores: [], negativeScores: [] };
          }
          
          // Gruppierung nach Schulstufe
          const schoolKey = `school_${person.schoolLevel}`;
          if (!groupedData[schoolKey]) {
            groupedData[schoolKey] = { positiveScores: [], negativeScores: [] };
          }
          
          if (positiveAvg !== null) {
            groupedData[roleKey].positiveScores.push(positiveAvg);
            groupedData[schoolKey].positiveScores.push(positiveAvg);
          }
          
          if (negativeAvg !== null) {
            groupedData[roleKey].negativeScores.push(negativeAvg);
            groupedData[schoolKey].negativeScores.push(negativeAvg);
          }
        });
        
        // Durchschnittswerte berechnen und Ranglisten erstellen
        const rolePositive: RankingItem[] = [];
        const roleNegative: RankingItem[] = [];
        const schoolPositive: RankingItem[] = [];
        const schoolNegative: RankingItem[] = [];
        
        Object.entries(groupedData).forEach(([key, data]) => {
          const isRole = key.startsWith('role_');
          const group = key.replace('role_', '').replace('school_', '');
          
          if (data.positiveScores.length >= 1) { // Mindestens 1 Person (reduziert von 2)
            const positiveScore = data.positiveScores.reduce((a, b) => a + b, 0) / data.positiveScores.length;
            const item = { group, score: positiveScore, count: data.positiveScores.length };
            
            if (isRole) rolePositive.push(item);
            else schoolPositive.push(item);
          }
          
          if (data.negativeScores.length >= 1) { // Mindestens 1 Person (reduziert von 2)
            const negativeScore = data.negativeScores.reduce((a, b) => a + b, 0) / data.negativeScores.length;
            const item = { group, score: negativeScore, count: data.negativeScores.length };
            
            if (isRole) roleNegative.push(item);
            else schoolNegative.push(item);
          }
        });
        
        console.log('Rankings calculated:', {
          rolePositive,
          roleNegative,
          schoolPositive,
          schoolNegative
        });
        
        return {
          rolePositive: rolePositive.sort((a, b) => b.score - a.score),
          roleNegative: roleNegative.sort((a, b) => b.score - a.score),
          schoolPositive: schoolPositive.sort((a, b) => b.score - a.score),
          schoolNegative: schoolNegative.sort((a, b) => b.score - a.score),
        };
      };
      
      // Berechnung der Alters-Trend-Daten
      const calculateAgeData = () => {
        // Gruppierung der Antworten nach Personen (response_id)
        const personData: { [response_id: string]: { 
          age: string;
          positiveAnswers: number[]; 
          negativeAnswers: number[]; 
        } } = {};
        
        console.log('Starting calculateAgeData, processing', extendedAnswers.length, 'answers');
        
        extendedAnswers.forEach(answer => {
          if (!answer.responses || !answer.items?.category || !answer.response_id) {
            console.log('Skipping answer - missing data:', {
              hasResponses: !!answer.responses,
              hasCategory: !!answer.items?.category,
              hasResponseId: !!answer.response_id
            });
            return;
          }
          
          const responseId = answer.response_id.toString();
          const rawAge = answer.responses.age;
          const ageGroup = convertToAgeGroup(rawAge);
          const category = answer.items.category;
          
          console.log('Processing answer:', { responseId, rawAge, ageGroup, category });
          
          if (category !== 'Positiv' && category !== 'Negativ') return;
          if (!ageGroup) return; // Überspringe Einträge ohne gültige Altersgruppe
          
          if (!personData[responseId]) {
            personData[responseId] = {
              age: ageGroup,
              positiveAnswers: [],
              negativeAnswers: []
            };
          }
          
          const value = category === 'Negativ' ? 6 - answer.value : answer.value;
          
          if (category === 'Positiv') {
            personData[responseId].positiveAnswers.push(value);
          } else {
            personData[responseId].negativeAnswers.push(value);
          }
        });
        
        console.log('PersonData after processing:', Object.keys(personData).length, 'persons');
        console.log('Sample person data:', Object.values(personData).slice(0, 2));
        
        // Gruppierung nach Altersgruppen
        const ageGroups: { [key: string]: { 
          positiveScores: number[]; 
          negativeScores: number[]; 
        } } = {};
        
        // Definiere die Reihenfolge der Altersgruppen
        const ageOrder = ['unter 25', '25-34', '35-44', '45-54', '55-64', '65+'];
        
        Object.values(personData).forEach(person => {
          if (!person.age) return;
          
          // Berechne Durchschnittswerte pro Person
          const positiveAvg = person.positiveAnswers.length > 0 
            ? person.positiveAnswers.reduce((a, b) => a + b, 0) / person.positiveAnswers.length 
            : null;
          const negativeAvg = person.negativeAnswers.length > 0 
            ? person.negativeAnswers.reduce((a, b) => a + b, 0) / person.negativeAnswers.length 
            : null;
          
          if (!ageGroups[person.age]) {
            ageGroups[person.age] = { positiveScores: [], negativeScores: [] };
          }
          
          if (positiveAvg !== null) {
            ageGroups[person.age].positiveScores.push(positiveAvg);
          }
          
          if (negativeAvg !== null) {
            ageGroups[person.age].negativeScores.push(negativeAvg);
          }
        });
        
        // Erstelle sortierte Daten für die Grafik
        return ageOrder.map(ageGroup => {
          const data = ageGroups[ageGroup] || { positiveScores: [], negativeScores: [] };
          
          const positive = data.positiveScores.length > 0 
            ? data.positiveScores.reduce((a, b) => a + b, 0) / data.positiveScores.length 
            : null;
          const negative = data.negativeScores.length > 0 
            ? data.negativeScores.reduce((a, b) => a + b, 0) / data.negativeScores.length 
            : null;
          
          return {
            group: ageGroup,
            positive: positive || 0,
            negative: negative || 0,
            count: Math.max(data.positiveScores.length, data.negativeScores.length)
          };
        }).filter(item => item.count >= 1); // Mindestens 1 Person
      };
      
      // Berechnung der Berufserfahrungs-Trend-Daten
      const calculateExperienceData = () => {
        // Gruppierung der Antworten nach Personen (response_id)
        const personData: { [response_id: string]: { 
          experience: string;
          positiveAnswers: number[]; 
          negativeAnswers: number[]; 
        } } = {};
        
        console.log('Starting calculateExperienceData, processing', extendedAnswers.length, 'answers');
        
        extendedAnswers.forEach(answer => {
          if (!answer.responses || !answer.items?.category || !answer.response_id) {
            return;
          }
          
          const responseId = answer.response_id.toString();
          const rawExperience = answer.responses.experience; // Achtung: Das muss experience sein!
          const experienceGroup = convertToExperienceGroup(rawExperience);
          const category = answer.items.category;
          
          if (category !== 'Positiv' && category !== 'Negativ') return;
          if (!experienceGroup) return;
          
          if (!personData[responseId]) {
            personData[responseId] = {
              experience: experienceGroup,
              positiveAnswers: [],
              negativeAnswers: []
            };
          }
          
          const value = category === 'Negativ' ? 6 - answer.value : answer.value;
          
          if (category === 'Positiv') {
            personData[responseId].positiveAnswers.push(value);
          } else {
            personData[responseId].negativeAnswers.push(value);
          }
        });
        
        // Gruppierung nach Berufserfahrungs-Gruppen
        const experienceGroups: { [key: string]: { 
          positiveScores: number[]; 
          negativeScores: number[]; 
        } } = {};
        
        // Definiere die Reihenfolge der Berufserfahrungs-Gruppen
        const experienceOrder = ['0-5', '6-10', '11-15', '16-20', '21-30', '31+'];
        
        Object.values(personData).forEach(person => {
          if (!person.experience) return;
          
          // Berechne Durchschnittswerte pro Person
          const positiveAvg = person.positiveAnswers.length > 0 
            ? person.positiveAnswers.reduce((a, b) => a + b, 0) / person.positiveAnswers.length 
            : null;
          const negativeAvg = person.negativeAnswers.length > 0 
            ? person.negativeAnswers.reduce((a, b) => a + b, 0) / person.negativeAnswers.length 
            : null;
          
          if (!experienceGroups[person.experience]) {
            experienceGroups[person.experience] = { positiveScores: [], negativeScores: [] };
          }
          
          if (positiveAvg !== null) {
            experienceGroups[person.experience].positiveScores.push(positiveAvg);
          }
          
          if (negativeAvg !== null) {
            experienceGroups[person.experience].negativeScores.push(negativeAvg);
          }
        });
        
        // Erstelle sortierte Daten für die Grafik
        return experienceOrder.map(experienceGroup => {
          const data = experienceGroups[experienceGroup] || { positiveScores: [], negativeScores: [] };
          
          const positive = data.positiveScores.length > 0 
            ? data.positiveScores.reduce((a, b) => a + b, 0) / data.positiveScores.length 
            : null;
          const negative = data.negativeScores.length > 0 
            ? data.negativeScores.reduce((a, b) => a + b, 0) / data.negativeScores.length 
            : null;
          
          return {
            group: experienceGroup + ' Jahre',
            positive: positive || 0,
            negative: negative || 0,
            count: Math.max(data.positiveScores.length, data.negativeScores.length)
          };
        }).filter(item => item.count >= 1); // Mindestens 1 Person
      };
      
      setUserProfile(calculatedUserProfile);
      setAverageProfile(calculatedAverageProfile);
      setRankings(calculateRankings());
      const calculatedAgeData = calculateAgeData();
      console.log('Calculated age data:', calculatedAgeData);
      setAgeData(calculatedAgeData);
      const calculatedExperienceData = calculateExperienceData();
      console.log('Calculated experience data:', calculatedExperienceData);
      setExperienceData(calculatedExperienceData);
      setLoading(false);
    }
    fetchData();
  }, [responseId]);
  
  if (loading) return <main className="text-center p-8">Lade Auswertung...</main>;
  if (!userProfile || !averageProfile) return <main className="text-center p-8">Fehler bei der Auswertung. Bitte den Test erneut durchführen.</main>;
  
  const profileChartData: ProfileChartData[] = [
      { subject: 'Positive Haltung', user: userProfile.Positiv, average: averageProfile.Positiv },
      { subject: 'Negative Haltung', user: userProfile.Negativ, average: averageProfile.Negativ },
  ];
  
  const overallUserAvg = (userProfile.Positiv + userProfile.Negativ) / 2;
  const overallAverageAvg = (averageProfile.Positiv + averageProfile.Negativ) / 2;

  const overallBarData = [
      { name: "Gesamthaltung", "Dein Score": overallUserAvg.toFixed(2), "Durchschnitt": overallAverageAvg.toFixed(2) }
  ];

  // Neue Datenstruktur für die Plus-Minus-Grafik - kombinierte Werte
  const plusMinusData = [
    {
      name: 'Deine Haltung',
      value: userProfile.Positiv, // Positiver Wert
    },
    {
      name: 'Deine Haltung',
      value: -userProfile.Negativ, // Negativer Wert
    },
  ];

  // Werte für die Durchschnittslinien
  const avgPositiv = averageProfile.Positiv;
  const avgNegativ = -averageProfile.Negativ;

  return (
    <main className="max-w-5xl mx-auto p-4">
      <h2 className="text-3xl font-bold mb-6 text-center">Deine persönliche Auswertung</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4 text-center">Dein Einstellungsprofil</h3>
           <ResponsiveContainer width="100%" height={300}>
            <BarChart data={profileChartData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" domain={[1, 5]} />
                <YAxis type="category" dataKey="subject" width={110} />
                <Tooltip />
                <Legend />
                <Bar name="Dein Profil" dataKey="user" fill="#8884d8" />
                <Bar name="Durchschnitt" dataKey="average" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4 text-center">Gesamtwertung im Vergleich</h3>
          <ResponsiveContainer width="100%" height={300}>
             <BarChart data={overallBarData} layout="vertical">
                <XAxis type="number" domain={[1, 5]} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Dein Score" fill="#8884d8" />
                <Bar dataKey="Durchschnitt" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Neue Plus-Minus-Grafik */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h3 className="text-xl font-semibold mb-4 text-center">Haltungs-Bilanz: Plus-Minus-Grafik</h3>
        <div className="flex justify-center">
          <div className="w-full max-w-4xl" style={{ height: '150px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[{ name: 'Haltung', positiv: userProfile.Positiv, negativ: -userProfile.Negativ }]}
                layout="vertical"
                margin={{ left: 80, right: 80, top: 30, bottom: 30 }}
              >
                <XAxis type="number" domain={[-5, 5]} ticks={[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]} />
                <YAxis type="category" dataKey="name" width={60} />
                <Tooltip />
                {/* Positiver Balken (von 0 nach rechts) */}
                <Bar 
                  dataKey="positiv" 
                  fill="#4f8cff" 
                  name="Positive Haltung"
                  barSize={40}
                />
                {/* Negativer Balken (von 0 nach links) */}
                <Bar 
                  dataKey="negativ" 
                  fill="#ff6b6b" 
                  name="Negative Haltung"
                  barSize={40}
                />
                {/* Durchschnittslinien */}
                <ReferenceLine x={avgPositiv} stroke="#111" strokeWidth={2} strokeDasharray="4 2" />
                <ReferenceLine x={avgNegativ} stroke="#111" strokeWidth={2} strokeDasharray="4 2" />
                {/* Mittelachse */}
                <ReferenceLine x={0} stroke="#000" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mt-2 max-w-4xl mx-auto">
          <span>Durchschnitt Negativ: {averageProfile.Negativ.toFixed(2)}</span>
          <span>Durchschnitt Positiv: {averageProfile.Positiv.toFixed(2)}</span>
        </div>
        <div className="text-center text-sm text-gray-500 mt-2">Links: Negative Haltung | Rechts: Positive Haltung</div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">Was bedeutet das?</h3>
          <p className="text-gray-700">
              Dein Einstellungsprofil zeigt deine Tendenz zu positiven und negativen Annahmen über KI.
              Ein hoher Wert bei <strong>'Positive Haltung'</strong> ({userProfile.Positiv.toFixed(2)}) deutet darauf hin, dass du Chancen und Nutzen in der KI siehst.
              Ein hoher Wert bei <strong>'Negative Haltung'</strong> ({userProfile.Negativ.toFixed(2)}) spiegelt eher Bedenken und Skepsis wider (nach Umpolung).
              Im Vergleich zum Durchschnitt kannst du deine eigene Position einordnen.
          </p>
      </div>

      {/* Ranglisten */}
      {rankings && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Ranglisten der Haltungen</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Berufsgruppen - Positive Haltungen */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4 text-center text-blue-600">Berufsgruppen: Positivste Haltungen</h3>
              <div className="space-y-3">
                {rankings.rolePositive.slice(0, 5).map((item, index) => (
                  <div key={item.group} className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <div className="flex items-center">
                      <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                        {index + 1}
                      </span>
                      <span className="font-medium">{item.group}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">{item.score.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">({item.count} Personen)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Berufsgruppen - Negative Haltungen */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4 text-center text-red-600">Berufsgruppen: Kritischste Haltungen</h3>
              <div className="space-y-3">
                {rankings.roleNegative.slice(0, 5).map((item, index) => (
                  <div key={item.group} className="flex justify-between items-center p-3 bg-red-50 rounded">
                    <div className="flex items-center">
                      <span className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                        {index + 1}
                      </span>
                      <span className="font-medium">{item.group}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600">{item.score.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">({item.count} Personen)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Schulstufen - Positive Haltungen */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4 text-center text-green-600">Schulstufen: Positivste Haltungen</h3>
              <div className="space-y-3">
                {rankings.schoolPositive.slice(0, 5).map((item, index) => (
                  <div key={item.group} className="flex justify-between items-center p-3 bg-green-50 rounded">
                    <div className="flex items-center">
                      <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                        {index + 1}
                      </span>
                      <span className="font-medium">{item.group}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{item.score.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">({item.count} Personen)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Schulstufen - Negative Haltungen */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4 text-center text-orange-600">Schulstufen: Kritischste Haltungen</h3>
              <div className="space-y-3">
                {rankings.schoolNegative.slice(0, 5).map((item, index) => (
                  <div key={item.group} className="flex justify-between items-center p-3 bg-orange-50 rounded">
                    <div className="flex items-center">
                      <span className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                        {index + 1}
                      </span>
                      <span className="font-medium">{item.group}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-600">{item.score.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">({item.count} Personen)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alters-Trend-Grafik */}
      {(() => {
        console.log('ageData:', ageData);
        console.log('ageData length:', ageData?.length);
        console.log('Should show age chart:', ageData && ageData.length > 0);
        return null;
      })()}
      {ageData && ageData.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6 text-center">KI-Haltung nach Altersgruppen</h2>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 text-center">Trend: Einstellung zu KI über Altersgruppen</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={ageData}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <XAxis 
                  dataKey="group" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis 
                  domain={[1, 5]} 
                  label={{ value: 'KI-Haltung (Durchschnitt)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${Number(value).toFixed(2)}`, 
                    name === 'positive' ? 'Positive Haltung' : 'Negative Haltung'
                  ]}
                  labelFormatter={(label) => `Altersgruppe: ${label}`}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = ageData.find(item => item.group === label);
                      return (
                        <div className="bg-white p-3 border rounded shadow">
                          <p className="font-semibold">{`Altersgruppe: ${label}`}</p>
                          {payload.map((entry, index) => (
                            <p key={index} style={{ color: entry.color }}>
                              {`${entry.name}: ${Number(entry.value).toFixed(2)}`}
                            </p>
                          ))}
                          <p className="text-gray-500 text-sm">{`Anzahl Personen: ${data?.count || 0}`}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                
                {/* Linie für positive Haltungen */}
                <Line 
                  type="monotone" 
                  dataKey="positive" 
                  stroke="#4f8cff" 
                  strokeWidth={3}
                  dot={{ fill: '#4f8cff', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, fill: '#4f8cff' }}
                  name="Positive Haltung"
                />
                
                {/* Linie für negative Haltungen */}
                <Line 
                  type="monotone" 
                  dataKey="negative" 
                  stroke="#ff6b6b" 
                  strokeWidth={3}
                  dot={{ fill: '#ff6b6b', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, fill: '#ff6b6b' }}
                  name="Negative Haltung"
                />
              </LineChart>
            </ResponsiveContainer>
            
            <div className="mt-4 text-center text-sm text-gray-600">
              <p>Diese Grafik zeigt den Trend der KI-Haltungen über verschiedene Altersgruppen hinweg.</p>
              <p>Höhere Werte bedeuten positivere (blaue Linie) bzw. kritischere (rote Linie) Einstellungen.</p>
            </div>
          </div>
        </div>
      )}

      {/* Berufserfahrungs-Trend-Grafik */}
      {(() => {
        console.log('experienceData:', experienceData);
        console.log('experienceData length:', experienceData?.length);
        console.log('Should show experience chart:', experienceData && experienceData.length > 0);
        return null;
      })()}
      {experienceData && experienceData.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6 text-center">KI-Haltung nach Berufserfahrungsgruppen</h2>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 text-center">Trend: Einstellung zu KI über Berufserfahrungsgruppen</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={experienceData}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <XAxis 
                  dataKey="group" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis 
                  domain={[1, 5]} 
                  label={{ value: 'KI-Haltung (Durchschnitt)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${Number(value).toFixed(2)}`, 
                    name === 'positive' ? 'Positive Haltung' : 'Negative Haltung'
                  ]}
                  labelFormatter={(label) => `Berufserfahrungsgruppe: ${label}`}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = experienceData.find(item => item.group === label);
                      return (
                        <div className="bg-white p-3 border rounded shadow">
                          <p className="font-semibold">{`Berufserfahrungsgruppe: ${label}`}</p>
                          {payload.map((entry, index) => (
                            <p key={index} style={{ color: entry.color }}>
                              {`${entry.name}: ${Number(entry.value).toFixed(2)}`}
                            </p>
                          ))}
                          <p className="text-gray-500 text-sm">{`Anzahl Personen: ${data?.count || 0}`}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                
                {/* Linie für positive Haltungen */}
                <Line 
                  type="monotone" 
                  dataKey="positive" 
                  stroke="#4f8cff" 
                  strokeWidth={3}
                  dot={{ fill: '#4f8cff', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, fill: '#4f8cff' }}
                  name="Positive Haltung"
                />
                
                {/* Linie für negative Haltungen */}
                <Line 
                  type="monotone" 
                  dataKey="negative" 
                  stroke="#ff6b6b" 
                  strokeWidth={3}
                  dot={{ fill: '#ff6b6b', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, fill: '#ff6b6b' }}
                  name="Negative Haltung"
                />
              </LineChart>
            </ResponsiveContainer>
            
            <div className="mt-4 text-center text-sm text-gray-600">
              <p>Diese Grafik zeigt den Trend der KI-Haltungen über verschiedene Berufserfahrungsgruppen hinweg.</p>
              <p>Höhere Werte bedeuten positivere (blaue Linie) bzw. kritischere (rote Linie) Einstellungen.</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 