// lib/supabase.js
// Initialises the Supabase client singleton.
// Load order: Supabase CDN → lib/supabase.js → lib/auth.js → JSX files
(function () {
  'use strict';

  // ── REPLACE THESE WITH YOUR SUPABASE PROJECT CREDENTIALS ──────────────────
  // Find them in: Supabase Dashboard → Project Settings → API
  var SUPABASE_URL      = 'YOUR_SUPABASE_URL';       // e.g. https://xxxx.supabase.co
  var SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';  // public anon key (safe to expose)
  // ──────────────────────────────────────────────────────────────────────────

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error(
      '[VQ] Supabase CDN script not loaded or failed. ' +
      'Verify the CDN <script> tag appears before lib/supabase.js in the HTML.'
    );
    window.supabaseClient = null;
    return;
  }

  if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn(
      '[VQ] Supabase credentials are placeholders. ' +
      'Authentication will not work until you update SUPABASE_URL and ' +
      'SUPABASE_ANON_KEY in lib/supabase.js. See SUPABASE_SETUP.md.'
    );
  }

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken:    true,
      persistSession:      true,
      detectSessionInUrl:  true,
      storage:             window.localStorage,
    },
  });
}());
