"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { AnswerRow, ResponseRow } from "@/types/database";

interface DebugStats {
  totalAnswers: number;
  totalResponses: number;
  totalItems: number;
  expectedAnswers: number;
  uniqueAnswerResponses: number;
  uniqueResponseIds: number;
  intersection: number;
  orphanAnswers: number;
  orphanResponses: number;
  completeParticipants: number;
  incompleteParticipants: number;
  responsesWithoutAnswers: number;
  allAnswers: AnswerRow[];
  allResponses: ResponseRow[];
  answersPerParticipant: [string, number][];
  latestResponsesWithoutAnswers: ResponseRow[];
}

export default function DebugPage() {
    const [stats, setStats] = useState<DebugStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getStats = async () => {
            console.log("=== COMPLETE DATABASE DEBUG ===");
            
            // 1. Erstmal nur ZÄHLEN ohne Daten zu laden
            const { count: answerCount } = await supabase
                .from("answers")
                .select('*', { count: 'exact', head: true });
            
            console.log("TOTAL ANSWERS IN DB:", answerCount);
            
            // 2. Dann Daten laden mit Pagination
            const allAnswersPages = [];
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
            
            console.log("ANSWERS GELADEN:", allAnswers?.length || 0, "von", answerCount || "unknown", "total");
            
            // 2. Alle Responses zählen und laden (mit Pagination falls nötig)
            const allResponsesPages = [];
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
            const responseCount = allResponses.length;
                
            console.log("ALLE RESPONSES:", allResponses?.length || 0, "von", responseCount || "unknown", "total");
            
            // 3. Items zählen
            const { data: allItems, error: itemsError } = await supabase
                .from("items")
                .select('*');
                
            console.log("ALLE ITEMS:", allItems?.length || 0);
            
            if (answersError || responsesError || itemsError) {
                console.error("Errors:", { answersError, responsesError, itemsError });
            }
            
            // 4. Eindeutige response_ids in answers
            const uniqueResponseIds = new Set(allAnswers?.map(a => a.response_id) || []);
            console.log("EINDEUTIGE response_ids in answers:", uniqueResponseIds.size);
            
            // 5. Eindeutige IDs in responses  
            const responseIds = new Set(allResponses?.map(r => r.id) || []);
            console.log("EINDEUTIGE IDs in responses:", responseIds.size);
            
            // 6. Überschneidung
            const intersection = [...uniqueResponseIds].filter(id => responseIds.has(id));
            console.log("ÜBERSCHNEIDUNG (beide Tabellen):", intersection.length);
            
            // 7. Answers ohne responses
            const orphanAnswers = [...uniqueResponseIds].filter(id => !responseIds.has(id));
            console.log("VERWAISTE ANSWERS (keine response):", orphanAnswers.length);
            
            // 8. Responses ohne answers
            const orphanResponses = [...responseIds].filter(id => !uniqueResponseIds.has(id));
            console.log("VERWAISTE RESPONSES (keine answers):", orphanResponses.length);
            
            // 9. NEUE ANALYSE: Answers pro Teilnehmer
            const answersPerParticipant = new Map();
            allAnswers?.forEach(answer => {
                const responseId = answer.response_id;
                if (!answersPerParticipant.has(responseId)) {
                    answersPerParticipant.set(responseId, 0);
                }
                answersPerParticipant.set(responseId, answersPerParticipant.get(responseId) + 1);
            });
            
            console.log("ANSWERS PRO TEILNEHMER:", [...answersPerParticipant.entries()]);
            
            // 10. Erwartete Anzahl Items (ohne Kontrolle)
            const expectedAnswers = allItems?.filter(item => item.category !== 'Kontrolle').length || 0;
            console.log("ERWARTETE ANSWERS PRO TEILNEHMER:", expectedAnswers);
            
            // 11. Teilnehmer mit vollständigen/unvollständigen Antworten
            const completeParticipants = [...answersPerParticipant.entries()].filter(([, count]) => count >= expectedAnswers);
            const incompleteParticipants = [...answersPerParticipant.entries()].filter(([, count]) => count < expectedAnswers);
            
            console.log("VOLLSTÄNDIGE TEILNEHMER:", completeParticipants.length);
            console.log("UNVOLLSTÄNDIGE TEILNEHMER:", incompleteParticipants.length);
            
            // 12. Responses nach Datum sortiert (neueste zuerst)
            const responsesByDate = allResponses?.sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ) || [];
            
            // 13. Welche Responses haben keine Answers?
            const responsesWithoutAnswers = responsesByDate.filter(resp => 
                !uniqueResponseIds.has(resp.id)
            );
            
            console.log("RESPONSES OHNE ANSWERS (neueste zuerst):", responsesWithoutAnswers.slice(0, 10));
            
            setStats({
                totalAnswers: allAnswers?.length || 0,
                totalResponses: allResponses?.length || 0,
                totalItems: allItems?.length || 0,
                expectedAnswers,
                uniqueAnswerResponses: uniqueResponseIds.size,
                uniqueResponseIds: responseIds.size,
                intersection: intersection.length,
                orphanAnswers: orphanAnswers.length,
                orphanResponses: orphanResponses.length,
                completeParticipants: completeParticipants.length,
                incompleteParticipants: incompleteParticipants.length,
                responsesWithoutAnswers: responsesWithoutAnswers.length,
                allAnswers: allAnswers || [],
                allResponses: allResponses || [],
                answersPerParticipant: [...answersPerParticipant.entries()],
                latestResponsesWithoutAnswers: responsesWithoutAnswers.slice(0, 10)
            });
            
            setLoading(false);
        };
        
        getStats();
    }, []);

    if (loading) return <div className="p-8">Lade Debug-Informationen...</div>;
    if (!stats) return <div className="p-8">Keine Statistiken verfügbar.</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-red-600">🚨 DATENVERLUST ANALYSE</h1>
            
            <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-8">
                <h2 className="text-lg font-bold text-red-800">KRITISCHES PROBLEM ERKANNT!</h2>
                <p className="text-red-700">
                    {stats.orphanResponses} Teilnehmer haben ihre Antworten verloren! 
                    Das sind {((stats.orphanResponses / stats.totalResponses) * 100).toFixed(1)}% aller Teilnehmer.
                </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-100 p-4 rounded">
                    <h3 className="font-bold">Total Answers</h3>
                    <div className="text-2xl">{stats.totalAnswers}</div>
                </div>
                
                <div className="bg-green-100 p-4 rounded">
                    <h3 className="font-bold">Total Responses</h3>
                    <div className="text-2xl">{stats.totalResponses}</div>
                </div>
                
                <div className="bg-yellow-100 p-4 rounded">
                    <h3 className="font-bold">Erwartete Answers pro Person</h3>
                    <div className="text-2xl">{stats.expectedAnswers}</div>
                </div>
                
                <div className="bg-purple-100 p-4 rounded">
                    <h3 className="font-bold">Teilnehmer mit Answers</h3>
                    <div className="text-2xl">{stats.uniqueAnswerResponses}</div>
                </div>
                
                <div className="bg-green-200 p-4 rounded">
                    <h3 className="font-bold">Vollständige Tests</h3>
                    <div className="text-2xl">{stats.completeParticipants}</div>
                </div>
                
                <div className="bg-yellow-200 p-4 rounded">
                    <h3 className="font-bold">Unvollständige Tests</h3>
                    <div className="text-2xl">{stats.incompleteParticipants}</div>
                </div>
                
                <div className="bg-red-200 p-4 rounded">
                    <h3 className="font-bold">🚨 VERLORENE TESTS</h3>
                    <div className="text-2xl">{stats.responsesWithoutAnswers}</div>
                    <div className="text-sm text-red-700">Komplett ohne Antworten!</div>
                </div>
                
                <div className="bg-gray-200 p-4 rounded">
                    <h3 className="font-bold">Verlustrate</h3>
                    <div className="text-2xl">{((stats.responsesWithoutAnswers / stats.totalResponses) * 100).toFixed(1)}%</div>
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow mb-8">
                <h2 className="text-xl font-bold mb-4 text-red-600">🚨 Neueste verlorene Tests</h2>
                <div className="space-y-2">
                    {stats.latestResponsesWithoutAnswers.map((resp: ResponseRow, index: number) => (
                        <div key={index} className="bg-red-50 p-3 rounded border-l-4 border-red-400">
                            <div className="text-sm">
                                <strong>ID:</strong> {resp.id.substring(0, 8)}...
                            </div>
                            <div className="text-sm text-gray-600">
                                <strong>Datum:</strong> {resp.created_at ? new Date(resp.created_at).toLocaleString('de-DE') : 'unbekannt'}
                            </div>
                            <div className="text-sm text-gray-600">
                                <strong>Profil:</strong> {resp.role}, {resp.age}, {resp.gender}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Sample Answer Records (ersten 5):</h2>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(stats.allAnswers.slice(0, 5), null, 2)}
                </pre>
            </div>
            
            <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Sample Response Records (ersten 5):</h2>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(stats.allResponses.slice(0, 5), null, 2)}
                </pre>
            </div>
            
            <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
                <h2 className="text-xl font-bold mb-4 text-red-800">🚨 KRITISCHE ZUSAMMENFASSUNG</h2>
                <ul className="list-disc list-inside space-y-2 text-red-700">
                    <li><strong>{stats.responsesWithoutAnswers} Teilnehmer ({((stats.responsesWithoutAnswers / stats.totalResponses) * 100).toFixed(1)}%)</strong> haben ihre kompletten Antworten verloren!</li>
                    <li><strong>Das ist ein massiver Datenverlust!</strong> Fast die Hälfte aller Tests ist betroffen.</li>
                    <li>Das Problem liegt beim <code>answers.insert()</code> in der Test-Seite</li>
                    <li>Der Cleanup (Löschen verwaister Responses) funktioniert nicht zuverlässig</li>
                    <li><strong>SOFORTIGE AKTION ERFORDERLICH:</strong> Test-Flow reparieren bevor weitere Daten verloren gehen!</li>
                </ul>
            </div>
        </div>
    );
} 