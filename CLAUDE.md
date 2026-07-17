# DAS Marketing Website (driverappreciationsolutions.com)

This is the **static marketing site** for Driver Appreciation Solutions (DAS), a client of GRIFFAIN AI.

This workspace was extracted from `griffain-agency-workspace/04_clients/driver-appreciation-solutions/website/` on **2026-05-28** so the site can be opened and worked on in isolation without loading the entire agency workspace context.

---

## What this is

- **Static HTML/CSS/JS** marketing site — no framework, no build step for pages
- Hosted on **Vercel** (project name: `website`)
- Domain: `driverappreciationsolutions.com`
- Git remote: `github.com/griffainai/das-website`
- Serverless functions in `api/` (Vercel) and `netlify/functions/` (legacy)
- Stripe Checkout + Firebase (auth/data) + contact/newsletter endpoints

The admin portal (Next.js + Supabase + Stripe) is a SEPARATE codebase at:
`E:\Workspaces\griffain-agency-workspace\04_clients\driver-appreciation-solutions\das-portal\`

---

## Where the engagement record lives

This repo holds only the **website code**. The *relationship* with DAS — decisions, communications, audits, proposals, people, playbooks, brand-overrides — stays in the agency workspace:

```
E:\Workspaces\griffain-agency-workspace\04_clients\driver-appreciation-solutions\
├── CONTEXT.md            ← read this first for engagement context
├── DECISIONS.md
├── OPEN_QUESTIONS.md
├── communications/
├── deliverables/         ← audits, proposals, plans
├── people/               ← Shakir Shafeek (client), Jayden (build)
├── playbooks/
├── reference/hormozi/
├── brand-overrides/      ← DAS color/voice tokens
├── das-portal/           ← separate Next.js codebase
└── website-backup-navy/  ← archived previous design
```

For any non-code question (strategy, client comms, what's blocked, who Shakir is, what we promised), read the agency-side `CONTEXT.md` first.

---

## CRITICAL: DAS color system landmine

**Read [memory: das_color_system.md] before changing any color.** Verbatim from that memory:

- `--black = #FFFFFF` — the CSS variable named `--black` is actually WHITE
- `--gold  = #1A2E6E` — the CSS variable named `--gold` is actually NAVY

The variable names are inverted relative to their values. This was deliberate — do not "fix" it.

Rules:
- **Dark sections must use explicit hex values**, never the CSS variables — variables resolve wrong on dark backgrounds.
- Button styling differs on dark vs light backgrounds (see existing patterns in `css/styles.css`).
- Verified working 2026-05-20. If you're tempted to refactor the color system, stop and ask Jayden first.

---

## Local dev

```
npm install            # if you need any deps
node dev-server.js     # local static server with /api shims
```

`vercel.json` defines headers, redirects, and Content-Types (notably `application/linkset+json` for `.well-known/api-catalog`). `netlify/` directory is legacy — Vercel is the live host.

---

## Agent-readiness implementation

This site implements several agent-discoverability standards. See `AGENT_READINESS.md` for the full table. Notable:

- RFC 8288 Link headers (set in `vercel.json`)
- Content Signals in `robots.txt` (`ai-input=yes, ai-train=no`)
- RFC 9727 API Catalog at `.well-known/api-catalog`
- Agent Skills index at `.well-known/agent-skills/index.json` — **if you edit `browse-catalog/SKILL.md` you MUST recompute its SHA256 and update `index.json`** (PowerShell command in `AGENT_READINESS.md`)
- WebMCP shims at the bottom of `index.html`

---

## Deployment

`DEPLOYMENTS.md` has the deploy notes. Vercel auto-deploys on push to main. The Firebase config and Stripe keys live in `.env` (gitignored) — see `.env.example` for the shape and `FIREBASE_SETUP.md` for setup.

---

## Migration Plan

If the site ever needs to move to Next.js (SSR for SEO, auth consolidation, or JS sprawl becomes unmaintainable): **read `MIGRATION.md` first.** It maps every page, API route, JS module, and env var to its Next.js equivalent, documents the color system landmine, and lays out a 1-day execution checklist. Do not make migration decisions from scratch — the plan is already done.

**Trigger conditions to migrate:**
- Need SSR/SSG for SEO (current site is client-rendered, Google sees empty HTML)
- Want to consolidate auth from CDN Supabase client → `@supabase/ssr` server-side sessions
- JS module count grows past ~15 and `<script>` tag ordering becomes fragile
- Need TypeScript or a component library

**Do NOT migrate** just because the site is static HTML. It's working.

---

## Sister codebases

| Codebase | Path | Purpose |
|---|---|---|
| **das-web (this repo)** | `E:/Workspaces/das-web/` | Marketing site |
| **das-portal** | `E:/Workspaces/griffain-agency-workspace/04_clients/driver-appreciation-solutions/das-portal/` | Admin/ordering Next.js app (Supabase + Stripe) |
| **Engagement record** | `E:/Workspaces/griffain-agency-workspace/04_clients/driver-appreciation-solutions/` | Strategy, comms, decisions, brand-overrides |

When in doubt, check the agency-side `CONTEXT.md` for which file owns a given question.

## Logbook — write a touchdown before you finish

This repo keeps a logbook at `log/`. It is the black box: a self-building record of every
job, committed alongside the work it describes.

**Before you finish any job that changed files in this repo**, write a touchdown:

1. Read `log/TOUCHDOWN_TEMPLATE.md` for the format, the depth rule, and the model/effort rule.
2. Write it to `log/touchdowns/<YYYY-MM-DD>_<HHMM>_<slug>.md` — local time, 24-hour,
   zero-padded. No counter; see `log/README.md` for why.
3. Commit it with the work, not as a separate commit. If the work landed in a nested repo
   (a gitlink), the touchdown still goes in this repo and cannot share the commit — say so
   in the record instead of claiming otherwise.

This is enforced by a `Stop` hook (`.claude/hooks/touchdown-guard.ps1`): if the session
commits and no commit touches `log/touchdowns/`, the hook blocks the session from finishing
and tells you to write the record. Do not work around it — write the touchdown.

Go deep on `## How it went` and `## Any errors` — those two sections are the whole point of
the record. Stay terse elsewhere. Report failures and correction passes honestly; a
touchdown that grades itself well when the job went badly makes the logbook worthless.

Read-only jobs that changed nothing do not need a touchdown.

Run `/logbook-review` to read the whole record back.
