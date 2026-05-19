# Firebase Authentication Setup Guide
## Driver Appreciation Solutions — Fleet Portal

---

## Overview

The Fleet Portal (login, signup, account pages) uses **Firebase Authentication** — Google's free, hosted auth platform. It handles Google SSO, email/password accounts, password resets, and email verification. No backend server required.

**Time to set up:** ~15 minutes

---

## Step 1 — Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Name it: `driver-appreciation-solutions`
4. Disable Google Analytics (optional)
5. Click **"Create project"**

---

## Step 2 — Enable Authentication Sign-In Methods

1. In the Firebase console, go to **Authentication** (left sidebar)
2. Click the **"Sign-in method"** tab
3. Enable **Google**:
   - Toggle on
   - Set a support email
   - Click Save
4. Enable **Email/Password**:
   - Toggle on (do NOT enable passwordless)
   - Click Save

---

## Step 3 — Register Your Web App

1. In the Firebase console, click the gear icon → **Project Settings**
2. Scroll to **"Your apps"** → click the **`</>`** (Web) icon
3. Register app with nickname: `DAS Website`
4. Do **NOT** enable Firebase Hosting (you're on Vercel)
5. Click **"Register app"**
6. Copy the `firebaseConfig` object — it looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "driver-appreciation-solutions.firebaseapp.com",
  projectId: "driver-appreciation-solutions",
  storageBucket: "driver-appreciation-solutions.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## Step 4 — Add Authorized Domains

1. In Firebase console → **Authentication** → **Settings** tab
2. Under **"Authorized domains"**, click **"Add domain"**
3. Add your production domain: `driverappreciationsolutions.com`
4. Also add: `www.driverappreciationsolutions.com`
5. Vercel preview URLs (e.g., `*.vercel.app`) are pre-authorized for Google OAuth — no action needed for those

---

## Step 5 — Set Environment Variables in Vercel

Go to your Vercel project → **Settings** → **Environment Variables** and add:

| Variable Name | Value |
|---|---|
| `FIREBASE_API_KEY` | Your `apiKey` from Step 3 |
| `FIREBASE_AUTH_DOMAIN` | Your `authDomain` from Step 3 |
| `FIREBASE_PROJECT_ID` | Your `projectId` from Step 3 |
| `FIREBASE_STORAGE_BUCKET` | Your `storageBucket` from Step 3 |
| `FIREBASE_MESSAGING_SENDER_ID` | Your `messagingSenderId` from Step 3 |
| `FIREBASE_APP_ID` | Your `appId` from Step 3 |

**Important:** Set these for **Production**, **Preview**, and **Development** environments.

---

## Step 6 — Add Window Variables to Your Site (Client-Side Injection)

Because these are a static site on Vercel, you need to expose the Firebase config to the browser. The cleanest approach:

### Option A — Vercel Edge Config / Middleware (Recommended for production)

Create a `vercel.json` if you don't have one:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

Then create `api/firebase-config.js`:

```javascript
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`
    window.FIREBASE_API_KEY = "${process.env.FIREBASE_API_KEY}";
    window.FIREBASE_AUTH_DOMAIN = "${process.env.FIREBASE_AUTH_DOMAIN}";
    window.FIREBASE_PROJECT_ID = "${process.env.FIREBASE_PROJECT_ID}";
    window.FIREBASE_STORAGE_BUCKET = "${process.env.FIREBASE_STORAGE_BUCKET}";
    window.FIREBASE_MESSAGING_SENDER_ID = "${process.env.FIREBASE_MESSAGING_SENDER_ID}";
    window.FIREBASE_APP_ID = "${process.env.FIREBASE_APP_ID}";
  `);
};
```

Then add this to `login.html`, `signup.html`, `account.html`, and `forgot-password.html` — before the Firebase SDK scripts:

```html
<script src="/api/firebase-config"></script>
```

### Option B — Quick Start (for testing only)

Directly hardcode the values in `js/auth.js` — replace the `firebaseConfig` block with your actual values. **Do not commit these to a public GitHub repo.**

---

## Step 7 — Test the Integration

1. Deploy to Vercel with your environment variables set
2. Navigate to `/login.html`
3. Click **"Continue with Google"** — should open Google OAuth popup
4. Sign in with a Google account
5. Should redirect to `/account.html` with your name displayed
6. Test email/password signup at `/signup.html`
7. Check that password reset email arrives from `/forgot-password.html`

---

## Pricing

Firebase Authentication is **free** for up to **10,000 users/month** on the Spark (free) plan. For a fleet SaaS at this scale, you will never exceed the free tier.

---

## Support

If you encounter issues:
- Firebase Console logs: **Authentication** → **Users** tab shows all registered accounts
- Browser console: Look for `[DAS Auth]` prefixed errors
- Common issue: "Popup blocked" — user must allow popups from the site domain
- Common issue: "Unauthorized domain" — add your domain to Step 4

---

*Setup guide written by GRIFFAIN AI for Driver Appreciation Solutions.*
