"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import * as ss from "simple-statistics";

// Typ-Definitionen
interface Item {
    id: number;
    text: string;
    category: 'Positiv' | 'Negativ' | 'Kontrolle';
}

interface Answer {
    value: number;
    item_id: number;
    responses: { id: string; gender: string } | null;
}

interface ItemStats {
    text: string;
    mean: string;
    stdDev: string;
}

interface AnalysisResult {
    itemStats: ItemStats[];
    cronbachsAlpha: {
        positive: number | null;
        negative: number | null;
    };
    tTest: {
        pValue: number | null;
        significant: boolean;
    };
}

interface Demographics {
    n: number;
    gender: Record<string, number>;
    age: { mean: string; stdDev: string };
    experience: { mean: string; stdDev: string };
}

// Statistische Hilfsfunktionen
function variance(arr: number[]): number {
    if (arr.length < 2) return 0;
    return ss.variance(arr);
}

function calculateCronbachsAlpha(itemMatrix: number[][]): number | null {
    const numItems = itemMatrix[0]?.length;
    if (!numItems || numItems < 2 || itemMatrix.length < 2) {
        return null;
    }

    const itemVariances = Array.from({ length: numItems }, (_, i) =>
        variance(itemMatrix.map(row => row[i]))
    );
    const sumOfItemVariances = ss.sum(itemVariances);

    const totalScores = itemMatrix.map(row => ss.sum(row));
    const totalVariance = variance(totalScores);

    if (totalVariance === 0) {
        return 1; // Perfekte Korrelation, keine Varianz
    }

    const alpha = (numItems / (numItems - 1)) * (1 - (sumOfItemVariances / totalVariance));
    return alpha;
}

export default function ForschungPage() {
    const [results, setResults] = useState<AnalysisResult | null>(null);
    const [demographics, setDemographics] = useState<Demographics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const runAnalysis = async () => {
            // 1. Alle benötigten Daten laden
            const { data: itemsData, error: itemsError } = await supabase.from("items").select('id, text, category');
            const { data: answersData, error: answersError } = await supabase.from("answers").select(`value, item_id, responses ( id, gender )`);
            const { data: responsesData, error: responsesError } = await supabase.from("responses").select('age, experience, gender');

            if (itemsError || answersError || responsesError || !itemsData || !answersData || !responsesData) {
                console.error("Daten-Ladefehler:", itemsError || answersError || responsesError);
                setLoading(false);
                return;
            }

            const items: Item[] = itemsData;
            const answers: Answer[] = answersData as unknown as Answer[];

            // 2. Deskriptive Statistiken
            const itemStats: ItemStats[] = items
                .filter(item => item.category !== 'Kontrolle')
                .map(item => {
                    const itemAnswers = answers.filter(a => a.item_id === item.id).map(a => a.value);
                    if (itemAnswers.length === 0) return { text: item.text, mean: 'N/A', stdDev: 'N/A' };
                    return {
                        text: item.text,
                        mean: ss.mean(itemAnswers).toFixed(2),
                        stdDev: ss.standardDeviation(itemAnswers).toFixed(2),
                    };
                });

            // 3. Antworten pro Teilnehmer gruppieren
            const responsesByParticipant = answers.reduce((acc, answer) => {
                const responseId = answer.responses?.id;
                if (!responseId) return acc;
                if (!acc[responseId]) {
                    acc[responseId] = { gender: answer.responses?.gender || 'unbekannt', answers: [] };
                }
                acc[responseId].answers.push({ item_id: answer.item_id, value: answer.value });
                return acc;
            }, {} as Record<string, { gender: string; answers: { item_id: number; value: number }[] }>);

            // 4. Cronbachs Alpha berechnen
            const getAlphaForCategory = (category: 'Positiv' | 'Negativ') => {
                const categoryItems = items.filter(item => item.category === category);
                const itemMatrix = Object.values(responsesByParticipant).map(p =>
                    categoryItems.map(item => {
                        const answer = p.answers.find(a => a.item_id === item.id);
                        // Umpolen, falls nötig. Annahme: 'Negativ' Items sind umgepolt für Konsistenz
                        if (item.category === 'Negativ' && answer) return 6 - answer.value;
                        return answer?.value ?? 0; // Fehlende Werte als 0 behandeln
                    })
                );
                return calculateCronbachsAlpha(itemMatrix);
            };
            const cronbachsAlpha = {
                positive: getAlphaForCategory('Positiv'),
                negative: getAlphaForCategory('Negativ'),
            };

            // 5. T-Test für Geschlechterunterschiede
            const participantScores = Object.values(responsesByParticipant).map(p => {
                const scores = p.answers.map(a => {
                    const item = items.find(i => i.id === a.item_id);
                    if (item?.category === 'Negativ') return 6 - a.value;
                    if (item?.category === 'Positiv') return a.value;
                    return null;
                }).filter((v): v is number => v !== null);
                return { gender: p.gender, score: scores.length > 0 ? ss.mean(scores) : 0 };
            });

            const maleScores = participantScores.filter(p => p.gender === 'männlich').map(p => p.score);
            const femaleScores = participantScores.filter(p => p.gender === 'weiblich').map(p => p.score);

            let tTest = { pValue: null, significant: false };
            if (maleScores.length >= 2 && femaleScores.length >= 2) {
                const pValue = ss.tTestTwoSample(maleScores, femaleScores);
                tTest = { pValue, significant: pValue !== null && pValue < 0.05 };
            }

            // Demografie-Berechnungen
            const n = responsesData.length;
            const ages = responsesData.map(r => r.age).filter(Boolean);
            const experiences = responsesData.map(r => r.experience).filter(Boolean);
            const genderCounts = responsesData.reduce((acc, r) => {
                const gender = r.gender || 'unbekannt';
                acc[gender] = (acc[gender] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            setDemographics({
                n,
                gender: genderCounts,
                age: { mean: ss.mean(ages).toFixed(1), stdDev: ss.standardDeviation(ages).toFixed(1) },
                experience: { mean: ss.mean(experiences).toFixed(1), stdDev: ss.standardDeviation(experiences).toFixed(1) },
            });

            setResults({ itemStats, cronbachsAlpha, tTest });
            setLoading(false);
        };

        runAnalysis();
    }, []);

    if (loading) {
        return <main className="text-center p-8">Führe statistische Analysen durch...</main>;
    }
    if (!results || !demographics) {
        return <main className="text-center p-8">Fehler bei der Analyse oder nicht genügend Daten.</main>;
    }

    return (
        <main className="max-w-5xl mx-auto p-4">
            <h2 className="text-3xl font-bold mb-6 text-center">Forschungsergebnisse</h2>
            
            <div className="bg-white p-6 rounded-lg shadow mb-8">
                <h3 className="text-xl font-semibold mb-4">Beschreibung der Stichprobe</h3>
                <ul className="list-disc list-inside space-y-2">
                    <li><strong>Anzahl Teilnehmende (N):</strong> {demographics.n}</li>
                    <li><strong>Alter:</strong> M = {demographics.age.mean}, SD = {demographics.age.stdDev}</li>
                    <li><strong>Berufserfahrung (Jahre):</strong> M = {demographics.experience.mean}, SD = {demographics.experience.stdDev}</li>
                    <li><strong>Geschlechterverteilung:</strong>
                        <ul className="list-inside ml-4">
                            {Object.entries(demographics.gender).map(([key, value]) => (
                                <li key={key}>{key}: {value} ({(value / demographics.n * 100).toFixed(1)}%)</li>
                            ))}
                        </ul>
                    </li>
                </ul>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow mb-8">
                <h3 className="text-xl font-semibold mb-4">Item-Analyse</h3>
                <p className="mb-4">Deskriptive Statistiken für jedes Item des Fragebogens.</p>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mittelwert</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Standardabweichung</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {results.itemStats.map((stat, index) => (
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-700">{stat.text}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.mean}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.stdDev}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Skalenreliabilität (Cronbach&apos;s α)</h3>
                    <p>Dieser Wert misst die interne Konsistenz der Skalen. Werte &gt; 0.7 gelten als akzeptabel.</p>
                    <ul className="list-disc list-inside mt-4 space-y-2">
                        <li><strong>Positive Skala:</strong> {results.cronbachsAlpha.positive?.toFixed(3) ?? 'N/A'}</li>
                        <li><strong>Negative Skala:</strong> {results.cronbachsAlpha.negative?.toFixed(3) ?? 'N/A'}</li>
                    </ul>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Gruppenunterschiede (t-Test)</h3>
                    <p>Vergleich der Gesamthaltung zwischen Männern und Frauen.</p>
                     <p className="mt-4">
                        Der p-Wert beträgt <strong>{results.tTest.pValue?.toFixed(3) ?? 'N/A'}</strong>.
                        {results.tTest.significant ? 
                            <span className="text-green-600 font-bold"> Der Unterschied ist statistisch signifikant (p &lt; 0.05).</span> :
                            <span> Der Unterschied ist nicht statistisch signifikant (p &gt;= 0.05).</span>
                        }
                    </p>
                </div>
            </div>
        </main>
    );
} 