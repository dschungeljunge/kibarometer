'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, Mic, Square, ChevronRight, RotateCcw, Loader2, ShieldCheck, Flag, Lock } from "lucide-react";
import { supabase } from "@/utils/supabaseClient";
import type { ChallengeWithStats } from "@/types/database";

const ROLES = [
  { value: 'Lehrperson', label: 'Lehrperson' },
  { value: 'Dozent:in', label: 'Dozent:in' },
  { value: 'Schulleiter:in', label: 'Schulleiter:in' },
  { value: 'Wissenschaftler:in', label: 'Wissenschaftler:in' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

const LEVELS = [
  { value: 'Basisstufe', label: 'Basisstufe' },
  { value: 'Primarschule', label: 'Primarschule' },
  { value: 'Sekundarstufe 1', label: 'Sekundarstufe 1' },
  { value: 'Sekundarstufe 2', label: 'Sekundarstufe 2' },
  { value: 'Hochschule', label: 'Hochschule' },
  { value: 'Universität', label: 'Universität' },
];

const BUTTON_COLORS = [
  "from-blue-600 to-blue-700",
  "from-indigo-600 to-indigo-700",
  "from-violet-600 to-violet-700",
  "from-purple-600 to-purple-700",
  "from-fuchsia-600 to-fuchsia-700",
  "from-pink-600 to-pink-700",
  "from-cyan-600 to-cyan-700",
  "from-teal-600 to-teal-700",
  "from-emerald-600 to-emerald-700",
];

// Anonyme Geräte-ID (bleibt im localStorage)
function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("challenge_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("challenge_device_id", id);
  }
  return id;
}

export default function HerausforderungenPage() {
  const [challenges, setChallenges] = useState<ChallengeWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<string, { impact: number; difficulty: number }>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deckCompleted, setDeckCompleted] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // User Selection State
  const [userRole, setUserRole] = useState<string>("");
  const [userLevel, setUserLevel] = useState<string>("");
  const [selectionComplete, setSelectionComplete] = useState(false);
  const [playButtonColor, setPlayButtonColor] = useState(BUTTON_COLORS[0]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceId = useRef<string>("");

  // Challenges laden
  const loadChallenges = useCallback(async () => {
    if (!selectionComplete) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("challenges_with_stats")
      .select("*")
      .order("rating_count", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Fehler beim Laden:", error);
    }

    if (data && data.length > 0) {
      let loaded = data as ChallengeWithStats[];
      
      // Sortieren: Matches zuerst
      if (userLevel) {
        loaded.sort((a, b) => {
          const aMatch = a.creator_level === userLevel;
          const bMatch = b.creator_level === userLevel;
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return 0;
        });
      }

      setChallenges(loaded);
      
      // Initiale Ratings setzen
      const initialRatings: Record<string, { impact: number; difficulty: number }> = {};
      data.forEach((c) => {
        initialRatings[c.id] = { impact: 50, difficulty: 50 };
      });
      setRatings(initialRatings);
    }
    setLoading(false);
  }, [selectionComplete, userLevel]);

  useEffect(() => {
    deviceId.current = getDeviceId();
    if (selectionComplete) {
      loadChallenges();
    } else {
      setLoading(false);
    }
  }, [loadChallenges, selectionComplete]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  const currentChallenge = challenges[Math.min(currentIndex, challenges.length - 1)];

  const getAudioUrl = (audioPath: string) => {
    const { data } = supabase.storage.from("challenge-audio").getPublicUrl(audioPath);
    return data.publicUrl;
  };

  const togglePlay = () => {
    if (!currentChallenge) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (progressInterval.current) clearInterval(progressInterval.current);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(getAudioUrl(currentChallenge.audio_path));
    audioRef.current = audio;

    audio.onended = () => {
      setIsPlaying(false);
      setProgress(100);
      if (progressInterval.current) clearInterval(progressInterval.current);
    };

    audio.onplay = () => {
      progressInterval.current = setInterval(() => {
        if (audio.duration) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      }, 100);
    };

    audio.play().catch(() => setIsPlaying(false));
    setIsPlaying(true);
    setProgress(0);
  };

  const updateRating = (field: "impact" | "difficulty", value: number) => {
    if (!currentChallenge) return;
    setRatings((prev) => ({
      ...prev,
      [currentChallenge.id]: {
        ...prev[currentChallenge.id],
        [field]: value,
      },
    }));
  };

  const saveRating = async () => {
    if (!currentChallenge) return;

    const rating = ratings[currentChallenge.id];
    if (!rating) return;

    // Upsert: falls schon bewertet, aktualisieren
    await supabase.from("challenge_ratings").upsert(
      {
        challenge_id: currentChallenge.id,
        device_id: deviceId.current,
        impact: rating.impact,
        difficulty: rating.difficulty,
      },
      { onConflict: "challenge_id,device_id" }
    );
  };

  const reportSpam = async () => {
    if (!currentChallenge) return;
    if (!confirm("Möchtest du diesen Beitrag wirklich als Spam melden? Er wird dann zur Überprüfung ausgeblendet.")) return;

    const { error } = await supabase.rpc("report_challenge", {
      challenge_id: currentChallenge.id,
    });

    if (error) {
      console.error("Fehler beim Melden:", error);
      alert("Fehler beim Melden. Bitte versuche es später erneut.");
      return;
    }

    alert("Danke für den Hinweis. Der Beitrag wird überprüft.");
    
    // Lokal entfernen und zur nächsten springen
    setChallenges((prev) => prev.filter((c) => c.id !== currentChallenge.id));
    
    // Wenn es die letzte war, wird automatisch DeckCompleted getriggert oder der Index korrigiert sich durch das Re-Render
    if (currentIndex >= challenges.length - 1) {
       // Falls wir am Ende waren, eins zurück oder deckCompleted Status prüfen
       // Einfachste Lösung: currentIndex lassen, da das Array kürzer wird, rutscht die nächste nach vorne
       if (challenges.length <= 1) {
         setDeckCompleted(true);
       }
    }
    
    setIsPlaying(false);
    setProgress(0);
    audioRef.current?.pause();
  };

  const nextChallenge = async () => {
    setSubmitting(true);
    await saveRating();
    setSubmitting(false);

    // Neue Farbe für den Button zufällig wählen (aber anders als die aktuelle)
    const otherColors = BUTTON_COLORS.filter(c => c !== playButtonColor);
    setPlayButtonColor(otherColors[Math.floor(Math.random() * otherColors.length)]);

    audioRef.current?.pause();
    setIsPlaying(false);
    setProgress(0);
    if (progressInterval.current) clearInterval(progressInterval.current);

    if (currentIndex < challenges.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setDeckCompleted(true);
    }
  };

  // Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    setRecordingUrl(null);
    setRecordingBlob(null);
    setUploadSuccess(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordingBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        if (autoStopRef.current) clearTimeout(autoStopRef.current);
      };

      recorder.start();
      setIsRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => Math.min(prev + 1, 60));
      }, 1000);

      autoStopRef.current = setTimeout(() => {
        recorder.stop();
      }, 60000);
    } catch {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
  };

  const resetRecording = () => {
    stopRecording();
    setRecordingUrl(null);
    setRecordingBlob(null);
    setElapsed(0);
    setUploadSuccess(false);
  };

  const uploadRecording = async () => {
    if (!recordingBlob) return;

    setUploading(true);
    const fileName = `${deviceId.current}/${Date.now()}.webm`;

    // 1. Audio hochladen
    const { error: uploadError } = await supabase.storage
      .from("challenge-audio")
      .upload(fileName, recordingBlob, {
        contentType: "audio/webm",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload failed:", uploadError);
      setUploading(false);
      return;
    }

    // 2. Challenge-Eintrag erstellen (status: approved für Tests)
    const { error: insertError } = await supabase.from("challenges").insert({
      audio_path: fileName,
      duration_sec: elapsed,
      status: "approved", // TODO: auf "pending" ändern für Moderation
      device_id: deviceId.current,
      creator_role: userRole,
      creator_level: userLevel,
    });

    if (insertError) {
      console.error("Insert failed:", insertError);
    } else {
      setUploadSuccess(true);
      setRecordingBlob(null);
    }

    setUploading(false);
  };

  const formattedElapsed = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // Auswahl-Screen (bevor es losgeht)
  if (!selectionComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/90 backdrop-blur border border-blue-100 rounded-3xl shadow-xl p-8 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-blue-900">Willkommen</h1>
            <p className="text-neutral-500">Bitte wähle deine Funktion und Stufe, um passende Herausforderungen zu finden.</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-neutral-700 ml-1">Deine Funktion</label>
              <div className="grid grid-cols-1 gap-2">
                {ROLES.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => setUserRole(role.value)}
                    className={`p-3 rounded-xl text-left transition-all ${
                      userRole === role.value
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-neutral-700 ml-1">Deine Stufe</label>
              <div className="grid grid-cols-2 gap-2">
                {LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setUserLevel(level.value)}
                    className={`p-3 rounded-xl text-left text-sm transition-all ${
                      userLevel === level.value
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setSelectionComplete(true)}
            disabled={!userRole || !userLevel}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold text-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Loslegen
          </button>
        </div>
      </div>
    );
  }

  // Recorder UI (muss vor "keine Challenges" kommen!)
  if (showRecorder) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-8 w-full max-w-sm bg-white/80 backdrop-blur border border-blue-100 rounded-3xl shadow-xl p-8">
          {uploadSuccess ? (
            <>
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                <Mic className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-neutral-900 font-medium">Eingereicht</p>
                <p className="text-neutral-500 text-sm">Wird nach Prüfung freigeschaltet</p>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <button
                  type="button"
                  onClick={resetRecording}
                  className="w-full py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition"
                >
                  Weitere aufnehmen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecorder(false);
                    setUploadSuccess(false);
                  }}
                  className="w-full py-3 text-neutral-600 hover:text-neutral-900 transition text-sm"
                >
                  Zurück
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Inspiration / Teleprompter */}
              {!recordingUrl && (
                <div className="bg-blue-50/80 rounded-2xl p-5 w-full space-y-3 text-left border border-blue-100 mb-2">
                  <div className="flex items-center gap-2 text-blue-800 mb-1">
                    <h3 className="font-semibold text-sm uppercase tracking-wide">
                      Teile deine Herausforderung
                    </h3>
                  </div>
                  <div className="space-y-2 text-sm text-neutral-700 leading-relaxed">
                    <p>
                      <span className="font-semibold text-blue-600">1. Kontext:</span>{" "}
                      &quot;Ich unterrichte auf Stufe XY...&quot;
                    </p>
                    <p>
                      <span className="font-semibold text-blue-600">2. Situation:</span>{" "}
                      &quot;Mir fällt auf, dass...&quot;
                    </p>
                    <p>
                      <span className="font-semibold text-blue-600">3. Problem:</span>{" "}
                      &quot;Das ist eine Herausforderung, weil...&quot;
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={uploading}
                  className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording
                    ? "bg-red-500 shadow-[0_0_0_8px_rgba(239,68,68,0.2)]"
                    : "bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl"
                  } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isRecording ? (
                  <Square className="w-10 h-10 text-white" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
                {isRecording && (
                  <span className="absolute -bottom-8 text-sm text-neutral-600 font-mono">
                    {formattedElapsed} / 1:00
                  </span>
                )}
              </button>

              {recordingUrl && !isRecording && (
                <div className="w-full space-y-4">
                  <audio controls src={recordingUrl} className="w-full" />
                  <div className="flex gap-3 justify-center">
                    <button
                      type="button"
                      onClick={resetRecording}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Nochmal
                    </button>
                    <button
                      type="button"
                      onClick={uploadRecording}
                      disabled={uploading}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      {uploading ? "Lädt..." : "Absenden"}
                    </button>
                  </div>
                </div>
              )}

              {!recordingUrl && !isRecording && (
                <div className="space-y-4 w-full">
                  <p className="text-neutral-500 text-sm text-center">
                    Max. 60 Sekunden • Beliebig viele Versuche
                  </p>

                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 flex gap-3 items-start">
                    <ShieldCheck className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-700">
                        Anonym & Sicher
                      </p>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Bitte nenne keine Namen von Personen oder Schulen. Du kannst deine
                        Aufnahme vor dem Absenden anhören und neu aufnehmen.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowRecorder(false)}
                className="text-sm text-neutral-400 hover:text-neutral-600 transition mt-4"
              >
                Zurück
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Keine Challenges vorhanden
  if (challenges.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm bg-white/80 backdrop-blur border border-blue-100 rounded-3xl shadow-xl p-8">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
            <Mic className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-neutral-700">Noch keine Beiträge vorhanden</p>
          <button
            type="button"
            onClick={() => setShowRecorder(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition"
          >
            Ersten Beitrag aufnehmen
          </button>
        </div>
      </div>
    );
  }

  // Deck abgeschlossen
  if (deckCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-8 text-center max-w-sm bg-white/80 backdrop-blur border border-blue-100 rounded-3xl shadow-xl p-8">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
            <Mic className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-2">
            <p className="text-neutral-900 font-medium">Alle {challenges.length} gehört</p>
            <p className="text-neutral-500 text-sm">Eigene Herausforderung teilen?</p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={() => setShowRecorder(true)}
              className="w-full py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition"
            >
              Eigene aufnehmen
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentIndex(0);
                setDeckCompleted(false);
                setProgress(0);
              }}
              className="w-full py-3 text-neutral-600 hover:text-neutral-900 transition text-sm"
            >
              Nochmals anhören
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Hauptansicht: Anhören + Bewerten
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-10 w-full max-w-xl bg-white/90 backdrop-blur border border-blue-100 rounded-3xl shadow-2xl p-8">
        {/* Progress Dots */}
        <div className="flex gap-2">
          {challenges.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < currentIndex
                  ? "bg-blue-600"
                  : i === currentIndex
                  ? "bg-blue-300"
                  : "bg-blue-100"
              }`}
            />
          ))}
        </div>

        {/* Central Play Button */}
        <div className="relative">
          {currentChallenge.creator_level && currentChallenge.creator_level !== userLevel && (
             <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-full whitespace-nowrap border border-yellow-200 flex items-center gap-1">
               <Lock className="w-3 h-3" />
               Andere Stufe: {currentChallenge.creator_level}
             </div>
          )}

          <button
            type="button"
            onClick={togglePlay}
            className={`relative w-36 h-36 rounded-full bg-gradient-to-br ${playButtonColor} flex items-center justify-center transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-2xl ${
              isPlaying ? "shadow-[0_0_0_10px_rgba(37,99,235,0.12)]" : ""
            }`}
          >
            <Volume2
              className={`w-12 h-12 text-white transition-transform ${
                isPlaying ? "animate-pulse" : ""
              }`}
            />
            {/* Progress Ring */}
            <svg
              className="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 128 128"
            >
              <circle
                cx="64"
                cy="64"
                r="60"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="4"
              />
              <circle
                cx="64"
                cy="64"
                r="60"
                fill="none"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 60}`}
                strokeDashoffset={`${2 * Math.PI * 60 * (1 - progress / 100)}`}
                className="transition-all duration-100"
              />
            </svg>
          </button>
        </div>

        {/* Sliders */}
        <div className="w-full space-y-10">
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-neutral-700 font-medium">
                Wie häufig passiert das dir?
              </p>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={ratings[currentChallenge?.id]?.impact ?? 50}
              onChange={(e) => updateRating("impact", Number(e.target.value))}
              className="w-full h-2 bg-blue-100 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md focus:outline-none transition-all"
            />
            <div className="flex justify-between text-xs text-neutral-500 font-medium px-1">
              <span>Selten / Nie</span>
              <span>Täglich / Oft</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-neutral-700 font-medium">
                Wie sicher fühlst du dich bei der Lösung?
              </p>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={ratings[currentChallenge?.id]?.difficulty ?? 50}
              onChange={(e) => updateRating("difficulty", Number(e.target.value))}
              className="w-full h-2 bg-blue-100 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md focus:outline-none transition-all"
            />
            <div className="flex justify-between text-xs text-neutral-500 font-medium px-1">
              <span>Ratlos</span>
              <span>Souverän</span>
            </div>
          </div>
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={nextChallenge}
          disabled={submitting}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full font-medium hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50 shadow-lg"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Nächste
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Report Button - Dezent unter dem Hauptbutton */}
        <button
          onClick={reportSpam}
          className="flex items-center gap-2 px-4 py-2 text-xs text-neutral-400 hover:text-red-500 transition-colors"
          title="Diesen Beitrag als unangemessen melden"
        >
          <Flag className="w-3 h-3" />
          Beitrag melden
        </button>
      </div>
    </div>
  );
}
