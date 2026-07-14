# DAS Website — Next.js Migration Plan

**Status:** Not doing this yet. Document exists so execution day is 1 day of doing, not thinking.
**Trigger:** Migrate when static HTML becomes a bottleneck — SSR needed for SEO, auth consolidation required, or JS module sprawl makes maintenance painful.
**Target stack:** Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase (existing project) · Stripe (existing keys) · Vercel (existing project)

---

## What Does NOT Change

- Supabase project (same ref: `afqrwezmwfgwakgfdcty`, same schema, same RLS)
- Stripe account, keys, webhook endpoints, and all the `create-checkout` logic
- `das_orders` table structure — every column, every status value, every query
- `lib/catalog.js` and `lib/shipping.js` — copy verbatim into `lib/`
- Business logic: repeat-customer check, per-hire minimums, milestone-select, kit config, bundle discount at $575
- Cart model: localStorage key `das_cart_v1`, Favorites key `das_favorites_v1` — stays localStorage
- All legal copy, product copy, and pricing
- Domain: `driverappreciationsolutions.com` (Vercel project rename only)

---

## Color System Landmine — Read Before Touching Anything

```
--black = #FFFFFF   ← the variable named "black" is WHITE
--gold  = #1A2E6E   ← the variable named "gold" is NAVY
```

**This is intentional. Do not "fix" it.**

Rules:
- Dark sections use explicit hex values, NOT CSS variables — variables resolve wrong on dark backgrounds
- Button styling differs on dark vs light backgrounds (follow existing patterns in `css/styles.css`)
- Verified working 2026-05-20
- If tempted to refactor the color system, stop and ask Jayden first

When migrating: copy `css/styles.css` verbatim into `app/globals.css`. Do not rename, reorder, or rationalize the variables.

---

## Page Inventory → Next.js Route Map

| Current file | Next.js route | Notes |
|---|---|---|
| `index.html` | `app/(public)/page.tsx` | Home |
| `shop.html` | `app/(public)/shop/page.tsx` | Product catalog |
| `product.html` | `app/(public)/product/[id]/page.tsx` | Product detail, reads `?id=` param → dynamic route |
| `cart.html` | `app/(public)/cart/page.tsx` | Client component (localStorage) |
| `login.html` | `app/(auth)/login/page.tsx` | Supabase signInWithPassword + Google OAuth |
| `signup.html` | `app/(auth)/signup/page.tsx` | Supabase signUp + email verification pending state |
| `forgot-password.html` | `app/(auth)/forgot-password/page.tsx` | Supabase resetPasswordForEmail |
| `account.html` | `app/(account)/page.tsx` | Auth-gated, show orders + profile |
| `favorites.html` | `app/(public)/favorites/page.tsx` | Client component (localStorage) |
| `success.html` | `app/(public)/success/page.tsx` | Post-checkout, reads `?session_id=` + `?order_id=` |
| `about.html` | `app/(public)/about/page.tsx` | Static |
| `contact.html` | `app/(public)/contact/page.tsx` | Calls `/api/contact` |
| `customer-service.html` | `app/(public)/customer-service/page.tsx` | Static |
| `commercial-driver-gifts.html` | `app/(public)/commercial-driver-gifts/page.tsx` | SEO landing page |
| `company-purchasing.html` | `app/(public)/company-purchasing/page.tsx` | Static |
| `driver-appreciation-week-2026.html` | `app/(public)/driver-appreciation-week/page.tsx` | Campaign page |
| `solution-appreciation.html` | `app/(public)/solutions/appreciation/page.tsx` | |
| `solution-enterprise.html` | `app/(public)/solutions/enterprise/page.tsx` | |
| `solution-holiday.html` | `app/(public)/solutions/holiday/page.tsx` | |
| `solution-milestone.html` | `app/(public)/solutions/milestone/page.tsx` | |
| `solution-onboarding.html` | `app/(public)/solutions/onboarding/page.tsx` | |
| `solution-safety.html` | `app/(public)/solutions/safety/page.tsx` | |
| `cancelation-policy.html` | `app/(public)/legal/cancelation/page.tsx` | |
| `refund-policy.html` | `app/(public)/legal/refund/page.tsx` | |
| `return-policy.html` | `app/(public)/legal/returns/page.tsx` | |
| `terms.html` | `app/(public)/legal/terms/page.tsx` | |
| `legal.html` | `app/(public)/legal/page.tsx` | Legal index |
| `blog/` | `app/(public)/blog/[slug]/page.tsx` | Static or Sanity CMS if added later |
| `pub.html` | `app/(public)/pub/page.tsx` | Publication viewer |
| `publications.html` | `app/(public)/publications/page.tsx` | Publications index |
| `ideas.html` | `app/(public)/ideas/page.tsx` | |

**Redirects to add in `next.config.ts`:**
- `/shop.html` → `/shop`
- `/product.html` → `/product` (preserve `?id=` querystring)
- `/cart.html` → `/cart`
- `/login.html` → `/login`
- `/signup.html` → `/signup`
- `/account.html` → `/account`
- `/success.html` → `/success`
- All other `.html` paths → equivalent clean path

---

## API Route Map

All current `api/` Vercel serverless functions → `app/api/` Next.js Route Handlers.
The Node.js logic is the same — only the export signature changes.

| Current | Next.js | Change |
|---|---|---|
| `api/create-checkout.js` | `app/api/create-checkout/route.ts` | `module.exports = async (req, res)` → `export async function POST(req: Request)` |
| `api/contact.js` | `app/api/contact/route.ts` | Same |
| `api/newsletter-subscribe.js` | `app/api/newsletter-subscribe/route.ts` | Same |
| `api/portal.js` | `app/api/portal/route.ts` | Same |
| `api/chat.js` | `app/api/chat/route.ts` | Same |
| `api/admin-orders.js` | `app/api/admin-orders/route.ts` | Same |
| `api/supabase-config.js` | Delete — use env vars directly via `NEXT_PUBLIC_SUPABASE_URL` etc. | No equivalent needed |
| `api/config.js` (Stripe key) | Delete — expose `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in env | No equivalent needed |
| `api/firebase-config.js` | Delete — Firebase is not used | |
| `api/_supabase.js` | `lib/supabase/server.ts` | Same pattern, use `@supabase/ssr` |

**`create-checkout` specific:** `require('./_supabase')` → import from `lib/supabase/server`. `require('../lib/catalog')` and `require('../lib/shipping')` → import from `lib/catalog.ts` / `lib/shipping.ts`. Everything else in the function body is unchanged.

---

## JS Module Map

| Current `js/` file | Next.js equivalent |
|---|---|
| `auth.js` | Delete. Replace with `lib/supabase/client.ts` + `hooks/useUser.ts`. Auth functions (`signInWithEmail`, `signInWithGoogle`, `createAccount`, `signOut`, `sendPasswordReset`) become server actions or thin wrappers around `@supabase/ssr`. |
| `cart.js` | `lib/cart.ts` + `hooks/useCart.ts`. The Cart and Favorites objects are identical — same localStorage keys, same logic, just exported as a hook. `window.Cart` and `window.Favorites` globals go away. |
| `fbt.js` | `components/FBT.tsx` (Frequently Bought Together) |
| `upsell-modal.js` | `components/UpsellModal.tsx` |
| `milestones.js` | `components/MilestoneSelect.tsx` |
| `mile-packs.js` | `components/MilePacks.tsx` |
| `store-pricing.js` | `lib/pricing.ts` |
| `tracking.js` | `lib/tracking.ts` |
| `countdown.js` | `components/Countdown.tsx` |
| `pub-builder.js` + `pub-pdf.js` + `pub-render.js` | `components/PubBuilder.tsx`, `lib/pub-pdf.ts`, `lib/pub-render.ts` |
| `portal.js` | `lib/portal.ts` |
| `chat.js` | `components/Chat.tsx` |

**`showToast`:** Move to `components/Toast.tsx` + a `useToast` hook. Remove `window.showToast` global.

---

## Auth Migration Detail

Current `auth.js` uses Supabase directly. In Next.js:

1. Install `@supabase/ssr`
2. `lib/supabase/client.ts` — browser client (for cart page, favorites, auth forms)
3. `lib/supabase/server.ts` — server client (for Route Handlers, Server Components)
4. `middleware.ts` — refresh session cookie on every request
5. The `onAuthReady(callback)` pattern → `useUser()` hook that reads from `useSession()`
6. `requireAuth()` → `middleware.ts` matcher on `/(account)` route group
7. `redirectIfAuthed()` → middleware redirect on `/(auth)` route group when session exists
8. `renderAuthNav(user)` → Server Component nav that reads session server-side (no flash)
9. `safeReturnPath()` → keep the exact same function in `lib/auth.ts` (open-redirect defense)

Google OAuth redirect URL to update in Supabase dashboard:
- Remove: `https://driverappreciationsolutions.com/account.html`
- Add: `https://driverappreciationsolutions.com/account`

---

## Environment Variables

All current `.env` vars carry over unchanged:

```
NEXT_PUBLIC_SUPABASE_URL=          (was window.SUPABASE_URL injected by /api/supabase-config)
NEXT_PUBLIC_SUPABASE_ANON_KEY=     (same)
SUPABASE_SERVICE_ROLE_KEY=         (server-only, was in api/_supabase.js)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=(was served by /api/config)
STRIPE_SECRET_KEY=                 (same)
STRIPE_WEBHOOK_SECRET=             (same)
SITE_URL=                          (same, used in create-checkout for success/cancel URLs)
```

Remove from `.env` after migration:
- Any Firebase variables (not used)

---

## lib/catalog.ts and lib/shipping.ts

Copy `lib/catalog.js` → `lib/catalog.ts` verbatim, add TypeScript types.
Copy `lib/shipping.js` → `lib/shipping.ts` verbatim, add TypeScript types.
These contain the price authority and shipping calculator — do not change the logic.

---

## What a "1 Day" Execution Looks Like

This assumes the plan above is followed exactly and no decisions need to be made on execution day.

**Hours 1–2: Scaffold**
- `npx create-next-app@latest das-web --typescript --tailwind --app`
- Copy `css/styles.css` → `app/globals.css` verbatim
- Copy `lib/catalog.js`, `lib/shipping.js` → `lib/` with TypeScript types
- Set up `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`
- Configure env vars

**Hours 3–5: Pages**
- Convert all HTML pages to Next.js pages following the route map above
- Copy HTML structure into JSX — the markup and class names don't change
- Replace `<script>` tags with imported hooks and components
- Add redirects for `.html` URLs in `next.config.ts`

**Hours 5–7: API Routes**
- Copy each `api/*.js` → `app/api/*/route.ts` with signature change only
- Delete `supabase-config`, `config`, and `firebase-config` endpoints
- Test Stripe checkout end-to-end in Stripe test mode

**Hours 7–8: Auth + Cart**
- Wire `useUser()` hook into nav, account page, cart page
- Verify Google OAuth redirect works with the new `/account` URL
- Verify localStorage cart persists across pages
- Smoke test: add to cart → checkout → success page → order appears in account

**Deploy:** Vercel — same project, same domain. Change framework from "Other" to "Next.js" in project settings.

---

## Known Risks on Migration Day

| Risk | Mitigation |
|---|---|
| Color variables look wrong on dark sections | Dark sections already use explicit hex, not variables. Copy CSS verbatim and trust it. |
| Supabase Google OAuth redirect mismatch | Update allowed redirect URL in Supabase dashboard before deploying |
| Stripe webhook URL changes | Webhook URL is `/api/webhook` — same path in Next.js. No change needed if path matches. |
| `window.Cart` / `window.showToast` globals referenced in inline scripts | Find all `<script>` tags that call these globals. Move calls into the component that owns the page. |
| `pub-builder.js` / `pub-pdf.js` complexity | These are self-contained. Move to `components/` and test the pub flow independently. |
| Firebase references in code | `FIREBASE_SETUP.md` exists but `auth.js` is pure Supabase. Search codebase for `firebase` before migrating — delete any stale references found. |

---

## Files to Delete After Migration

```
api/supabase-config.js
api/config.js
api/firebase-config.js
FIREBASE_SETUP.md
dev-server.js        (local static server — not needed with next dev)
netlify/             (legacy, Vercel is live host)
```

---

## Do Not Change

- `lib/catalog.js` product IDs — Stripe metadata, order records, and `das_orders.items` all reference these IDs
- `das_cart_v1` and `das_favorites_v1` localStorage keys — existing users have carts in these keys
- `das_orders` table column names or status values
- The repeat-customer logic in `create-checkout` — business rule, not implementation detail
- Bundle discount threshold ($575) and percentage (15%) — sourced from business, not code
- Per-hire minimum logic (`PER_HIRE_REPEAT_MIN`) — affects real order minimums
