// TypeScript types matching the database schema
// File: supabase/functions/_shared/types.ts

// ==========================================
// ENUMS
// ==========================================

export type Role = 'top' | 'jungle' | 'mid' | 'adc' | 'support';
export type TeamSide = 'blue' | 'red';
export type Confidence = 'high' | 'medium' | 'low' | 'insufficient';
export type ETLStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// ==========================================
// DATABASE ROW TYPES
// ==========================================

export interface TeamRow {
  id: string;
  grid_id: string;
  name: string;
  short_name: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerRow {
  id: string;
  grid_id: string;
  name: string;
  team_id: string | null;
  primary_role: Role;
  created_at: string;
  updated_at: string;
}

export interface TournamentRow {
  id: string;
  grid_id: string;
  title: string;
  region: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface SeriesRow {
  id: string;
  grid_id: string;
  tournament_id: string | null;
  blue_team_id: string | null;
  red_team_id: string | null;
  winner_team_id: string | null;
  patch_version: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface GameRow {
  id: string;
  grid_id: string;
  series_id: string | null;
  game_number: number;
  blue_team_won: boolean | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface DraftRow {
  id: string;
  game_id: string;
  blue_bans: string[] | null;
  red_bans: string[] | null;
  created_at: string;
}

export interface ChampionPickRow {
  id: string;
  draft_id: string;
  player_id: string | null;
  team_side: TeamSide;
  champion_name: string;
  role: Role;
  role_confidence: number | null;
  pick_order: number;
  created_at: string;
}

export interface ChampionRow {
  name: string;
  grid_name: string | null;
  riot_id: string | null;
  aliases: string[] | null;
  primary_roles: string[] | null;
  created_at: string;
}

export interface ChampionStatsRow {
  id: string;
  champion_name: string;
  patch_version: string;
  role: Role;
  games_played: number;
  wins: number;
  raw_win_rate: number | null;
  smoothed_win_rate: number | null;
  confidence: Confidence | null;
  pick_rate: number | null;
  ban_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface ETLCheckpointRow {
  id: string;
  job_type: string;
  entity_id: string | null;
  status: ETLStatus;
  progress: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

// ==========================================
// INSERT TYPES (without id, created_at)
// ==========================================

export type TeamInsert = Omit<TeamRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type PlayerInsert = Omit<PlayerRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type TournamentInsert = Omit<TournamentRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type SeriesInsert = Omit<SeriesRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type GameInsert = Omit<GameRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type DraftInsert = Omit<DraftRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ChampionPickInsert = Omit<ChampionPickRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ChampionInsert = Omit<ChampionRow, 'created_at'> & {
  created_at?: string;
};

export type ChampionStatsInsert = Omit<ChampionStatsRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ETLCheckpointInsert = Omit<ETLCheckpointRow, 'id' | 'updated_at'> & {
  id?: string;
  updated_at?: string;
};

// ==========================================
// DATABASE TYPE (for Supabase client)
// ==========================================

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: TeamRow;
        Insert: TeamInsert;
        Update: Partial<TeamInsert>;
      };
      players: {
        Row: PlayerRow;
        Insert: PlayerInsert;
        Update: Partial<PlayerInsert>;
      };
      tournaments: {
        Row: TournamentRow;
        Insert: TournamentInsert;
        Update: Partial<TournamentInsert>;
      };
      series: {
        Row: SeriesRow;
        Insert: SeriesInsert;
        Update: Partial<SeriesInsert>;
      };
      games: {
        Row: GameRow;
        Insert: GameInsert;
        Update: Partial<GameInsert>;
      };
      drafts: {
        Row: DraftRow;
        Insert: DraftInsert;
        Update: Partial<DraftInsert>;
      };
      champion_picks: {
        Row: ChampionPickRow;
        Insert: ChampionPickInsert;
        Update: Partial<ChampionPickInsert>;
      };
      champions: {
        Row: ChampionRow;
        Insert: ChampionInsert;
        Update: Partial<ChampionInsert>;
      };
      champion_stats: {
        Row: ChampionStatsRow;
        Insert: ChampionStatsInsert;
        Update: Partial<ChampionStatsInsert>;
      };
      etl_checkpoints: {
        Row: ETLCheckpointRow;
        Insert: ETLCheckpointInsert;
        Update: Partial<ETLCheckpointInsert>;
      };
    };
  };
}
