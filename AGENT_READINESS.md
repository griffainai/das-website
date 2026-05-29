# Agent Readiness — Implementation Notes

Audit reference: https://isitagentready.com (driverappreciationsolutions.com)

## Implemented in this repo

| Item | Where | Notes |
|---|---|---|
| **Link response headers (RFC 8288)** | `vercel.json` → `/` and `/index.html` sources | Advertises `api-catalog`, agent-skills index, `sitemap`, `service-doc`. |
| **Content Signals in robots.txt** | `robots.txt` | `search=yes, ai-input=yes, ai-train=no` — declines training, allows search + grounding. Adjust if policy changes. |
| **API Catalog (RFC 9727)** | `.well-known/api-catalog` | `application/linkset+json` (Content-Type set in `vercel.json`). Lists `/api/contact`, `/api/newsletter-subscribe`, `/api/create-checkout`, `/api/create-payment-intent`, and the shop catalog. |
| **Agent Skills discovery index** | `.well-known/agent-skills/index.json` + `.well-known/agent-skills/browse-catalog/SKILL.md` | Per RFC v0.2.0. SHA256 of SKILL.md recomputed below if you edit it. |
| **WebMCP** | `index.html` (bottom `<script>`) | Exposes `search_products`, `open_solution`, `contact_sales`, `view_cart` to agents that implement `navigator.modelContext`. |

### Recomputing the SKILL.md SHA256

If you edit `.well-known/agent-skills/browse-catalog/SKILL.md`, refresh the digest in `index.json`:

```powershell
Get-FileHash .well-known/agent-skills/browse-catalog/SKILL.md -Algorithm SHA256
```

## Deferred — out of scope for static site or require external setup

| Item | Why deferred | What it would take |
|---|---|---|
| **DNS-AID records** | DNS-level, not in this repo. | At the DNS provider for `driverappreciationsolutions.com`, publish SVCB/HTTPS records under `_index._agents.driverappreciationsolutions.com` pointing to the homepage and `_a2a._agents...` if/when an A2A endpoint exists. Enable DNSSEC on the zone. |
| **Markdown for Agents (Accept: text/markdown)** | Static-served HTML; no per-request content negotiation. | Add a Vercel Edge Middleware (`middleware.ts`) that, on `Accept: text/markdown`, fetches the HTML and converts via Turndown (or pre-builds a parallel `.md` for each page) and responds with `Content-Type: text/markdown`. Worth doing when an agent-traffic use case is identified. |
| **OAuth/OIDC discovery** (`/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`) | No protected APIs — endpoints are anonymous public POSTs (contact, newsletter, Stripe-server-side). | Only publish if/when we add agent-authenticated endpoints. |
| **OAuth Protected Resource Metadata** (`/.well-known/oauth-protected-resource`) | Same as above — no protected resources. | Same as above. |
| **auth.md** | No agent registration flow exists. | Add only if we open programmatic agent registration. |
| **MCP Server Card** (`/.well-known/mcp/server-card.json`) | We don't operate an MCP server endpoint for this site. WebMCP (browser-side) is the closest thing and is implemented in `index.html`. | If we stand up a hosted MCP server (e.g. for fleet ordering), publish `server-card.json` then. |

## Verification

After deploy, spot-check with curl:

```bash
curl -I https://driverappreciationsolutions.com/                       # expect Link headers
curl https://driverappreciationsolutions.com/robots.txt                # expect Content-Signal line
curl -i https://driverappreciationsolutions.com/.well-known/api-catalog  # expect application/linkset+json
curl https://driverappreciationsolutions.com/.well-known/agent-skills/index.json
```

Then re-run https://isitagentready.com/?domain=driverappreciationsolutions.com to confirm passing items.
