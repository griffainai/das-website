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

// Audit P2-AUTH-008 — open-redirect defense for returnUrl param.
// Only same-origin absolute paths are accepted; anything else (full URLs,
// protocol-relative `//evil.com`, etc.) falls back to the safe default.
function safeReturnPath(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return '/account';
  if (raw.startsWith('//')) return '/account';        // protocol-relative
  if (!raw.startsWith('/'))  return '/account';        // not an absolute path
  if (raw.includes('://'))   return '/account';        // sneaky encoded URL
  return raw;
}

// ─────────────────────────────────────────────
// SIGN IN WITH GOOGLE (OAuth redirect)
// ─────────────────────────────────────────────
async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) { showAuthError('Auth not configured. Contact support.'); return; }

  const returnUrl  = safeReturnPath(new URLSearchParams(window.location.search).get('returnUrl'));
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
      // Where Supabase sends the user after they click the confirmation link.
      emailRedirectTo: window.location.origin + '/account',
    },
  });

  if (error) {
    console.error('[DAS Auth] Create account error:', error);
    showAuthError(getAuthErrorMessage(error.message));
    return;
  }

  // Supabase contract:
  //   - If the project requires email confirmation → data.session is null,
  //     data.user exists but is unconfirmed. We MUST NOT redirect them to a
  //     gated page. Show "check your email" instead.
  //   - If email confirmation is OFF → data.session exists, log them straight in.
  const user    = data.user;
  const session = data.session;

  if (user && !session) {
    // Pending email verification — render an inline confirmation card.
    showEmailVerificationPending(email);
    return;
  }

  if (user) storeUserSession(_normalizeUser(user), { companyName });
  redirectToAccount();
}

// ─────────────────────────────────────────────
// EMAIL VERIFICATION — pending state UI
// Replaces the signup form with a "check your inbox" card. Resend button
// uses Supabase's resend() to send a fresh confirmation email.
// ─────────────────────────────────────────────
function showEmailVerificationPending(email) {
  const form = document.getElementById('signup-form');
  const card = document.querySelector('.auth-card');
  if (!form || !card) {
    // Fallback — at least alert the user instead of silently leaving them on the form
    showAuthError('Check your email to confirm your account before signing in.');
    return;
  }

  form.style.display = 'none';

  const pending = document.createElement('div');
  pending.id = 'das-verify-pending';
  pending.style.cssText = 'padding:24px 0;text-align:center';
  pending.innerHTML = ''
    + '<div style="width:56px;height:56px;border-radius:50%;background:rgba(26,46,110,0.08);'
    +   'display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:28px">✉️</div>'
    + '<h2 style="font-size:1.25rem;font-weight:700;color:#111;margin:0 0 8px">Check your inbox</h2>'
    + '<p style="font-size:0.9375rem;color:#374151;line-height:1.6;margin:0 0 20px">'
    +   'We sent a confirmation link to <strong>' + escapeHtmlText(email) + '</strong>. '
    +   'Click the link in that email to activate your account, then come back and sign in.'
    + '</p>'
    + '<p style="font-size:0.8125rem;color:#6B7280;margin:0 0 16px">Tip: check Spam / Promotions if you don\'t see it in 60 seconds.</p>'
    + '<button id="das-verify-resend" type="button" class="btn btn-secondary btn-sm" style="margin-right:8px">Resend confirmation</button>'
    + '<a href="/login" class="btn btn-primary btn-sm">Back to sign in</a>'
    + '<p id="das-verify-resend-status" style="font-size:0.75rem;color:#059669;margin:14px 0 0;min-height:18px"></p>';
  card.appendChild(pending);

  document.getElementById('das-verify-resend').addEventListener('click', async function () {
    const btn = this;
    const status = document.getElementById('das-verify-resend-status');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    status.textContent = '';
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Auth not configured');
      const { error } = await sb.auth.resend({ type: 'signup', email: email });
      if (error) throw error;
      status.style.color = '#059669';
      status.textContent = 'Sent — check your inbox again.';
    } catch (err) {
      status.style.color = '#B91C1C';
      status.textContent = (err && err.message) || 'Could not resend — please try again.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Resend confirmation';
    }
  });
}

function escapeHtmlText(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
  });
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
  window.location.href = '/login';
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
  const returnUrl = safeReturnPath(new URLSearchParams(window.location.search).get('returnUrl'));
  window.location.href = returnUrl;
}

function requireAuth(redirectTo = '/login') {
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

function redirectIfAuthed(to = '/account') {
  onAuthReady(user => {
    if (user) window.location.href = to;
  });
}

// ─────────────────────────────────────────────
// NAV — update login/account button across site
// ─────────────────────────────────────────────
function renderAuthNav(user) {
  if (user) {
    const initials = (user.displayName || user.email || 'U')
      .split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const avatarHTML = user.photoURL
      ? `<img src="${user.photoURL}" alt="${initials}" referrerpolicy="no-referrer" ` +
        `style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0">`
      : `<span style="width:32px;height:32px;border-radius:50%;background:var(--gold);` +
        `color:#fff;font-size:0.8125rem;font-weight:700;display:flex;align-items:center;` +
        `justify-content:center;flex-shrink:0">${initials}</span>`;

    // ── Desktop nav button ──────────────────────
    const desktopBtn = document.querySelector('.nav-actions .nav-login-btn');
    if (desktopBtn) {
      desktopBtn.innerHTML = `${avatarHTML}<span>My Account</span>`;
      desktopBtn.href = '/account';
      desktopBtn.removeAttribute('onclick');
      desktopBtn.onclick = e => { e.preventDefault(); window.location.href = '/account'; };
    }

    // ── Mobile drawer button ────────────────────
    const drawerBtn = document.getElementById('drawer-auth-btn');
    if (drawerBtn) {
      drawerBtn.innerHTML = `${avatarHTML}<span>My Account</span>`;
      drawerBtn.href = '/account';
      drawerBtn.removeAttribute('onclick');
      drawerBtn.onclick = e => {
        e.preventDefault();
        // Close drawer using same selectors as cart.js closeNav()
        document.querySelector('.mobile-drawer')?.classList.remove('open');
        document.querySelector('.mobile-overlay')?.classList.remove('open');
        document.body.style.overflow = '';
        window.location.href = '/account';
      };
    }

  } else {
    // ── Signed out — restore Sign In state ─────
    const personIcon =
      `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" ` +
      `stroke-width="2" stroke="currentColor" style="width:15px;height:15px;flex-shrink:0">` +
      `<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 ` +
      `0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 ` +
      `21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>`;

    const desktopBtn = document.querySelector('.nav-actions .nav-login-btn');
    if (desktopBtn) {
      desktopBtn.innerHTML = 'Sign In';
      desktopBtn.href = '/login';
      desktopBtn.onclick = null;
      desktopBtn.removeAttribute('onclick');
    }

    const drawerBtn = document.getElementById('drawer-auth-btn');
    if (drawerBtn) {
      drawerBtn.innerHTML = `${personIcon}Sign In`;
      drawerBtn.href = '/login';
      drawerBtn.onclick = null;
      drawerBtn.removeAttribute('onclick');
    }
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
document.addEventListener('DOMContentLoaded', async () => {
  // Drive the nav off the REAL Supabase session. Sign-in (login.html) and the
  // /account page both use the CDN Supabase client below, which persists the
  // session in localStorage — so reading it here is the single source of truth.
  // (The old /api/auth/status endpoint never existed, which is why the nav was
  //  stuck on "Sign In" even while signed in.)
  const sb = getSupabase();
  if (!sb) { renderAuthNav(null); return; }

  // Immediate paint from the current session.
  try {
    const { data: { session } } = await sb.auth.getSession();
    renderAuthNav(_normalizeUser(session?.user ?? null));
  } catch (err) {
    console.warn('[DAS Auth] session check error:', err.message);
    renderAuthNav(null);
  }

  // Keep the nav in sync with later sign-in / sign-out / token-refresh events.
  sb.auth.onAuthStateChange((_event, session) => {
    renderAuthNav(_normalizeUser(session?.user ?? null));
  });
});
