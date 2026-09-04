// Supabase public client configuration.
// IMPORTANT: Only use the publishable/anon key in browser code.
// NEVER put a Supabase secret/service_role key in this file.

const SUPABASE_URL = "https://odjzahkfgkpkdoqkgbbg.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_dP49F1My1wK54BmwMbqipw_e71IZuJr";

window.supabaseClient = window.supabase && typeof window.supabase.createClient === "function"
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;