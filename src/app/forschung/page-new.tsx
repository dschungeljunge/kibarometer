"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { AnswerRow, ResponseRow } from "@/types/database";
import * as ss from "simple-statistics";

interface Demographics {
    n: number;
    nComplete: number;
    nPartial: number;
    gender: Record<string, number>;
    age: Record<string, number>;
    experience: Record<string, number>;
    role: Record<string, number>;
    schoolLevel: Record<string, number>;
}

interface ItemStats {
    text: string;
    mean: string;
    stdDev: string;
    n: string;
    category: string;
}

export default function NewForschungPage() {
    const [demographics, setDemographics] = useState<Demographics | null>(null);
    const [itemStats, setItemStats] = useState<ItemStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const runAnalysis = async () => {
            console.log("=== NEUE FORSCHUNGSANALYSE ===");
            
            // 1. ALLE Responses laden mit Pagination
            const allResponsesPages: ResponseRow[] = [];
            let responsePage = 0;
            let hasMoreResponses = true;
            
            while (hasMoreResponses) {
                const { data: pageData, error } = await supabase
                    .from("responses")
                    .select('*')
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
            
            const allResponses = allResponsesPages;
            const responsesError = allResponsesPages.length === 0 && responsePage === 0 ? new Error("Keine Responses") : null;
            
            // 2. ALLE Answers laden mit Pagination
            const allAnswersPages: AnswerRow[] = [];
            let answerPage = 0;
            let hasMoreAnswers = true;
            
            while (hasMoreAnswers) {
                const { data: pageData, error } = await supabase
                    .from("answers")
                    .select('*')
                    .range(answerPage * 1000, (answerPage + 1) * 1000 - 1);
                    
                if (error) {
                    console.error("Fehler beim Laden der Answers:", error);
                    break;
                }
                
                if (pageData && pageData.length > 0) {
                    allAnswersPages.push(...pageData);
                    answerPage++;
                    hasMoreAnswers = pageData.length === 1000;
                } else {
                    hasMoreAnswers = false;
                }
            }
            
            const allAnswers = allAnswersPages;
            const answersError = allAnswersPages.length === 0 && answerPage === 0 ? new Error("Keine Answers") : null;
                
            // 3. ALLE Items laden (typischerweise <100, kein Pagination nötig)
            const { data: allItems, error: itemsError } = await supabase
                .from("items")
                .select('*');

            if (responsesError || answersError || itemsError) {
                console.error("Fehler:", { responsesError, answersError, itemsError });
                setLoading(false);
                return;
            }

            console.log("Alle Responses:", allResponses?.length);
            console.log("Alle Answers:", allAnswers?.length);
            console.log("Alle Items:", allItems?.length);

            // 4. Antworten nach response_id gruppieren
            const answersByResponse = new Map();
            allAnswers?.forEach(answer => {
                const responseId = answer.response_id;
                if (!answersByResponse.has(responseId)) {
                    answersByResponse.set(responseId, []);
                }
                answersByResponse.get(responseId).push(answer);
            });

            // 5. Kategorisiere Teilnehmer
            interface ParticipantWithAnswers {
                id: string;
                gender?: string;
                age?: string;
                experience?: string;
                role?: string;
                school_level?: string;
                answers: AnswerRow[];
            }
            
            const completeParticipants: ParticipantWithAnswers[] = [];
            const partialParticipants: ParticipantWithAnswers[] = [];
            const noAnswerParticipants: ParticipantWithAnswers[] = [];

            allResponses?.forEach(response => {
                const answers = answersByResponse.get(response.id) || [];
                const expectedAnswers = allItems?.filter(item => item.category !== 'Kontrolle').length || 0;
                
                if (answers.length >= expectedAnswers * 0.8) { // 80% als "vollständig"
                    completeParticipants.push({ ...response, answers });
                } else if (answers.length > 0) {
                    partialParticipants.push({ ...response, answers });
                } else {
                    noAnswerParticipants.push({ ...response, answers });
                }
            });

            console.log("Vollständige Teilnehmer:", completeParticipants.length);
            console.log("Teilweise Teilnehmer:", partialParticipants.length);
            console.log("Nur demografische Daten:", noAnswerParticipants.length);

            // 6. Demografische Auswertung (ALLE 88 Teilnehmer)
            const allParticipants = [...completeParticipants, ...partialParticipants, ...noAnswerParticipants];
            
            const genderCounts = allParticipants.reduce((acc: Record<string, number>, p) => {
                const gender = p.gender || 'unbekannt';
                acc[gender] = (acc[gender] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const ageCounts = allParticipants.reduce((acc: Record<string, number>, p) => {
                const age = p.age || 'unbekannt';
                acc[age] = (acc[age] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const experienceCounts = allParticipants.reduce((acc: Record<string, number>, p) => {
                const experience = p.experience || 'unbekannt';
                acc[experience] = (acc[experience] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const roleCounts = allParticipants.reduce((acc: Record<string, number>, p) => {
                const role = p.role || 'unbekannt';
                acc[role] = (acc[role] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const schoolLevelCounts = allParticipants.reduce((acc: Record<string, number>, p) => {
                const schoolLevel = p.school_level || 'unbekannt';
                acc[schoolLevel] = (acc[schoolLevel] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            // 7. Item-Statistiken (nur vollständige Teilnehmer)
            const itemStatistics = allItems?.filter(item => item.category !== 'Kontrolle').map(item => {
                const itemAnswers = allAnswers?.filter(a => a.item_id === item.id).map(a => a.value) || [];
                
                if (itemAnswers.length === 0) {
                    return {
                        text: item.text,
                        mean: 'N/A',
                        stdDev: 'N/A',
                        n: '0',
                        category: item.category
                    };
                }

                return {
                    text: item.text,
                    mean: ss.mean(itemAnswers).toFixed(2),
                    stdDev: ss.standardDeviation(itemAnswers).toFixed(2),
                    n: itemAnswers.length.toString(),
                    category: item.category
                };
            }) || [];

            setDemographics({
                n: allParticipants.length,
                nComplete: completeParticipants.length,
                nPartial: partialParticipants.length,
                gender: genderCounts,
                age: ageCounts,
                experience: experienceCounts,
                role: roleCounts,
                schoolLevel: schoolLevelCounts
            });

            setItemStats(itemStatistics);
            setLoading(false);
        };

        runAnalysis();
    }, []);

    if (loading) {
        return <main className="text-center p-8">Führe erweiterte Analyse durch...</main>;
    }

    if (!demographics) {
        return <main className="text-center p-8">Fehler bei der Analyse.</main>;
    }

    return (
        <div className="p-4 md:p-8 bg-gradient-to-b from-blue-50 via-white to-blue-50">
            <main className="max-w-6xl mx-auto p-4">
                <h2 className="text-3xl font-bold mb-6 text-center">Erweiterte Forschungsauswertung</h2>
                <p className="text-center text-blue-600 mb-8">
                    Alle {demographics.n} Teilnehmer einbezogen (auch unvollständige Tests)
                </p>
                
                {/* Übersicht */}
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                    <h3 className="text-xl font-semibold mb-4">Teilnehmer-Übersicht</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="bg-green-100 p-4 rounded-lg text-center">
                            <div className="text-2xl font-bold text-green-800">{demographics.nComplete}</div>
                            <div className="text-green-700">Vollständige Tests</div>
                        </div>
                        <div className="bg-yellow-100 p-4 rounded-lg text-center">
                            <div className="text-2xl font-bold text-yellow-800">{demographics.nPartial}</div>
                            <div className="text-yellow-700">Teilweise Tests</div>
                        </div>
                        <div className="bg-blue-100 p-4 rounded-lg text-center">
                            <div className="text-2xl font-bold text-blue-800">{demographics.n}</div>
                            <div className="text-blue-700">Gesamt Teilnehmer</div>
                        </div>
                    </div>
                </div>

                {/* Demografische Auswertung */}
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                    <h3 className="text-xl font-semibold mb-4">Demografische Verteilung (N = {demographics.n})</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <div className="mb-4">
                                <p className="font-medium mb-1">Geschlechterverteilung:</p>
                                <ul className="list-disc list-inside ml-4 text-sm">
                                    {Object.entries(demographics.gender).map(([key, value]) => (
                                        <li key={key}>{key}: {value} ({(value / demographics.n * 100).toFixed(1)}%)</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mb-4">
                                <p className="font-medium mb-1">Altersverteilung:</p>
                                <ul className="list-disc list-inside ml-4 text-sm">
                                    {Object.entries(demographics.age).map(([key, value]) => (
                                        <li key={key}>{key}: {value} ({(value / demographics.n * 100).toFixed(1)}%)</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mb-4">
                                <p className="font-medium mb-1">Berufserfahrung:</p>
                                <ul className="list-disc list-inside ml-4 text-sm">
                                    {Object.entries(demographics.experience).map(([key, value]) => (
                                        <li key={key}>{key} Jahre: {value} ({(value / demographics.n * 100).toFixed(1)}%)</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div>
                            <div className="mb-4">
                                <p className="font-medium mb-1">Berufliche Rolle:</p>
                                <ul className="list-disc list-inside ml-4 text-sm">
                                    {Object.entries(demographics.role).map(([key, value]) => (
                                        <li key={key}>{key}: {value} ({(value / demographics.n * 100).toFixed(1)}%)</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mb-4">
                                <p className="font-medium mb-1">Schulstufe:</p>
                                <ul className="list-disc list-inside ml-4 text-sm">
                                    {Object.entries(demographics.schoolLevel).map(([key, value]) => (
                                        <li key={key}>{key}: {value} ({(value / demographics.n * 100).toFixed(1)}%)</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Item-Analyse */}
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                    <h3 className="text-xl font-semibold mb-4">Item-Analyse (nur vollständige Tests)</h3>
                    <p className="mb-4 text-gray-600">
                        Basiert auf {demographics.nComplete} vollständigen Tests mit allen Item-Antworten.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mittelwert</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Standardabweichung</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategorie</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {itemStats.map((stat, index) => (
                                    <tr key={index}>
                                        <td className="px-6 py-4 text-sm text-gray-700">{stat.text}</td>
                                        <td className="px-6 py-4 text-sm">{stat.n}</td>
                                        <td className="px-6 py-4 text-sm">{stat.mean}</td>
                                        <td className="px-6 py-4 text-sm">{stat.stdDev}</td>
                                        <td className="px-6 py-4 text-sm">{stat.category}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold mb-3 text-blue-800">Interpretation</h4>
                    <ul className="list-disc list-inside text-blue-700 space-y-2">
                        <li><strong>Demografische Analyse:</strong> Basiert auf allen {demographics.n} Teilnehmern (auch denen, die den Test nicht vollständig abgeschlossen haben)</li>
                        <li><strong>Item-Analyse:</strong> Basiert nur auf den {demographics.nComplete} vollständigen Tests für statistische Validität</li>
                        <li><strong>Vollständigkeitsrate:</strong> {((demographics.nComplete / demographics.n) * 100).toFixed(1)}% der Teilnehmer haben den Test vollständig abgeschlossen</li>
                    </ul>
                </div>
            </main>
        </div>
    );
} 