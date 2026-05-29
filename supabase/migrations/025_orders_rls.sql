-- ============================================================
-- Migration 025: Row-Level Security on das_orders
--
-- PROBLEM: das_orders stores driver home addresses (recipients JSON)
-- but had no RLS, meaning any authenticated user could query any
-- company's order data directly via the anon-key Supabase client,
-- bypassing the portal.js company_id filter.
--
-- FIX: Enable RLS and lock rows to company membership.
-- Service-role (used by all api/*.js handlers) bypasses RLS by
-- design in Postgres, so no server-side changes are needed.
--
-- Policy design:
--   • SELECT  — only rows where company_id matches the user's company_id
--               (looked up from the users table via the JWT sub).
--   • INSERT  — blocked; all inserts go via service-role (api/).
--   • UPDATE  — blocked; all updates go via service-role (api/).
--   • DELETE  — blocked; soft-deletes only, via service-role (api/).
-- ============================================================

-- 1. Enable RLS.
alter table public.das_orders enable row level security;

-- 2. SELECT: a logged-in user may only read their own company's orders.
--    We join to users via auth.uid() so the company_id comes from the
--    DB, not from a client-supplied value.
create policy "orders_select_own_company"
  on public.das_orders
  for select
  to authenticated
  using (
    company_id = (
      select company_id
        from public.users
       where id = auth.uid()
       limit 1
    )
  );

-- 3. No direct INSERT/UPDATE/DELETE from the client — all writes go
--    through api/*.js which runs as service role (bypasses RLS).
--    Explicitly deny so any accidental direct write from the browser
--    returns a clear error rather than silently failing.
create policy "orders_no_direct_insert"
  on public.das_orders
  for insert
  to authenticated
  with check (false);

create policy "orders_no_direct_update"
  on public.das_orders
  for update
  to authenticated
  using (false);

-- 4. Anon users see nothing (marketing checkouts create orders via
--    service role; the order confirmation page reads from Stripe, not
--    this table).
-- (No anon policy = anon sees nothing, which is correct.)
