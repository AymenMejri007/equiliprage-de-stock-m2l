import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Vérification simple pour s'assurer que les clés sont chargées
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing from environment variables.");
  // Vous pouvez ajouter un toast d'erreur ici si vous le souhaitez
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);