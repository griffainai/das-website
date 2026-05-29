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

## Sister codebases

| Codebase | Path | Purpose |
|---|---|---|
| **das-web (this repo)** | `E:/Workspaces/das-web/` | Marketing site |
| **das-portal** | `E:/Workspaces/griffain-agency-workspace/04_clients/driver-appreciation-solutions/das-portal/` | Admin/ordering Next.js app (Supabase + Stripe) |
| **Engagement record** | `E:/Workspaces/griffain-agency-workspace/04_clients/driver-appreciation-solutions/` | Strategy, comms, decisions, brand-overrides |

When in doubt, check the agency-side `CONTEXT.md` for which file owns a given question.
