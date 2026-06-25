import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to log if Supabase is active
if (typeof window !== "undefined") {
  if (supabase) {
    console.log("Supabase Client initialized successfully! Connected to cloud database.");
  } else {
    console.log("Supabase credentials missing in .env.local. Falling back to LocalStorage.");
  }
}
