# Touchdown — premium tier price multiplier 1.45 → 1.50

**When:** 2026-07-16 14:50 local
**Model/effort:** Claude Opus 4.8, high
**Scope:** `lib/recognition-pricing.js`, `lib/catalog.js`, `product.html`

## What changed

The premium kit tier multiplier went from **1.45 → 1.50**, resolving a live pricing
contradiction where the site advertised one price and the checkout charged another.

- `lib/recognition-pricing.js` — `KIT_MULTIPLIERS.premium` 1.45 → 1.50 (+ header comment)
- `lib/catalog.js` — fallback multiplier + header comment
- `product.html:907` — `data-mult="1.45"` → `"1.5"`
- `product.html:2299` — `TIER_MULTS` fallback
- `product.html:2870` — hardcoded `p.price * 1.45` → `p.price * TIER_MULTS.premium`

## How it went

Found while auditing ad copy: `$74.99` was published for the premium tier in **5 places**
(`commercial-driver-gifts.html` ×4 incl. the JSON-LD offer price and the FAQ,
`driver-appreciation-week-2026.html`, `shop.html`, `solution-appreciation.html`), but the
engine computed `49.99 × 1.45 = $72.49` — a number that appears **nowhere** on the site.

The math settled which side was wrong: `49.99 × 1.50 = $74.99` **exactly** (implied
multiplier for 74.99 is 1.5001). `$74.99` is a chosen retail price point; `$72.49` is not a
price anyone picks. So **1.45 was the typo**, and the direction of the bug was the opposite
of how it first looked — the site was **undercharging $2.50/unit against its own advertised
price**, not overcharging.

The multiplier was duplicated in **5 locations**, including a hardcoded `* 1.45` at
product.html:2870 that a search for `premium: 1.45` would miss. Missing any one would have
made the PDP display a price the server rejects as tampered — a silent checkout failure.
That call site now derives from `TIER_MULTS` instead of a magic number, so it can't drift
again.

Verified with node against the real modules:
```
premium multiplier      = 1.5
das-001 premium         = $74.99   (matches the 5 published pages)
das-003 premium         = $89.99   (was $86.99 — intended side effect)
enterprise unchanged    = $97.48
server resolve($74.99)  = {"status":"verified","unitPrice":74.99,...}
server resolve($72.49)  = {"status":"rejected","reason":"price_mismatch",...}
```
The inversion is the proof: the old price is now correctly rejected as tampered.

## Any errors

None in execution. Two judgement points worth recording:

1. **This is a real pricing change, not a refactor.** It raises `das-001` premium
   $72.49 → $74.99 and, because the multiplier is shared, `das-003` Premium Onboarding Pack
   $86.99 → $89.99. Presented as options A/B/C to Jayden; he chose A (my recommendation).
   Not a call to make unilaterally — flagged and confirmed first.
2. **`das-003` premium at $89.99 is not published anywhere** that I found, so nothing
   contradicts it — but it IS a $3 increase on a live product that nobody explicitly
   requested. Called out at decision time; worth Shakir knowing.

Marketing copy was untouched — the whole point was to make the engine agree with what was
already published, not to rewrite the published price.

## Follow-ups

- `HOOK-BANK.md` entry #40 ("Skip the Swag-Store Rabbit Hole") is **31 chars** despite the
  file's header claiming all entries ≤30 — would be a rejected Google ad. Not fixed (out of
  scope, different repo).
