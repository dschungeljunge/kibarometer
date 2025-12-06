export type Category = 'Positiv' | 'Negativ' | 'Kontrolle';

export interface ItemRow {
  id: number;
  text?: string;
  category: Category;
}

export interface AnswerRow {
  id?: number;
  response_id: string;
  item_id: number;
  value: number;
}

export interface ResponseRow {
  id: string;
  gender?: string;
  age?: string;
  experience?: string;
  role?: string;
  school_level?: string;
  consent?: string;
  created_at?: string;
}

// Herausforderungen
export type ChallengeStatus = 'pending' | 'approved' | 'rejected';

export interface ChallengeRow {
  id: string;
  audio_path: string;
  duration_sec: number;
  status: ChallengeStatus;
  created_at: string;
  device_id?: string;
  creator_role?: string;
  creator_level?: string;
}

export interface ChallengeRatingRow {
  id: string;
  challenge_id: string;
  device_id: string;
  impact: number;       // 0-100
  difficulty: number;   // 0-100
  created_at: string;
}

// View für aggregierte Werte
export interface ChallengeWithStats extends ChallengeRow {
  avg_impact: number | null;
  avg_difficulty: number | null;
  rating_count: number;
}

// Supabase Database schema mapping – keeps strong typing across the project
export type Database = {
  public: {
    Tables: {
      answers: {
        Row: AnswerRow;
      };
      responses: {
        Row: ResponseRow;
      };
      items: {
        Row: ItemRow;
      };
      challenges: {
        Row: ChallengeRow;
        Insert: Omit<ChallengeRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<ChallengeRow>;
      };
      challenge_ratings: {
        Row: ChallengeRatingRow;
        Insert: Omit<ChallengeRatingRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<ChallengeRatingRow>;
      };
    };
    Views: {
      challenges_with_stats: {
        Row: ChallengeWithStats;
      };
    };
  };
}; 