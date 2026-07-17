import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Falha alto e cedo — melhor um erro claro no console do que telas em
  // branco tentando buscar dados de um cliente mal configurado.
  console.error(
    "Supabase não configurado. Verifique se VITE_SUPABASE_URL e " +
    "VITE_SUPABASE_ANON_KEY estão definidos em .env.local."
  );
}

export const supabase = createClient(url, key);
