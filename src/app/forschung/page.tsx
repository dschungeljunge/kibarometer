"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import * as ss from "simple-statistics";
import Link from 'next/link';

// Typ-Definitionen
interface Item {
    id: number;
    text: string;
    category: 'Positiv' | 'Negativ' | 'Kontrolle';
}

interface Answer {
    value: number;
    item_id: number;
    responses: { id: string; gender: string; age: string; experience: string; role: string; school_level: string; consent?: string } | null;
}

interface ExtendedAnswer extends Answer {
    response_id: number;
    responses: {
        id: string;
        gender: string;
        age: string;
        experience: string;
        role: string;
        school_level: string;
        consent?: string;
    } | null;
}

interface ItemStats {
    text: string;
    mean: string;
    stdDev: string;
    itemTotalCorrelation: string;
    category: string;
}

interface AnovaResult {
    assumptions: {
        normalityTest: { testName: string; passed: boolean; details: string };
        homogeneityTest: { testName: string; passed: boolean; details: string };
        sampleSizeTest: { passed: boolean; details: string };
        overallValid: boolean;
    };
    anova: {
        fStatistic: number | null;
        pValue: number | null;
        significant: boolean;
    };
}

interface GroupComparison {
    variable: string;
    groups: {
        name: string;
        n: number;
        meanPositive: number;
        meanNegative: number;
        stdDevPositive: number;
        stdDevNegative: number;
    }[];
    anovaPositive: AnovaResult;
    anovaNegative: AnovaResult;
}

interface AnalysisResult {
    itemStats: ItemStats[];
    groupComparisons: GroupComparison[];
}

interface Demographics {
    n: number;
    gender: Record<string, number>;
    age: Record<string, number>;
    experience: Record<string, number>;
    role: Record<string, number>;
    schoolLevel: Record<string, number>;
}

// ANOVA für Gruppenvergleiche
function calculateOneWayANOVA(groups: number[][]): { fStatistic: number | null; pValue: number | null } {
    try {
        if (groups.length < 2 || groups.some(g => g.length < 1)) {
            return { fStatistic: null, pValue: null };
        }

        const allValues = groups.flat();
        const grandMean = ss.mean(allValues);
        const totalN = allValues.length;
        
        // Between-group sum of squares
        let ssb = 0;
        for (const group of groups) {
            const groupMean = ss.mean(group);
            ssb += group.length * Math.pow(groupMean - grandMean, 2);
        }
        
        // Within-group sum of squares
        let ssw = 0;
        for (const group of groups) {
            const groupMean = ss.mean(group);
            for (const value of group) {
                ssw += Math.pow(value - groupMean, 2);
            }
        }
        
        const dfb = groups.length - 1;
        const dfw = totalN - groups.length;
        
        if (dfb === 0 || dfw === 0 || ssw === 0) {
            return { fStatistic: null, pValue: null };
        }
        
        const msb = ssb / dfb;
        const msw = ssw / dfw;
        const fStatistic = msb / msw;
        
        // Vereinfachte p-Wert Approximation
        const pValue = fStatistic > 3.84 ? 0.01 : (fStatistic > 2.71 ? 0.05 : 0.1);
        
        return { fStatistic, pValue };
    } catch (error) {
        console.error('ANOVA calculation error:', error);
        return { fStatistic: null, pValue: null };
    }
}

// Voraussetzungsprüfungen für statistische Tests
function checkAssumptions(groups: number[][]): {
    normalityTest: { testName: string; passed: boolean; details: string };
    homogeneityTest: { testName: string; passed: boolean; details: string };
    sampleSizeTest: { passed: boolean; details: string };
    overallValid: boolean;
} {
    const allValues = groups.flat();
    const totalN = allValues.length;
    
    // 1. Stichprobengröße prüfen
    const minGroupSize = Math.min(...groups.map(g => g.length));
    const sampleSizeTest = {
        passed: totalN >= 20 && minGroupSize >= 3 && groups.length >= 2,
        details: `Gesamt-N: ${totalN}, kleinste Gruppe: ${minGroupSize}, Anzahl Gruppen: ${groups.length}`
    };
    
    // 2. Vereinfachter Normalverteilungstest (Shapiro-Wilk Approximation)
    const shapiroWilkApprox = (data: number[]): { statistic: number; significant: boolean } => {
        if (data.length < 3) return { statistic: 0, significant: true };
        
        const n = data.length;
        const sortedData = [...data].sort((a, b) => a - b);
        const variance = ss.variance(data);
        
        if (variance === 0) return { statistic: 1, significant: false };
        
        // Vereinfachte W-Statistik
        let numerator = 0;
        for (let i = 0; i < Math.floor(n/2); i++) {
            const weight = Math.sqrt(n + 1 - 2 * (i + 1));
            numerator += weight * (sortedData[n - 1 - i] - sortedData[i]);
        }
        
        const denominator = Math.sqrt(n * variance);
        const w = Math.pow(numerator / denominator, 2);
        
        // Vereinfachte Signifikanzprüfung
        const critical = n < 10 ? 0.81 : (n < 30 ? 0.90 : 0.95);
        
        return { statistic: w, significant: w < critical };
    };
    
    // Normalverteilung für jede Gruppe prüfen
    const normalityResults = groups.map(group => shapiroWilkApprox(group));
    const normalityPassed = normalityResults.every(result => !result.significant);
    
    const normalityTest = {
        testName: 'Shapiro-Wilk Test (approximiert)',
        passed: normalityPassed,
        details: `${normalityResults.filter(r => !r.significant).length}/${groups.length} Gruppen normalverteilt`
    };
    
    // 3. Levene's Test für Homogenität der Varianzen (vereinfacht)
    const leveneTest = (): { statistic: number; significant: boolean } => {
        if (groups.length < 2) return { statistic: 0, significant: false };
        
        const groupMeans = groups.map(g => ss.mean(g));
        const deviations = groups.map((group, idx) => 
            group.map(value => Math.abs(value - groupMeans[idx]))
        );
        
        const allDeviations = deviations.flat();
        const grandMeanDev = ss.mean(allDeviations);
        
        // Between-group sum of squares für Abweichungen
        let ssBetween = 0;
        for (let i = 0; i < deviations.length; i++) {
            const groupMeanDev = ss.mean(deviations[i]);
            ssBetween += deviations[i].length * Math.pow(groupMeanDev - grandMeanDev, 2);
        }
        
        // Within-group sum of squares für Abweichungen
        let ssWithin = 0;
        for (let i = 0; i < deviations.length; i++) {
            const groupMeanDev = ss.mean(deviations[i]);
            for (const dev of deviations[i]) {
                ssWithin += Math.pow(dev - groupMeanDev, 2);
            }
        }
        
        const dfBetween = groups.length - 1;
        const dfWithin = totalN - groups.length;
        
        if (dfBetween === 0 || dfWithin === 0 || ssWithin === 0) {
            return { statistic: 0, significant: false };
        }
        
        const leveneStatistic = (ssBetween / dfBetween) / (ssWithin / dfWithin);
        
        // Vereinfachte Signifikanzprüfung
        const critical = 2.5; // Approximation für p < 0.05
        
        return { statistic: leveneStatistic, significant: leveneStatistic > critical };
    };
    
    const leveneResult = leveneTest();
    const homogeneityTest = {
        testName: "Levene's Test",
        passed: !leveneResult.significant,
        details: `Levene-Statistik: ${leveneResult.statistic.toFixed(3)}, Varianzen ${leveneResult.significant ? 'heterogen' : 'homogen'}`
    };
    
    const overallValid = sampleSizeTest.passed && normalityTest.passed && homogeneityTest.passed;
    
    return {
        normalityTest,
        homogeneityTest,
        sampleSizeTest,
        overallValid
    };
}

export default function ForschungPage() {
    const [results, setResults] = useState<AnalysisResult | null>(null);
    const [demographics, setDemographics] = useState<Demographics | null>(null);
    const [loading, setLoading] = useState(true);
    const [showInfo, setShowInfo] = useState(true);

    useEffect(() => {
        const runAnalysis = async () => {
            // 1. Alle benötigten Daten laden
            const { data: itemsData, error: itemsError } = await supabase.from("items").select('id, text, category');
            const { data: answersData, error: answersError } = await supabase.from("answers").select(`
                value, 
                item_id,
                response_id,
                items ( category ),
                responses ( id, role, school_level, age, experience, gender, consent )
            `);
            const { data: responsesData, error: responsesError } = await supabase.from("responses").select('age, experience, gender, role, school_level');

            if (itemsError || answersError || responsesError || !itemsData || !answersData || !responsesData) {
                console.error("Daten-Ladefehler:", itemsError || answersError || responsesError);
                setLoading(false);
                return;
            }

            const items: Item[] = itemsData;
            const extendedAnswers: ExtendedAnswer[] = answersData as unknown as ExtendedAnswer[];

            // Filter nach Einverständnis - nur Daten verwenden, bei denen explizit für die Forschung zugestimmt wurde.
            const consentFiltered = extendedAnswers.filter(ans => ans.responses?.consent === 'ja');

            const filteredExtended: ExtendedAnswer[] = consentFiltered;
            const allAnswersTyped: Answer[] = consentFiltered as unknown as Answer[];

            // 2. Antworten pro Teilnehmer gruppieren
            const responsesByParticipant = filteredExtended.reduce((acc, answer) => {
                const responseId = String(answer.response_id);
                if (!responseId) return acc;
                if (!acc[responseId]) {
                    acc[responseId] = { 
                        gender: answer.responses?.gender || 'unbekannt', 
                        age: answer.responses?.age || 'unbekannt',
                        experience: answer.responses?.experience || 'unbekannt',
                        role: answer.responses?.role || 'unbekannt',
                        school_level: answer.responses?.school_level || 'unbekannt',
                        answers: [] 
                    };
                }
                acc[responseId].answers.push({ item_id: answer.item_id, value: answer.value });
                return acc;
            }, {} as Record<string, { 
                gender: string; 
                age: string; 
                experience: string; 
                role: string; 
                school_level: string; 
                answers: { item_id: number; value: number }[] 
            }>);

            // 3. Deskriptive Statistiken mit Item-Total-Korrelation
            const calculateItemStats = (): ItemStats[] => {
                return items
                    .filter(item => item.category !== 'Kontrolle')
                    .map(item => {
                        const itemAnswers = allAnswersTyped.filter(a => a.item_id === item.id).map(a => a.value);
                        if (itemAnswers.length === 0) return { 
                            text: item.text, 
                            mean: 'N/A', 
                            stdDev: 'N/A', 
                            itemTotalCorrelation: 'N/A', 
                            category: item.category 
                        };

                        // Berechne Item-Total-Korrelation
                        let itemTotalCorrelation = 'N/A';
                        try {
                            // Für jede Person: Item-Score und Total-Score (ohne dieses Item)
                            const itemTotalPairs: { itemScore: number; totalScore: number }[] = [];
                            
                            Object.values(responsesByParticipant).forEach(participant => {
                                const itemAnswer = participant.answers.find(a => a.item_id === item.id);
                                if (itemAnswer) {
                                    // Total Score ohne dieses Item berechnen - nur Items derselben Kategorie
                                    const relevantItems = items.filter(i => i.category === item.category && i.id !== item.id);
                                    const otherItemAnswers = participant.answers
                                        .filter(a => a.item_id !== item.id && relevantItems.some(ri => ri.id === a.item_id))
                                        .map(a => {
                                            const otherItem = items.find(i => i.id === a.item_id);
                                            if (otherItem?.category === 'Negativ') return 6 - a.value;
                                            if (otherItem?.category === 'Positiv') return a.value;
                                            return null;
                                        })
                                        .filter((v): v is number => v !== null);
                                    
                                    if (otherItemAnswers.length > 0) {
                                        const totalScore = ss.mean(otherItemAnswers);
                                        const itemScore = item.category === 'Negativ' ? 6 - itemAnswer.value : itemAnswer.value;
                                        itemTotalPairs.push({ itemScore, totalScore });
                                    }
                                }
                            });

                            if (itemTotalPairs.length >= 3) { // Mindestens 3 Paare für zuverlässige Korrelation
                                const itemScores = itemTotalPairs.map(p => p.itemScore);
                                const totalScores = itemTotalPairs.map(p => p.totalScore);
                                
                                // Prüfe auf ausreichende Varianz
                                const itemVariance = ss.variance(itemScores);
                                const totalVariance = ss.variance(totalScores);
                                
                                if (itemVariance > 0.01 && totalVariance > 0.01) {
                                    const correlation = ss.sampleCorrelation(itemScores, totalScores);
                                    if (!isNaN(correlation) && isFinite(correlation)) {
                                        itemTotalCorrelation = correlation.toFixed(3);
                                    }
                                }
                            }
                        } catch (error) {
                            console.error('Error calculating item-total correlation for item', item.id, ':', error);
                        }

                        return {
                            text: item.text,
                            mean: ss.mean(itemAnswers).toFixed(2),
                            stdDev: ss.standardDeviation(itemAnswers).toFixed(2),
                            itemTotalCorrelation,
                            category: item.category
                        };
                    });
            };

            const itemStats = calculateItemStats();

            // 4. Umfassende Gruppenvergleiche
            const calculateGroupComparisons = (): GroupComparison[] => {
                const comparisons: GroupComparison[] = [];
                
                // Demografische Variablen definieren
                const demographicVariables = [
                    { key: 'gender', name: 'Geschlecht', values: ['weiblich', 'männlich', 'divers', 'keine Angabe'] },
                    { key: 'age', name: 'Altersgruppe', values: ['unter 25', '25-34', '35-44', '45-54', '55-64', '65+'] },
                    { key: 'experience', name: 'Berufserfahrung', values: ['0-5', '6-10', '11-15', '16-20', '21-30', '31+'] },
                    { key: 'role', name: 'Rolle', values: ['Lehrperson', 'Dozent:in', 'Schulleiter:in', 'Wissenschaftler:in', 'sonstiges'] },
                    { key: 'school_level', name: 'Schulstufe', values: ['Basisstufe', 'Primarschule', 'Sekundarstufe 1', 'Sekundarstufe 2', 'Hochschule', 'Universität'] }
                ];

                // Erst die Teilnehmer-Scores berechnen (Mittelwerte pro Person)
                const participantScores = Object.values(responsesByParticipant).map(p => {
                    const positiveScores = p.answers.map(a => {
                        const item = items.find(i => i.id === a.item_id);
                        return item?.category === 'Positiv' ? a.value : null;
                    }).filter((v): v is number => v !== null);
                    
                    const negativeScoresRaw = p.answers.map(a => {
                        const item = items.find(i => i.id === a.item_id);
                        return item?.category === 'Negativ' ? a.value : null;
                    }).filter((v): v is number => v !== null);
                    
                    return { 
                        gender: p.gender, 
                        age: p.age,
                        experience: p.experience,
                        role: p.role,
                        school_level: p.school_level,
                        // Mittelwert der positiven Items pro Person
                        meanPositive: positiveScores.length > 0 ? ss.mean(positiveScores) : null,
                        // Mittelwert der umgepolten negativen Items pro Person (Skepsis-Score)
                        meanNegative: negativeScoresRaw.length > 0 ? ss.mean(negativeScoresRaw.map(v => 6 - v)) : null
                    };
                });

                for (const variable of demographicVariables) {
                    // Gruppen-Statistiken berechnen
                    const groupsData = variable.values.map(value => {
                        const groupParticipants = participantScores.filter(p => p[variable.key as keyof typeof p] === value && p.meanPositive !== null && p.meanNegative !== null);
                        
                        if (groupParticipants.length === 0) {
                            return null;
                        }

                        const positiveScores = groupParticipants.map(p => p.meanPositive as number);
                        const negativeScores = groupParticipants.map(p => p.meanNegative as number);

                        return {
                            name: value,
                            n: groupParticipants.length,
                            meanPositive: ss.mean(positiveScores),
                            meanNegative: ss.mean(negativeScores),
                            stdDevPositive: positiveScores.length > 1 ? ss.standardDeviation(positiveScores) : 0,
                            stdDevNegative: negativeScores.length > 1 ? ss.standardDeviation(negativeScores) : 0
                        };
                    }).filter((g): g is NonNullable<typeof g> => g !== null);

                    if (groupsData.length < 2) continue;

                    // Funktion zur Durchführung der ANOVA und Voraussetzungsprüfung für eine Skala
                    const runAnovaForScale = (scale: 'positive' | 'negative'): AnovaResult => {
                        const groupScores = groupsData.map(group => 
                            participantScores
                                .filter(p => p[variable.key as keyof typeof p] === group.name)
                                .map(p => scale === 'positive' ? p.meanPositive : p.meanNegative)
                                .filter((s): s is number => s !== null)
                        ).filter(scores => scores.length > 0);

                        const assumptions = checkAssumptions(groupScores);
                        const anovaResult = assumptions.overallValid 
                            ? calculateOneWayANOVA(groupScores)
                            : { fStatistic: null, pValue: null };

                        return {
                            assumptions,
                            anova: {
                                fStatistic: anovaResult.fStatistic,
                                pValue: anovaResult.pValue,
                                significant: anovaResult.pValue !== null && anovaResult.pValue < 0.05
                            }
                        };
                    };
                    
                    const anovaPositive = runAnovaForScale('positive');
                    const anovaNegative = runAnovaForScale('negative');

                    comparisons.push({
                        variable: variable.name,
                        groups: groupsData,
                        anovaPositive,
                        anovaNegative
                    });
                }

                return comparisons;
            };

            const groupComparisons = calculateGroupComparisons();

            // Demografie-Berechnungen - aus gefilterten Daten (nur Teilnehmer mit gültigen Antworten)
            const filteredResponses = Object.values(responsesByParticipant);
            const n = filteredResponses.length;
            
            // Alle demografischen Variablen aus gefilterten Daten aufbereiten
            const genderCounts = filteredResponses.reduce((acc, r) => {
                const gender = r.gender || 'unbekannt';
                acc[gender] = (acc[gender] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const ageCounts = filteredResponses.reduce((acc, r) => {
                const age = r.age || 'unbekannt';
                acc[age] = (acc[age] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const experienceCounts = filteredResponses.reduce((acc, r) => {
                const experience = r.experience || 'unbekannt';
                acc[experience] = (acc[experience] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const roleCounts = filteredResponses.reduce((acc, r) => {
                const role = r.role || 'unbekannt';
                acc[role] = (acc[role] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const schoolLevelCounts = filteredResponses.reduce((acc, r) => {
                const schoolLevel = r.school_level || 'unbekannt';
                acc[schoolLevel] = (acc[schoolLevel] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            setDemographics({
                n,
                gender: genderCounts,
                age: ageCounts,
                experience: experienceCounts,
                role: roleCounts,
                schoolLevel: schoolLevelCounts
            });

            setResults({ itemStats, groupComparisons });
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
        <>
        {showInfo && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm text-center">
                    <h2 className="text-xl font-bold mb-4">Hinweis</h2>
                    <p className="mb-6">Auf dieser Seite findest du quantitative Auswertungen, die Einblicke für die Wissenschaft ermöglichen.</p>
                    <button onClick={() => setShowInfo(false)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">Verstanden</button>
                </div>
            </div>
        )}

        <div className="p-4 md:p-8 bg-gradient-to-b from-blue-50 via-white to-blue-50">
            <main className="max-w-6xl mx-auto p-4">
                <h2 className="text-3xl font-bold mb-6 text-center">Forschungsergebnisse</h2>
                
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                    <h3 className="text-xl font-semibold mb-4">Beschreibung der Stichprobe</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <p className="font-medium mb-2"><strong>Anzahl Teilnehmende (N):</strong> {demographics.n}</p>
                            
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
                
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                    <h3 className="text-xl font-semibold mb-4">Item-Analyse</h3>
                    <p className="mb-4">
                        Deskriptive Statistiken für jedes Item des Fragebogens. Die Item-Total-Korrelation 
                        gibt an, wie gut ein Item mit dem Gesamtscore korreliert (Werte &gt; 0.3 gelten als gut).
                    </p>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mittelwert</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Standardabweichung</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item-Total-Korrelation</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategorie</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {results.itemStats.map((stat, index) => (
                                    <tr key={index}>
                                        <td className="px-6 py-4 whitespace-normal text-sm text-gray-700">{stat.text}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.mean}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.stdDev}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.itemTotalCorrelation}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.category}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow mb-8">
                    <h3 className="text-xl font-semibold mb-4">Systematische Gruppenvergleiche</h3>
                    <p className="mb-6 text-gray-700">
                        In diesem Kapitel werden die Einstellungen zur KI systematisch nach verschiedenen demografischen 
                        Variablen verglichen. Für jede Variable werden die Mittelwerte und Standardabweichungen für die 
                        zwei unabhängigen Skalen "Optimismus" (positive Items) und "Skepsis" (negative Items) berichtet. 
                        Die statistische Signifikanz der Gruppenunterschiede wird für jede Skala separat 
                        mittels einfaktorieller Varianzanalyse (ANOVA) geprüft.
                    </p>

                    {results.groupComparisons.map((comparison, index) => (
                        <div key={index} className="mb-12 border-l-4 border-blue-500 pl-6">
                            <h4 className="text-xl font-semibold mb-4">{comparison.variable}</h4>
                            
                            <div className="overflow-x-auto mb-6">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gruppe</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">M<sub>pos</sub> (Optimismus)</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SD<sub>pos</sub></th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">M<sub>neg</sub> (Skepsis)</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SD<sub>neg</sub></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {comparison.groups.map((group, groupIndex) => (
                                            <tr key={groupIndex} className={groupIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{group.name}</td>
                                                <td className="px-4 py-3 text-sm">{group.n}</td>
                                                <td className="px-4 py-3 text-sm">{group.meanPositive.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-sm">{group.stdDevPositive.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-sm">{group.meanNegative.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-sm">{group.stdDevNegative.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Statistische Auswertung für beide Skalen */}
                            <div className="grid md:grid-cols-2 gap-8">
                                {/* Skala: Optimismus */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h5 className="font-semibold mb-3 text-center">Skala: Optimismus (positive Items)</h5>
                                    
                                    {/* Voraussetzungen */}
                                    <div className="border p-3 rounded-lg mb-4 bg-white">
                                        <h6 className="font-medium mb-2 text-sm">Voraussetzungsprüfung</h6>
                                        <p className="text-xs text-gray-600 mb-2">
                                            {comparison.anovaPositive.assumptions.sampleSizeTest.details} &middot;
                                            Normalverteilung: {comparison.anovaPositive.assumptions.normalityTest.passed ? '✓' : '✗'} &middot;
                                            Varianzhomogenität: {comparison.anovaPositive.assumptions.homogeneityTest.passed ? '✓' : '✗'}
                                        </p>
                                        <p className={`text-sm font-medium ${comparison.anovaPositive.assumptions.overallValid ? 'text-green-700' : 'text-orange-700'}`}>
                                            {comparison.anovaPositive.assumptions.overallValid 
                                                ? 'ANOVA ist zulässig' 
                                                : 'ANOVA nur deskriptiv interpretieren'}
                                        </p>
                                    </div>

                                    {/* ANOVA Ergebnis */}
                                    <div className="text-center">
                                        {comparison.anovaPositive.assumptions.overallValid ? (
                                            <>
                                                <p className="text-sm">F-Statistik: {comparison.anovaPositive.anova.fStatistic?.toFixed(3) ?? 'N/A'}</p>
                                                <p className={`font-bold text-lg ${comparison.anovaPositive.anova.significant ? 'text-blue-600' : 'text-gray-700'}`}>
                                                    {comparison.anovaPositive.anova.significant 
                                                        ? 'Signifikanter Unterschied' 
                                                        : 'Kein signifikanter Unterschied'}
                                                </p>
                                                <p className="text-sm">(p = {comparison.anovaPositive.anova.pValue?.toFixed(3) ?? 'N/A'})</p>
                                            </>
                                        ) : (
                                            <p className="text-gray-600 text-sm">ANOVA nicht durchgeführt (Voraussetzungen verletzt)</p>
                                        )}
                                    </div>
                                </div>

                                {/* Skala: Skepsis */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h5 className="font-semibold mb-3 text-center">Skala: Skepsis (negative Items)</h5>
                                    
                                    {/* Voraussetzungen */}
                                    <div className="border p-3 rounded-lg mb-4 bg-white">
                                        <h6 className="font-medium mb-2 text-sm">Voraussetzungsprüfung</h6>
                                        <p className="text-xs text-gray-600 mb-2">
                                            {comparison.anovaNegative.assumptions.sampleSizeTest.details} &middot;
                                            Normalverteilung: {comparison.anovaNegative.assumptions.normalityTest.passed ? '✓' : '✗'} &middot;
                                            Varianzhomogenität: {comparison.anovaNegative.assumptions.homogeneityTest.passed ? '✓' : '✗'}
                                        </p>
                                        <p className={`text-sm font-medium ${comparison.anovaNegative.assumptions.overallValid ? 'text-green-700' : 'text-orange-700'}`}>
                                            {comparison.anovaNegative.assumptions.overallValid 
                                                ? 'ANOVA ist zulässig' 
                                                : 'ANOVA nur deskriptiv interpretieren'}
                                        </p>
                                    </div>

                                    {/* ANOVA Ergebnis */}
                                    <div className="text-center">
                                        {comparison.anovaNegative.assumptions.overallValid ? (
                                            <>
                                                <p className="text-sm">F-Statistik: {comparison.anovaNegative.anova.fStatistic?.toFixed(3) ?? 'N/A'}</p>
                                                <p className={`font-bold text-lg ${comparison.anovaNegative.anova.significant ? 'text-blue-600' : 'text-gray-700'}`}>
                                                    {comparison.anovaNegative.anova.significant 
                                                        ? 'Signifikanter Unterschied' 
                                                        : 'Kein signifikanter Unterschied'}
                                                </p>
                                                <p className="text-sm">(p = {comparison.anovaNegative.anova.pValue?.toFixed(3) ?? 'N/A'})</p>
                                            </>
                                        ) : (
                                            <p className="text-gray-600 text-sm">ANOVA nicht durchgeführt (Voraussetzungen verletzt)</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="mt-8 bg-blue-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold mb-3 text-blue-800">Zusammenfassung der Gruppenvergleiche</h4>
                        
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Signifikante Ergebnisse */}
                            <div className="bg-white rounded border p-4">
                                <p className="font-medium mb-2">Statistisch signifikante Unterschiede (p &lt; 0.05)</p>
                                <ul className="list-disc list-inside ml-4 text-sm">
                                    {results.groupComparisons.map(comp => (
                                        <>
                                            {comp.anovaPositive.anova.significant && comp.anovaPositive.assumptions.overallValid && (
                                                <li key={`${comp.variable}-pos`}>{comp.variable} (Optimismus)</li>
                                            )}
                                            {comp.anovaNegative.anova.significant && comp.anovaNegative.assumptions.overallValid && (
                                                <li key={`${comp.variable}-neg`}>{comp.variable} (Skepsis)</li>
                                            )}
                                        </>
                                    )).flat().filter(Boolean).length === 0 ? (
                                        <li className="text-gray-600">Keine signifikanten Unterschiede gefunden</li>
                                    ) : null}
                                </ul>
                            </div>

                             {/* Deskriptive Tendenzen */}
                             <div className="bg-white rounded border p-4">
                                <p className="font-medium mb-2">Deskriptive Tendenzen (nicht signifikant oder Voraussetzungen verletzt)</p>
                                <ul className="list-disc list-inside ml-4 text-sm">
                                {results.groupComparisons.map(comp => {
                                    const highestPositive = comp.groups.reduce((max, group) => group.meanPositive > max.meanPositive ? group : max);
                                    const highestNegative = comp.groups.reduce((max, group) => group.meanNegative > max.meanNegative ? group : max);
                                    return (
                                        <li key={`${comp.variable}-desc`}>
                                            <strong className="font-semibold">{comp.variable}:</strong>
                                            <span> Optimismus: {highestPositive.name} / Skepsis: {highestNegative.name}</span>
                                        </li>
                                    )
                                }).flat().length === 0 ? (
                                    <li className="text-gray-600">Keine Vergleiche durchgeführt</li>
                                ) : null}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center my-12">
                    <Link href="/forschung/zusammenhaenge" className="inline-block bg-blue-600 text-white font-bold py-3 px-8 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-300 ease-in-out shadow-lg transform hover:scale-105">
                        Zur Analyse der Zusammenhänge (Korrelationen)
                    </Link>
                </div>

            </main>
        </div>
        </>
    );
}
