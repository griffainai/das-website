-- =============================================
-- DRIVER APPRECIATION SOLUTIONS — Portal Backend
-- Migration 010: chat/quote lead capture + billing subscriptions
-- ---------------------------------------------
-- Idempotent + additive. Safe to run alongside other sessions' migrations.
-- Supports: api/submit-quote.js (website_leads, quotes) and the billing
-- functions (subscriptions, users.stripe_customer_id).
-- =============================================

-- ── website_leads ────────────────────────────────────────────────────────
-- Anonymous quote requests captured from the Scout chat widget. No FK
-- constraints so a lead is never rejected. Written by the service role.
create table if not exists public.website_leads (
  id                uuid primary key default gen_random_uuid(),
  contact_name      text,
  contact_email     text,
  company           text,
  type              text,
  driver_count      integer,
  budget_per_driver numeric,
  timeline          text,
  notes             text,
  source            text default 'website_chat',
  status            text default 'new',
  created_at        timestamptz default now()
);

alter table public.website_leads enable row level security;

-- No anon/auth policies → only the service role (which bypasses RLS) can
-- read/write. The chat widget posts through the serverless function, never
-- directly to the table.

-- ── quotes ───────────────────────────────────────────────────────────────
-- Authenticated portal users' quote requests, linked to their company.
create table if not exists public.quotes (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid,
  user_id           uuid,
  type              text,
  driver_count      integer,
  budget_per_driver numeric,
  timeline          text,
  notes             text,
  status            text default 'submitted',
  created_at        timestamptz default now()
);

alter table public.quotes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quotes'
      and policyname = 'quotes_select_own'
  ) then
    create policy quotes_select_own on public.quotes
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- ── subscriptions ────────────────────────────────────────────────────────
-- Stripe subscription state, synced by api/stripe-webhook.js. One row per
-- company (onConflict: company_id).
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid unique,
  stripe_subscription_id text,
  stripe_customer_id     text,
  tier                   text,
  status                 text,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

alter table public.subscriptions enable row level security;

-- ── users.stripe_customer_id ─────────────────────────────────────────────
-- Billing checkout stores the Stripe customer id on the portal user.
alter table public.users add column if not exists stripe_customer_id text;
