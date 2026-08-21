# DAS — Login Architecture & Test Accounts

The canonical map of every role on driverappreciationsolutions.com. Sister doc:
`E:\Workspaces\odndr-web\LOGIN-ARCHITECTURE.md`. Emailed to Shaq 2026-08-21.
(`.vercelignore` excludes `*.md` — this file never deploys publicly.)

**Login page: https://www.driverappreciationsolutions.com/login**
Everyone lands in `/account`; the sections you see depend on who you are.
Admin panels appear for the `ADMIN_EMAILS` allowlist (server-verified per request).

## Roles & logins

| Role | Login | Password | Lands at | Owns |
|---|---|---|---|---|
| Company / customer (TEST) | testcompany@dastest.test | `DAS-Test-a3f5062d` | `/account` | Dashboard, orders, recognition programs, roster, publications, billing, quotes, ideas & guides, support |
| Admin — Shaq (REAL) | ssshafeek@driverappreciationsolutions.com | his own | `/account` + admin | Admin orders, tickets, quotes, products |
| Admin — Shaq personal (REAL) | shaqisvictory@gmail.com | his own | `/account` + admin | Same |
| Admin — Jayden (REAL) | griffainai@gmail.com | his own | `/account` + admin | Same |

Real-account passwords are Supabase one-way hashes — unreadable and
unexportable by anyone. Admin access is granted by adding an email to the
`ADMIN_EMAILS` env (server) + `ADMIN_EMAILS_CLIENT` in account.html (display),
never by sharing a personal password.

The test account has a full profile: company **"Test Fleet Co. (DEMO)"**
(id 8d9b60bb-f602-4726-8ab7-0ad88111988d), `users.role = owner` — every portal
section renders. Created 2026-08-21 via service role.

## Cleanup candidates

Stale June test accounts with unknown passwords (recommend deleting in
Supabase Auth): autotest@test.com · test99@test.com · fang_test@proton.me
