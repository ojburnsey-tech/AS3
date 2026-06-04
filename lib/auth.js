// lib/auth.js
// Centralised Vulcan Quanta authentication layer built on Supabase Auth.
// Exposes window.VQAuth — all auth operations in JSX files go through here.
// Load order: lib/supabase.js → lib/auth.js → JSX files
(function () {
  'use strict';

  if (!window.supabaseClient) {
    console.error(
      '[VQ] supabaseClient is not initialised. ' +
      'Ensure lib/supabase.js loads (and succeeds) before lib/auth.js.'
    );
    window.VQAuth = null;
    return;
  }

  var sb = window.supabaseClient;

  window.VQAuth = {

    // ── Sign up ───────────────────────────────────────────────────────────────
    // Creates a new auth user. Full name and plan are stored in raw_user_meta_data
    // and mirrored to public.profiles by the handle_new_user DB trigger.
    // Returns { data: { user, session }, error }
    signUp: async function (email, password, fullName, plan) {
      return sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName || '',
            plan: plan || 'pro',
          },
        },
      });
    },

    // ── Sign in ───────────────────────────────────────────────────────────────
    // Returns { data: { user, session }, error }
    signIn: async function (email, password) {
      return sb.auth.signInWithPassword({
        email: email,
        password: password,
      });
    },

    // ── Sign out ──────────────────────────────────────────────────────────────
    // The onAuthStateChange listener in App receives SIGNED_OUT and routes home.
    signOut: async function () {
      return sb.auth.signOut();
    },

    // ── Current session ───────────────────────────────────────────────────────
    // Returns { data: { session }, error }
    getSession: async function () {
      return sb.auth.getSession();
    },

    // ── Auth state subscription ───────────────────────────────────────────────
    // Returns { data: { subscription } } — call subscription.unsubscribe() on cleanup.
    // Events fired: INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
    //               PASSWORD_RECOVERY, USER_UPDATED
    onAuthStateChange: function (callback) {
      return sb.auth.onAuthStateChange(callback);
    },

    // ── Password reset email ──────────────────────────────────────────────────
    // redirectTo must be whitelisted in Supabase Dashboard → Auth → URL Configuration.
    // Supabase appends the recovery token as a URL hash on that redirect URL.
    forgotPassword: async function (email, redirectTo) {
      var options = redirectTo ? { redirectTo: redirectTo } : {};
      return sb.auth.resetPasswordForEmail(email, options);
    },

    // ── Update password ───────────────────────────────────────────────────────
    // Requires an active recovery session (user clicked the reset link).
    updatePassword: async function (newPassword) {
      return sb.auth.updateUser({ password: newPassword });
    },

    // ── Resend verification email ─────────────────────────────────────────────
    resendVerification: async function (email) {
      return sb.auth.resend({
        type: 'signup',
        email: email,
      });
    },

    // ── Profile ───────────────────────────────────────────────────────────────
    // Fetches the user row from public.profiles.
    getProfile: async function (userId) {
      return sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    },

    // Updates one or more profile fields (e.g. { plan: 'studio' }).
    updateProfile: async function (userId, updates) {
      return sb
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    },

  };

}());
