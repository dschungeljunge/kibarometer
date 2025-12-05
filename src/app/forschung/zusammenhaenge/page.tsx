"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { AnswerRow, ResponseRow } from "@/types/database";
import * as ss from "simple-statistics";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ScatterController } from 'chart.js';
import { Scatter } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ScatterController);

// Typ-Definitionen (könnten in eine eigene Datei ausgelagert werden)
interface Item {
    id: number;
    category: 'Positiv' | 'Negativ' | 'Kontrolle';
}

interface ParticipantScores {
    meanPositive: number | null;
    meanNegative: number | null; // Skepsis-Score
    age: number;
    experience: number;
}

interface CorrelationResult {
    correlation: number;
    pValue: number;
    significant: boolean;
    n: number;
}

interface AnalysisResults {
    optimismVsSkepticism: CorrelationResult;
    ageVsOptimism: CorrelationResult;
    ageVsSkepticism: CorrelationResult;
    experienceVsOptimism: CorrelationResult;
    experienceVsSkepticism: CorrelationResult;
    scatterData: {
        optimismSkepticism: { x: number, y: number }[];
        ageOptimism: { x: number, y: number }[];
        ageSkepticism: { x: number, y: number }[];
        experienceOptimism: { x: number, y: number }[];
        experienceSkepticism: { x: number, y: number }[];
    }
}

// Helper: Konvertiert kategoriale Alters- und Erfahrungsangaben in numerische Werte
const categoryToNumber = (category: string, type: 'age' | 'experience'): number => {
    if (type === 'age') {
        if (category.startsWith('unter')) return 20;
        if (category.endsWith('+')) return 65;
        const match = category.match(/(\d+)-(\d+)/);
        return match ? (parseInt(match[1]) + parseInt(match[2])) / 2 : 0;
    }
    if (type === 'experience') {
        if (category.endsWith('+')) return 31;
        const match = category.match(/(\d+)-(\d+)/);
        return match ? (parseInt(match[1]) + parseInt(match[2])) / 2 : 0;
    }
    return 0;
};

// Hauptkomponente
export default function ZusammenhaengePage() {
    const [results, setResults] = useState<AnalysisResults | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const runAnalysis = async () => {
            setLoading(true);
            
            // Dynamischer Import für die Statistik-Bibliothek
            const pcorrtest = (await import('@stdlib/stats-pcorrtest')).default;
            
            // 1. Daten laden
            const { data: itemsData, error: itemsError } = await supabase.from("items").select('id, category');
            
            // Lade ALLE Answers mit Pagination
            const allAnswersPages = [];
            let page = 0;
            let hasMore = true;
            
            while (hasMore) {
                const { data: pageData, error } = await supabase
                    .from("answers")
                    .select(`
                        response_id,
                        item_id,
                        value
                    `)
                    .range(page * 1000, (page + 1) * 1000 - 1);
                    
                if (error) {
                    console.error("Fehler beim Laden der Answers:", error);
                    break;
                }
                
                if (pageData && pageData.length > 0) {
                    allAnswersPages.push(...pageData);
                    page++;
                    hasMore = pageData.length === 1000;
                } else {
                    hasMore = false;
                }
            }
            
            const answersData = allAnswersPages;
            const answersError = allAnswersPages.length === 0 && page === 0 ? new Error("Keine Answers") : null;

            // Lade alle demografischen Informationen separat aus der responses-Tabelle (mit Pagination)
            const allResponsesPages = [];
            let responsePage = 0;
            let hasMoreResponses = true;
            
            while (hasMoreResponses) {
                const { data: pageData, error } = await supabase
                    .from("responses")
                    .select("id, age, experience, consent")
                    .range(responsePage * 1000, (responsePage + 1) * 1000 - 1);
                    
                if (error) {
                    console.error("Fehler beim Laden der Responses:", error);
                    break;
                }
                
                if (pageData && pageData.length > 0) {
                    allResponsesPages.push(...pageData);
                    responsePage++;
                    hasMoreResponses = pageData.length === 1000;
                } else {
                    hasMoreResponses = false;
                }
            }
            
            const responsesData = allResponsesPages;
            const responsesError = allResponsesPages.length === 0 && responsePage === 0 ? new Error("Keine Responses") : null;

            if (itemsError || answersError || !answersData) {
                console.error("Daten-Ladefehler:", itemsError || answersError);
                setLoading(false);
                return;
            }
            
            if (responsesError) {
                console.error("Fehler beim Laden der Demografie-Daten:", responsesError);
            }

            console.log("Responses Data:", responsesData);

            const responseMap: Record<string, {
                age?: string;
                experience?: string;
                consent?: string;
            }> = {};
            (responsesData ?? []).forEach((r: ResponseRow) => {
                if (r && r.id) {
                    responseMap[r.id.toString()] = r;
                }
            });
            
            const items: Item[] = itemsData || [];
            // Keine Consent-Filterung mehr: alle Antworten werden ausgewertet

            // 2. Scores pro Teilnehmer berechnen
            type AnswerSimple = { item_id: number; value: number };

            const responsesByParticipant = (answersData as AnswerRow[]).reduce((acc: Record<string, { answers: AnswerSimple[]; age: string; experience: string }>, answer) => {
                const id = String(answer.response_id);
                if (!acc[id]) {
                    const demo = responseMap[id] || {};
                    acc[id] = {
                        answers: [],
                        age: demo.age || 'unbekannt',
                        experience: demo.experience || 'unbekannt'
                    };
                }
                acc[id].answers.push({ item_id: answer.item_id, value: answer.value });
                return acc;
            }, {} as Record<string, { answers: AnswerSimple[]; age: string; experience: string }>);

            const participantScores: ParticipantScores[] = Object.values(responsesByParticipant).map((p) => {
                const positiveScores = p.answers
                    .map((a) => items.find(i => i.id === a.item_id)?.category === 'Positiv' ? a.value : null)
                    .filter((v): v is number => v !== null);
                
                const negativeScoresRaw = p.answers
                    .map((a) => items.find(i => i.id === a.item_id)?.category === 'Negativ' ? a.value : null)
                    .filter((v): v is number => v !== null);

                return {
                    meanPositive: positiveScores.length > 0 ? ss.mean(positiveScores) : null,
                    meanNegative: negativeScoresRaw.length > 0 ? ss.mean(negativeScoresRaw.map((v: number) => 6 - v)) : null, // Skepsis umpolen
                    age: categoryToNumber(p.age, 'age'),
                    experience: categoryToNumber(p.experience, 'experience')
                };
            }).filter(p => p.age > 0 && p.experience > 0 && p.meanPositive !== null && p.meanNegative !== null);

            if (participantScores.length < 10) { // Mindestanzahl für sinnvolle Korrelationen
                setLoading(false);
                return;
            }

            // 3. Korrelationen berechnen
            const calculateCorrelation = (arrX: number[], arrY: number[]): CorrelationResult => {
                if (arrX.length < 2 || arrY.length < 2) return { correlation: 0, pValue: 1, significant: false, n: 0 };
                
                const testResult = pcorrtest(arrX, arrY);

                return {
                    correlation: isNaN(testResult.pcorr) ? 0 : testResult.pcorr,
                    pValue: isNaN(testResult.pValue) ? 1 : testResult.pValue,
                    significant: testResult.rejected,
                    n: arrX.length
                };
            };
            
            const analysisData: AnalysisResults = {
                optimismVsSkepticism: calculateCorrelation(participantScores.map(p => p.meanPositive as number), participantScores.map(p => p.meanNegative as number)),
                ageVsOptimism: calculateCorrelation(participantScores.map(p => p.age), participantScores.map(p => p.meanPositive as number)),
                ageVsSkepticism: calculateCorrelation(participantScores.map(p => p.age), participantScores.map(p => p.meanNegative as number)),
                experienceVsOptimism: calculateCorrelation(participantScores.map(p => p.experience), participantScores.map(p => p.meanPositive as number)),
                experienceVsSkepticism: calculateCorrelation(participantScores.map(p => p.experience), participantScores.map(p => p.meanNegative as number)),
                scatterData: {
                    optimismSkepticism: participantScores.map(p => ({ x: p.meanPositive as number, y: p.meanNegative as number })),
                    ageOptimism: participantScores.map(p => ({ x: p.age, y: p.meanPositive as number })),
                    ageSkepticism: participantScores.map(p => ({ x: p.age, y: p.meanNegative as number })),
                    experienceOptimism: participantScores.map(p => ({ x: p.experience, y: p.meanPositive as number })),
                    experienceSkepticism: participantScores.map(p => ({ x: p.experience, y: p.meanNegative as number })),
                }
            };
            
            setResults(analysisData);
            setLoading(false);
        };
        runAnalysis();
    }, []);

    const renderCorrelationCard = (title: string, result: CorrelationResult, description: string) => (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-5xl font-bold text-center my-4 text-blue-600">{result.correlation.toFixed(3)}</p>
            <p className="text-center font-medium">
                {result.significant ? "Statistisch signifikanter" : "Statistisch nicht signifikanter"} Zusammenhang
            </p>
            <p className="text-center text-sm text-gray-500 mb-4">(p {result.pValue < 0.001 ? '< 0.001' : `= ${result.pValue.toFixed(3)}`}, N = {result.n})</p>
            <p className="text-sm text-gray-700">{description}</p>
        </div>
    );
    
    const renderScatterPlot = (title: string, data: {x: number, y: number}[], xLabel: string, yLabel: string) => (
        <div className="bg-white p-6 rounded-lg shadow">
             <h3 className="text-xl font-semibold mb-4">{title}</h3>
             <Scatter
                data={{
                    datasets: [{
                        label: 'Teilnehmer',
                        data: data,
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    }]
                }}
                options={{
                    scales: {
                        x: { title: { display: true, text: xLabel } },
                        y: { title: { display: true, text: yLabel } }
                    },
                    plugins: { legend: { display: false } }
                }}
             />
        </div>
    );


    if (loading) {
        return <main className="text-center p-8">Führe Korrelationsanalysen durch...</main>;
    }
    if (!results) {
        return <main className="text-center p-8">Für die Korrelationsanalyse sind nicht genügend Daten vorhanden (mind. 10 Teilnehmer mit vollständigen Angaben benötigt).</main>;
    }

    return (
        <div className="p-4 md:p-8 bg-gradient-to-b from-blue-50 via-white to-white">
            <main className="max-w-6xl mx-auto p-4">
                <h2 className="text-3xl font-bold mb-6 text-center">Analyse der Zusammenhänge</h2>
                <p className="text-center text-gray-600 mb-10 max-w-3xl mx-auto">
                    Dieses Kapitel untersucht die statistischen Zusammenhänge (Korrelationen) zwischen den KI-Einstellungen (Optimismus, Skepsis) und demografischen Merkmalen. 
                    Ein Korrelationskoeffizient (r) nahe +1 oder -1 zeigt einen starken Zusammenhang an, während Werte nahe 0 auf Unabhängigkeit hindeuten.
                </p>

                {/* Korrelation Optimismus vs. Skepsis */}
                <div className="grid md:grid-cols-2 gap-8 mb-12 items-center">
                    {renderCorrelationCard(
                        "Optimismus vs. Skepsis", 
                        results.optimismVsSkepticism,
                        `Dieser Wert gibt an, ob Personen mit hohem Optimismus auch eine hohe (oder niedrige) Skepsis aufweisen. Ein Wert um ${results.optimismVsSkepticism.correlation.toFixed(2)} deutet darauf hin, dass die beiden Dimensionen ${Math.abs(results.optimismVsSkepticism.correlation) < 0.2 ? 'weitgehend unabhängig voneinander sind.' : 'miteinander zusammenhängen.'}`
                    )}
                    {renderScatterPlot("Streudiagramm: Optimismus vs. Skepsis", results.scatterData.optimismSkepticism, "Optimismus-Score", "Skepsis-Score")}
                </div>

                {/* Korrelationen mit Alter */}
                <h3 className="text-2xl font-bold mb-6 text-center border-t pt-8">Einfluss des Alters</h3>
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                   {renderCorrelationCard(
                       "Alter und Optimismus",
                       results.ageVsOptimism,
                       "Zeigt, ob das Alter mit einer optimistischeren oder weniger optimistischen Haltung zusammenhängt."
                   )}
                   {renderCorrelationCard(
                       "Alter und Skepsis",
                       results.ageVsSkepticism,
                       "Zeigt, ob das Alter mit einer skeptischeren oder weniger skeptischen Haltung zusammenhängt."
                   )}
                </div>
                 <div className="grid md:grid-cols-2 gap-8 mb-12">
                    {renderScatterPlot("Alter vs. Optimismus", results.scatterData.ageOptimism, "Alter (approximiert)", "Optimismus-Score")}
                    {renderScatterPlot("Alter vs. Skepsis", results.scatterData.ageSkepticism, "Alter (approximiert)", "Skepsis-Score")}
                </div>

                {/* Korrelationen mit Berufserfahrung */}
                <h3 className="text-2xl font-bold mb-6 text-center border-t pt-8">Einfluss der Berufserfahrung</h3>
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                   {renderCorrelationCard(
                       "Berufserfahrung und Optimismus",
                       results.experienceVsOptimism,
                       "Zeigt, ob die Berufserfahrung mit einer optimistischeren oder weniger optimistischen Haltung zusammenhängt."
                   )}
                   {renderCorrelationCard(
                       "Berufserfahrung und Skepsis",
                       results.experienceVsSkepticism,
                       "Zeigt, ob die Berufserfahrung mit einer skeptischeren oder weniger skeptischen Haltung zusammenhängt."
                   )}
                </div>
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                    {renderScatterPlot("Berufserfahrung vs. Optimismus", results.scatterData.experienceOptimism, "Berufserfahrung (Jahre, approximiert)", "Optimismus-Score")}
                    {renderScatterPlot("Berufserfahrung vs. Skepsis", results.scatterData.experienceSkepticism, "Berufserfahrung (Jahre, approximiert)", "Skepsis-Score")}
                </div>

            </main>
        </div>
    );
} 