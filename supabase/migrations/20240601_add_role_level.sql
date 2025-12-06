-- Add creator_role and creator_level to challenges table
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS creator_role TEXT,
ADD COLUMN IF NOT EXISTS creator_level TEXT;

-- Drop the view first because changing column order is not supported by CREATE OR REPLACE VIEW
DROP VIEW IF EXISTS public.challenges_with_stats;

-- Update the view to include these new columns
CREATE VIEW public.challenges_with_stats AS
SELECT
  c.id,
  c.audio_path,
  c.duration_sec,
  c.status,
  c.device_id,
  c.created_at,
  c.creator_role,
  c.creator_level,
  COALESCE(AVG(r.impact), 50) AS avg_impact,
  COALESCE(AVG(r.difficulty), 50) AS avg_difficulty,
  COUNT(r.id)::INTEGER AS rating_count
FROM public.challenges c
LEFT JOIN public.challenge_ratings r ON r.challenge_id = c.id
WHERE c.status = 'approved'
GROUP BY c.id
ORDER BY c.created_at DESC;
