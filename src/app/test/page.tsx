"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter } from "next/navigation";

// --- Typ-Definitionen ---
interface Item {
    id: number;
    text: string;
}

interface DemographicQuestion {
    id: 'age' | 'experience' | 'gender' | 'schoolLevel' | 'role';
    type: 'demographic';
    label: string;
    inputType: 'number' | 'text' | 'select' | 'button';
    options?: { value: string; label: string }[];
}

interface ItemQuestion extends Item {
    type: 'item';
}

type Question = DemographicQuestion | ItemQuestion;

// Validierungsfunktionen
const validateInput = {
  // Demografische Daten validieren
  demographic: (questionId: string, value: any): boolean => {
    if (!value || typeof value !== 'string') return false;
    
    const validOptions: { [key: string]: string[] } = {
      role: ['Lehrperson', 'Dozent:in', 'Schulleiter:in', 'Wissenschaftler:in', 'sonstiges'],
      schoolLevel: ['Basisstufe', 'Primarschule', 'Sekundarstufe 1', 'Sekundarstufe 2', 'Hochschule', 'Universität'],
      experience: ['0-5', '6-10', '11-15', '16-20', '21-30', '31+'],
      gender: ['weiblich', 'männlich', 'divers', 'keine Angabe'],
      age: ['unter 25', '25-34', '35-44', '45-54', '55-64', '65+']
    };
    
    return validOptions[questionId]?.includes(value) || false;
  },
  
  // Item-Antworten validieren (1-5 Skala)
  item: (value: any): boolean => {
    const numValue = Number(value);
    return Number.isInteger(numValue) && numValue >= 1 && numValue <= 5;
  },
  
  // String sanitizen
  sanitizeString: (input: string): string => {
    return input.trim().slice(0, 200); // Max 200 Zeichen
  },
  
  // Response ID validieren
  validateResponseId: (id: any): boolean => {
    return typeof id === 'number' && id > 0;
  }
};

// Rate Limiting (einfache client-side Implementierung)
const rateLimiter = {
  attempts: 0,
  lastAttempt: Date.now(),
  maxAttempts: 10, // Max 10 Submissions pro Stunde
  timeWindow: 60 * 60 * 1000, // 1 Stunde
  
  canSubmit(): boolean {
    const now = Date.now();
    
    // Reset counter nach Zeitfenster
    if (now - this.lastAttempt > this.timeWindow) {
      this.attempts = 0;
    }
    
    if (this.attempts >= this.maxAttempts) {
      return false;
    }
    
    this.attempts++;
    this.lastAttempt = now;
    return true;
  }
};

// --- Hauptkomponente ---
export default function TestPage() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [buttonDisabled, setButtonDisabled] = useState(false);
    const router = useRouter();

    // Lade Items und erstelle die Fragenliste
    useEffect(() => {
        async function fetchAndSetQuestions() {
            const { data, error } = await supabase
                .from("items")
                .select("id, text")
                .neq('category', 'Kontrolle')
                .order("id", { ascending: true });

            if (error || !data) {
                console.error("Fehler beim Laden der Items:", error);
                setLoading(false);
                return;
            }

            const demographicQuestions: DemographicQuestion[] = [
                { id: 'role', type: 'demographic', label: 'Welches ist Ihre primäre Funktion in der Schule?', inputType: 'button', options: [
                    { value: 'Lehrperson', label: 'Lehrperson' },
                    { value: 'Dozent:in', label: 'Dozent:in' },
                    { value: 'Schulleiter:in', label: 'Schulleiter:in' },
                    { value: 'Wissenschaftler:in', label: 'Wissenschaftler:in' },
                    { value: 'sonstiges', label: 'Sonstiges' },
                ]},
                { id: 'schoolLevel', type: 'demographic', label: 'Auf welcher Schulstufe unterrichten Sie hauptsächlich?', inputType: 'button', options: [
                    { value: 'Basisstufe', label: 'Basisstufe' },
                    { value: 'Primarschule', label: 'Primarschule' },
                    { value: 'Sekundarstufe 1', label: 'Sekundarstufe 1' },
                    { value: 'Sekundarstufe 2', label: 'Sekundarstufe 2' },
                    { value: 'Hochschule', label: 'Hochschule' },
                    { value: 'Universität', label: 'Universität' },
                ]},
                { id: 'experience', type: 'demographic', label: 'Wie viele Jahre Berufserfahrung haben Sie?', inputType: 'button', options: [
                    { value: '0-5', label: '0–5 Jahre' },
                    { value: '6-10', label: '6–10 Jahre' },
                    { value: '11-15', label: '11–15 Jahre' },
                    { value: '16-20', label: '16–20 Jahre' },
                    { value: '21-30', label: '21–30 Jahre' },
                    { value: '31+', label: '31+ Jahre' },
                ]},
                { id: 'gender', type: 'demographic', label: 'Welchem Geschlecht fühlen Sie sich zugehörig?', inputType: 'button', options: [
                    { value: 'weiblich', label: 'Weiblich' },
                    { value: 'männlich', label: 'Männlich' },
                    { value: 'divers', label: 'Divers' },
                    { value: 'keine Angabe', label: 'Keine Angabe' }
                ]},
                { id: 'age', type: 'demographic', label: 'Wie alt sind Sie?', inputType: 'button', options: [
                    { value: 'unter 25', label: 'Unter 25' },
                    { value: '25-34', label: '25–34' },
                    { value: '35-44', label: '35–44' },
                    { value: '45-54', label: '45–54' },
                    { value: '55-64', label: '55–64' },
                    { value: '65+', label: '65+' },
                ]},
            ];

            const itemQuestions: ItemQuestion[] = data.map(item => ({ ...item, type: 'item' }));
            setQuestions([...demographicQuestions, ...itemQuestions]);
            setLoading(false);
        }
        fetchAndSetQuestions();
    }, []);

    // Speichert eine Antwort und geht zum nächsten Schritt
    const handleAnswer = (questionId: string, value: any) => {
        // Input Validation
        if (currentQuestion.type === 'demographic') {
            if (!validateInput.demographic(currentQuestion.id, value)) {
                alert('Ungültige Eingabe. Bitte wählen Sie eine gültige Option.');
                return;
            }
        } else if (currentQuestion.type === 'item') {
            if (!validateInput.item(value)) {
                alert('Ungültige Bewertung. Bitte wählen Sie einen Wert zwischen 1 und 5.');
                return;
            }
        }
        
        setButtonDisabled(true);
        const sanitizedValue = typeof value === 'string' ? validateInput.sanitizeString(value) : value;
        const newAnswers = { ...answers, [questionId]: sanitizedValue };
        setAnswers(newAnswers);

        setTimeout(() => {
            setButtonDisabled(false);
            if (currentStep < questions.length - 1) {
                setCurrentStep(currentStep + 1);
            } else {
                handleSubmit(newAnswers);
            }
        }, 200);
    };
    
    // Funktion zum Absenden der gesammelten Daten
    async function handleSubmit(finalAnswers: Record<string, any>) {
        // Rate Limiting Check
        if (!rateLimiter.canSubmit()) {
            alert('Zu viele Versuche. Bitte warten Sie eine Stunde bevor Sie es erneut versuchen.');
            return;
        }
        
        setSubmitting(true);
        
        try {
            // Validiere alle demografischen Antworten
            const demographicQuestions = ['role', 'schoolLevel', 'experience', 'gender', 'age'];
            for (const qId of demographicQuestions) {
                if (!validateInput.demographic(qId, finalAnswers[qId])) {
                    throw new Error(`Ungültige demografische Daten: ${qId}`);
                }
            }
            
            // Validiere alle Item-Antworten
            const itemAnswers = Object.entries(finalAnswers).filter(([key]) => key.startsWith('item_'));
            for (const [key, value] of itemAnswers) {
                if (!validateInput.item(value)) {
                    throw new Error(`Ungültige Item-Antwort: ${key}`);
                }
            }
            
            const { data: responseData, error: responseError } = await supabase
                .from("responses")
                .insert([{ 
                    age: validateInput.sanitizeString(finalAnswers.age), 
                    experience: validateInput.sanitizeString(finalAnswers.experience), 
                    gender: validateInput.sanitizeString(finalAnswers.gender), 
                    school_level: validateInput.sanitizeString(finalAnswers.schoolLevel), 
                    role: validateInput.sanitizeString(finalAnswers.role) 
                }])
                .select("id")
                .single();

            if (responseError || !responseData) {
                throw new Error("Fehler beim Speichern der Metadaten: " + (responseError?.message || ""));
            }
            
            const response_id = responseData.id;
            
            // Validiere Response ID
            if (!validateInput.validateResponseId(response_id)) {
                throw new Error("Ungültige Response ID erhalten");
            }

            const itemAnswersToInsert = questions
                .filter((q): q is ItemQuestion => q.type === 'item')
                .map(q => {
                    const itemValue = finalAnswers[`item_${q.id}`];
                    
                    // Zusätzliche Validierung vor Insert
                    if (!validateInput.item(itemValue)) {
                        throw new Error(`Ungültige Item-Antwort für Item ${q.id}: ${itemValue}`);
                    }
                    
                    return {
                        response_id,
                        item_id: q.id,
                        value: itemValue,
                    };
                });

            const { error: answersError } = await supabase.from("answers").insert(itemAnswersToInsert);

            if (answersError) {
                // Cleanup: Lösche Response wenn Answers fehlschlagen
                await supabase.from("responses").delete().eq("id", response_id);
                throw new Error("Fehler beim Speichern der Antworten: " + answersError.message);
            }

            router.push(`/auswertung?response_id=${response_id}`);
            
        } catch (error) {
            console.error('Validation or submission error:', error);
            alert(error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.');
            setSubmitting(false);
        }
    }

    if (loading) return <div className="text-center p-8">Lade Test...</div>;
    if (submitting) return <div className="text-center p-8">Speichere Ergebnisse...</div>;
    if (questions.length === 0) return <div className="text-center p-8">Fehler: Test konnte nicht geladen werden.</div>;

    const progress = Math.round(((currentStep) / questions.length) * 100);
    const currentQuestion = questions[currentStep];

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <div className="w-full bg-gray-300 h-4 sticky top-0 left-0 z-20 shadow">
                <div className="bg-blue-600 h-4 rounded-b" style={{ width: `${progress}%`, transition: 'width 0.3s ease-in-out' }}></div>
            </div>
            <main className="flex-grow flex items-center justify-center p-4 pt-10">
                <div className="w-full max-w-2xl text-center">
                    {currentQuestion.type === 'demographic' && (
                        <div className="bg-white rounded-xl shadow-lg p-8 min-h-[350px] flex flex-col justify-center">
                            <div className="mb-2 text-sm font-medium text-blue-600 uppercase tracking-wide">
                                Schritt {currentStep + 1} von {questions.length}
                            </div>
                            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-gray-800 leading-relaxed">{currentQuestion.label}</h2>
                            <div className="flex flex-col items-center gap-4">
                                {currentQuestion.inputType === 'button' && currentQuestion.options && currentQuestion.options.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleAnswer(currentQuestion.id, opt.value)}
                                        className="w-full max-w-xs py-4 px-6 text-lg border-2 border-gray-200 rounded-lg bg-white hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 font-medium text-gray-700 hover:text-blue-700"
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {currentQuestion.type === 'item' && (
                        <div className="bg-white rounded-xl shadow-lg p-8 min-h-[350px] flex flex-col justify-center">
                            <div className="mb-2 text-sm font-medium text-blue-600 uppercase tracking-wide">
                                Frage {currentStep - 4} von {questions.length - 5} {/* 5 demografische Fragen */}
                            </div>
                            <p className="text-xl md:text-2xl mb-10 leading-relaxed text-gray-800 font-medium">{currentQuestion.text}</p>
                            <div className="flex justify-center items-center gap-2 md:gap-4 mb-6">
                                <span className="text-sm text-gray-500 w-24 text-right font-medium">Stimme nicht zu</span>
                                {[1, 2, 3, 4, 5].map(value => (
                                    <button 
                                        key={value}
                                        onClick={e => {
                                            if (!buttonDisabled) handleAnswer(`item_${currentQuestion.id}`, value);
                                        }}
                                        disabled={buttonDisabled}
                                        className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-lg font-bold border-2 border-gray-300 rounded-full hover:bg-blue-100 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-110 ${buttonDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        aria-label={`Bewerte mit ${value}`}
                                    >
                                        {value}
                                    </button>
                                ))}
                                <span className="text-sm text-gray-500 w-24 text-left font-medium">Stimme voll zu</span>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <footer className="p-4 text-center">
                <a 
                    href="/datenschutz" 
                    className="text-sm text-gray-500 hover:text-blue-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Datenschutzerklärung
                </a>
            </footer>
        </div>
    );
} 