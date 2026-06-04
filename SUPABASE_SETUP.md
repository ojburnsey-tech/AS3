# Supabase Setup Guide — Vulcan Quanta

Follow these steps once to wire up real authentication. Takes about 10 minutes.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**, choose a name (e.g. `vulcan-quanta`), set a database password, and select the **EU West** region (or nearest to your users).
3. Wait for the project to provision (~1 minute).

---

## 2. Get your API credentials

1. In the Supabase Dashboard, go to **Project Settings → API**.
2. Copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public key** — a long JWT string (safe to expose in client-side code)
3. Open `lib/supabase.js` and replace the two placeholder values:

```js
var SUPABASE_URL      = 'https://xxxxxxxxxxxx.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

## 3. Create the profiles table

Run the following SQL in **Supabase Dashboard → SQL Editor → New query**:

```sql
-- 1. Profiles table (mirrors auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  plan        text not null default 'free' check (plan in ('free', 'pro', 'studio')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Row Level Security — users can only read/write their own row
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 3. Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, plan)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'plan', 'free')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
```

---

## 4. Configure allowed redirect URLs

Password-reset emails include a link back to your app. Supabase must allowlist the URL.

1. In the Dashboard go to **Authentication → URL Configuration**.
2. Under **Redirect URLs**, add:
   - `http://localhost` (for local development — file:// won't work; serve with `npx serve .` or similar)
   - `https://yourdomain.com` (your production domain)
   - Any other environments (staging, Netlify preview, etc.)
3. Leave **Site URL** set to your primary production URL.

> **Note:** If you're opening `Vulcan Quanta.html` directly from the filesystem (`file://`), password-reset redirect links will not work because browsers block cross-origin redirects back to `file://` URLs. Serve the project with a local static server instead (e.g. `npx serve .`, Python's `http.server`, or VS Code Live Server).

---

## 5. Email template (optional)

Supabase sends a default verification email. You can customise it:

1. Go to **Authentication → Email Templates**.
2. Edit the **Confirm signup** and **Reset password** templates to match your branding.

---

## 6. Disable email confirmation (dev only)

During development it can be useful to skip email verification:

1. Go to **Authentication → Providers → Email**.
2. Toggle off **Confirm email**.
3. Re-enable before going to production.

---

## 7. Copy static assets

The following binary files are **not** included in this repository push because they cannot be committed as plain text. Copy them from the original project folder into the repository root:

| File | Description |
|------|-------------|
| `logo.png` | Full-colour logo (used in footer) |
| `logo-transparent.png` | Transparent logo (used in header, hero, auth screens) |

---

## 8. Serve the project locally

Because the JSX files are loaded as separate `<script type="text/babel">` tags, the browser must fetch them over HTTP (not `file://`). A one-liner:

```bash
# From the project root
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:3000` (or whichever port `serve` picks).

---

## File structure

```
/
├── Vulcan Quanta.html        ← main entry point (loads all scripts)
├── Vulcan Costing.html       ← alternate colour-scheme variant
├── tweaks-panel.jsx          ← design tweaks panel (unchanged)
├── vq-shared.jsx             ← Header, Footer, BoQMockup (auth-aware)
├── vq-pages.jsx              ← all page components (auth pages added)
├── lib/
│   ├── supabase.js           ← Supabase client singleton ← EDIT THIS
│   └── auth.js               ← VQAuth API layer
├── logo.png                  ← copy manually (binary)
└── logo-transparent.png      ← copy manually (binary)
```

---

## Environment variables

This project has no build step and no `.env` file. Credentials live directly in `lib/supabase.js`. The anon key is safe to ship in client-side code — it only grants access according to your Row Level Security policies. Never commit your **service role** key.

---

## Auth flow summary

| Action | What happens |
|--------|-------------|
| Sign up | `VQAuth.signUp` → Supabase creates user → sends verification email → `CheckEmailPage` shown |
| Email confirmed | User clicks link → redirected to app → `SIGNED_IN` event → `DashboardPage` |
| Sign in | `VQAuth.signIn` → session stored in `localStorage` → `DashboardPage` |
| Forgot password | `VQAuth.forgotPassword` → Supabase sends reset email |
| Reset password | User clicks email link → app receives `PASSWORD_RECOVERY` event → `ResetPasswordPage` |
| Sign out | `VQAuth.signOut` → `SIGNED_OUT` event → redirected to landing |
| Page refresh | `INITIAL_SESSION` event restores session from `localStorage` → auth loading screen dismissed |
| Protected route | If `user` is null and page is dashboard/settings/results/upload → redirected to sign-in |
