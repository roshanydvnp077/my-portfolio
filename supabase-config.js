// Supabase public client configuration.
// IMPORTANT: Only use the anon/public key in browser code.
// NEVER put a Supabase secret/service_role key in this file.

const SUPABASE_URL = "https://odjzahkfgkpkdoqkgbbg.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kanphaGtmZ2twa2RvcWtnYmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTcwOTMsImV4cCI6MjEwNDAzMzA5M30.EX9cKavzYFhAHMDbWiFwVjeRe6su9qVHs8SYinMJEZg";

// Initialize Supabase client
(function initializeSupabase() {
  try {
    if (typeof window.supabase === "undefined") {
      console.error("Supabase library not loaded. Make sure supabase.js is loaded before supabase-config.js");
      window.supabaseClient = null;
      return;
    }

    if (typeof window.supabase.createClient !== "function") {
      console.error("Supabase.createClient is not a function. The library may be corrupted or incompatible.");
      window.supabaseClient = null;
      return;
    }

    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase client initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    window.supabaseClient = null;
  }
})();