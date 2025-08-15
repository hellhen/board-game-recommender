import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables not set. Client will not be available.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Type definitions for our database tables
export type Game = {
  id: string;
  title: string;
  players?: string;
  playtime?: string;
  complexity?: number;
  mechanics?: string[];
  theme?: string;
  tags?: string[];
  description?: string;
  image_url?: string;
  bgg_id?: number;
  created_at?: string;
  updated_at?: string;
};

export type UserRecommendation = {
  id: string;
  session_id?: string;
  user_prompt: string;
  recommended_games: string[]; // Array of game IDs
  feedback_rating?: number; // 1-5 stars
  created_at?: string;
};

export type GamePrice = {
  id: string;
  game_id: string;
  store_name: string;
  price: number;
  currency: string;
  url: string;
  last_updated: string;
};
