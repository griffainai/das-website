/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Supabase Authentication — Google SSO + Email/Password
   =============================================

   SETUP:
   1. Go to https://supabase.com and create a project
   2. Authentication → Providers → Enable "Google"
   3. Authentication → URL Configuration → Add your site URL + /account.html
      to Redirect URLs
   4. Project Settings → API → copy Project URL and anon public key
   5. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.local (and Vercel)
   ============================================= */

// ─────────────────────────────────────────────
// SUPABASE CONFIG
// window.SUPABASE_* values are injected by /api/supabase-config
// Falls back to env-style placeholders you can hardcode for local dev
// ─────────────────────────────────────────────
const _SUPABASE_URL      = window.SUPABASE_URL      || 'https://afqrwezmwfgwakgfdcty.supabase.co';
const _SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmcXJ3ZXptd2Znd2FrZ2ZkY3R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTQxODMsImV4cCI6MjA5NDc3MDE4M30.PAwlexLGMrC9Pat8N2ga_jCKnyUPItJFFNRBpItt4IM';

// ─────────────────────────────────────────────
// INIT SUPABASE CLIENT
// ─────────────────────────────────────────────
let _supabase = null;
let _authUnavailable = false;

function getSupabase() {
  if (_supabase) return _supabase;
  if (_authUnavailable) return null;

  try {
    if (!window.supabase || !window.supabase.createClient) {
      console.warn('[DAS Auth] Supabase SDK not loaded');
      _authUnavailable = true;
      return null;
    }
    if (!_SUPABASE_URL || !_SUPABASE_ANON_KEY) {
      console.warn('[DAS Auth] Supabase not configured — missing URL or anon key');
      _authUnavailable = true;
      return null;
    }
    _supabase = window.supabase.createClient(_SUPABASE_URL, _SUPABASE_ANON_KEY);
    return _supabase;
  } catch (err) {
    console.warn('[DAS Auth] Supabase init error:', err.message);
    _authUnavailable = true;
    return null;
  }
}

// ─────────────────────────────────────────────
// USER NORMALIZATION
// Maps Supabase user → the shape the rest of the site expects
// ─────────────────────────────────────────────
function _normalizeUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    uid:           user.id,
    email:         user.email,
    displayName:   meta.display_name || meta.full_name || meta.name || '',
    photoURL:      meta.avatar_url   || meta.picture   || '',
    emailVerified: !!user.email_confirmed_at,
  };
}

// ─────────────────────────────────────────────
// AUTH STATE — listen across all pages
// ─────────────────────────────────────────────
function onAuthReady(callback) {
  const sb = getSupabase();
  if (!sb) { callback(null); return; }

  sb.auth.onAuthStateChange((_event, session) => {
    callback(_normalizeUser(session?.user ?? null));
  });
}

// ─────────────────────────────────────────────
// SIGN IN WITH GOOGLE (OAuth redirect)
// ─────────────────────────────────────────────
async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) { showAuthError('Auth not configured. Contact support.'); return; }

  const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/account.html';
  const redirectTo = window.location.origin + returnUrl;

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options:  { redirectTo, queryParams: { access_type: 'offline', prompt: 'consent' } },
  });

  if (error) {
    console.error('[DAS Auth] Google OAuth error:', error);
    showAuthError(getAuthErrorMessage(error.message));
  }
  // On success the browser navigates away — no further action needed here
}

// ─────────────────────────────────────────────
// SIGN IN WITH EMAIL + PASSWORD
// ─────────────────────────────────────────────
async function signInWithEmail(email, password) {
  const sb = getSupabase();
  if (!sb) { showAuthError('Auth not configured. Contact support.'); return; }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[DAS Auth] Email sign-in error:', error);
    showAuthError(getAuthErrorMessage(error.message));
    return;
  }

  storeUserSession(_normalizeUser(data.user));
  redirectToAccount();
}

// ─────────────────────────────────────────────
// CREATE ACCOUNT WITH EMAIL + PASSWORD
// ─────────────────────────────────────────────
async function createAccount(email, password, displayName, companyName) {
  const sb = getSupabase();
  if (!sb) { showAuthError('Auth not configured. Contact support.'); return; }

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        company_name: companyName,
      },
    },
  });

  if (error) {
    console.error('[DAS Auth] Create account error:', error);
    showAuthError(getAuthErrorMessage(error.message));
    return;
  }

  // Supabase sends a confirmation email automatically when email confirmations are enabled
  const user = data.user;
  if (user) storeUserSession(_normalizeUser(user), { companyName });
  redirectToAccount();
}

// ─────────────────────────────────────────────
// SEND PASSWORD RESET EMAIL
// ─────────────────────────────────────────────
async function sendPasswordReset(email) {
  const sb = getSupabase();
  if (!sb) { showAuthError('Auth not configured.'); return false; }

  const redirectTo = window.location.origin + '/login.html';

  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    console.error('[DAS Auth] Password reset error:', error);
    showAuthError(getAuthErrorMessage(error.message));
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────
// SIGN OUT
// ─────────────────────────────────────────────
async function signOut() {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.auth.signOut();
    if (error) console.error('[DAS Auth] Sign out error:', error);
  }
  clearUserSession();
  window.location.href = 'login.html';
}

// ─────────────────────────────────────────────
// SESSION HELPERS
// ─────────────────────────────────────────────
function storeUserSession(user, extra = {}) {
  if (!user) return;
  const data = {
    uid:           user.uid,
    email:         user.email,
    displayName:   user.displayName || '',
    photoURL:      user.photoURL    || '',
    emailVerified: user.emailVerified,
    ...extra,
  };
  sessionStorage.setItem('das_user', JSON.stringify(data));
}

function getStoredUser() {
  try { return JSON.parse(sessionStorage.getItem('das_user')); }
  catch { return null; }
}

function clearUserSession() {
  sessionStorage.removeItem('das_user');
}

function redirectToAccount() {
  const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
  window.location.href = returnUrl || 'account.html';
}

function requireAuth(redirectTo = 'login.html') {
  onAuthReady(user => {
    if (!user) {
      const current = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${redirectTo}?returnUrl=${current}`;
    } else {
      storeUserSession(user);
      renderAuthNav(user);
    }
  });
}

function redirectIfAuthed(to = 'account.html') {
  onAuthReady(user => {
    if (user) window.location.href = to;
  });
}

// ─────────────────────────────────────────────
// NAV — update login/account button across site
// ─────────────────────────────────────────────
function renderAuthNav(user) {
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  const loginBtn = navActions.querySelector('.nav-login-btn');
  if (!loginBtn) return;

  if (user) {
    const initials = (user.displayName || user.email || 'U')
      .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    loginBtn.innerHTML = `
      <span style="width:32px;height:32px;border-radius:50%;background:var(--gold);color:#fff;font-size:0.8125rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</span>
      <span>My Account</span>`;
    loginBtn.href = 'account.html';
  }
}

// ─────────────────────────────────────────────
// ERROR HELPERS
// ─────────────────────────────────────────────
function showAuthError(message) {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    console.error('[DAS Auth]', message);
  }
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function getAuthErrorMessage(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'Email or password is incorrect.';
  if (m.includes('email not confirmed'))
    return 'Please verify your email before signing in. Check your inbox.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'An account with this email already exists. Try logging in instead.';
  if (m.includes('password should be at least') || m.includes('weak password'))
    return 'Password must be at least 8 characters.';
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('invalid email'))
    return 'Please enter a valid email address.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Network error. Check your connection and try again.';
  if (m.includes('user not found'))
    return 'No account found with this email. Check your spelling or sign up.';
  return msg || 'Sign-in error. Please try again.';
}

// ─────────────────────────────────────────────
// TOGGLE PASSWORD VISIBILITY
// ─────────────────────────────────────────────
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  const eyeOpen   = btn.querySelector('.eye-open');
  const eyeClosed = btn.querySelector('.eye-closed');
  if (eyeOpen)   eyeOpen.style.display   = isHidden ? 'block' : 'none';
  if (eyeClosed) eyeClosed.style.display = isHidden ? 'none'  : 'block';
}

// ─────────────────────────────────────────────
// INIT ON PAGE LOAD
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Update nav auth button on every page
  onAuthReady(user => {
    if (user) renderAuthNav(user);
  });
});
