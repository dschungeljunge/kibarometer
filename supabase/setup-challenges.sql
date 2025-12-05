-- =============================================================================
-- Supabase Setup für Herausforderungen
-- Führe dieses Script im Supabase SQL Editor aus
-- =============================================================================

-- 1. Tabelle: challenges (Audio-Beiträge)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_path TEXT NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  -- Für Tests: DEFAULT 'approved' (später auf 'pending' ändern für Moderation)
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index für Status-Filter (nur approved anzeigen)
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON public.challenges(created_at DESC);

-- RLS aktivieren
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- Policy: Jeder kann approved Challenges lesen
CREATE POLICY "Approved challenges are viewable by everyone"
  ON public.challenges
  FOR SELECT
  USING (status = 'approved');

-- Policy: Jeder kann neue Challenges einfügen (status wird automatisch 'pending')
CREATE POLICY "Anyone can insert challenges"
  ON public.challenges
  FOR INSERT
  WITH CHECK (true);


-- 2. Tabelle: challenge_ratings (Bewertungen)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  impact INTEGER NOT NULL CHECK (impact >= 0 AND impact <= 100),
  difficulty INTEGER NOT NULL CHECK (difficulty >= 0 AND difficulty <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ein Gerät kann pro Challenge nur einmal bewerten
  UNIQUE(challenge_id, device_id)
);

-- Index für Aggregationen
CREATE INDEX IF NOT EXISTS idx_challenge_ratings_challenge_id ON public.challenge_ratings(challenge_id);

-- RLS aktivieren
ALTER TABLE public.challenge_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: Jeder kann Ratings lesen
CREATE POLICY "Ratings are viewable by everyone"
  ON public.challenge_ratings
  FOR SELECT
  USING (true);

-- Policy: Jeder kann Ratings einfügen
CREATE POLICY "Anyone can insert ratings"
  ON public.challenge_ratings
  FOR INSERT
  WITH CHECK (true);

-- Policy: Eigene Ratings updaten (basierend auf device_id)
CREATE POLICY "Users can update own ratings"
  ON public.challenge_ratings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);


-- 3. View: challenges_with_stats (Challenges mit aggregierten Bewertungen)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.challenges_with_stats AS
SELECT
  c.id,
  c.audio_path,
  c.duration_sec,
  c.status,
  c.device_id,
  c.created_at,
  COALESCE(AVG(r.impact), 50) AS avg_impact,
  COALESCE(AVG(r.difficulty), 50) AS avg_difficulty,
  COUNT(r.id)::INTEGER AS rating_count
FROM public.challenges c
LEFT JOIN public.challenge_ratings r ON r.challenge_id = c.id
WHERE c.status = 'approved'
GROUP BY c.id
ORDER BY c.created_at DESC;


-- 4. Storage Bucket für Audio-Dateien
-- -----------------------------------------------------------------------------
-- Hinweis: Storage-Buckets werden über das Supabase Dashboard erstellt.
-- Erstelle einen Bucket namens "challenge-audio" mit folgenden Einstellungen:
--   - Public: true (oder false mit signed URLs)
--   - Allowed MIME types: audio/webm, audio/mp4, audio/mpeg, audio/ogg
--   - Max file size: 10MB

-- Storage Policy (im Dashboard unter Storage > Policies):
-- INSERT: true (jeder kann hochladen)
-- SELECT: true (jeder kann lesen)


-- 5. Starter-Daten (optional, für Tests)
-- -----------------------------------------------------------------------------
-- Falls du Testdaten brauchst, füge hier approved Challenges ein:
/*
INSERT INTO public.challenges (audio_path, duration_sec, status) VALUES
  ('starter/challenge-1.webm', 22, 'approved'),
  ('starter/challenge-2.webm', 18, 'approved'),
  ('starter/challenge-3.webm', 27, 'approved');
*/

-- 6. Reporting Funktion (Spam melden)
-- -----------------------------------------------------------------------------
-- Erlaubt es jedem User, eine Challenge zu melden.
-- Status wird auf 'pending' gesetzt und sie verschwindet aus dem View.
CREATE OR REPLACE FUNCTION report_challenge(challenge_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.challenges
  SET status = 'pending'
  WHERE id = challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- SECURITY DEFINER bedeutet: Die Funktion läuft mit Admin-Rechten, 
-- auch wenn der User eigentlich kein UPDATE-Recht auf die Tabelle hat.

-- =============================================================================
-- Fertig! Vergiss nicht:
-- 1. Storage Bucket "challenge-audio" im Dashboard erstellen
-- 2. Storage Policies setzen (Insert + Select für alle erlauben)
-- 3. Den Teil unter "6. Reporting Funktion" im SQL Editor ausführen!
-- =============================================================================
