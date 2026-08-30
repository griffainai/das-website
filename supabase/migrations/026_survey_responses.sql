-- ============================================================================
-- 026 · survey_responses
-- Electronic intake for the three DAS instruments (driver feedback, recognition
-- assessment, 2027 commitment guide). See api/_survey.js.
--
-- The email to the DAS team is the delivery gate. This table is the AGGREGATION
-- layer — it exists so forty driver responses can become one chart in a proposal
-- instead of forty separate inbox items. api/_survey.js writes here best-effort:
-- if this table does not exist, the response still reaches the team by email.
--
-- Service role only. No RLS policies are defined, so with RLS enabled the anon
-- and authenticated roles can read nothing. That is intentional: driver responses
-- are candid feedback about their own employer.
-- ============================================================================

create table if not exists public.survey_responses (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  instrument        text not null check (instrument in ('driver', 'assessment', 'commitment')),
  organization      text not null,

  respondent_name   text,          -- deliberately nullable: drivers may answer anonymously
  respondent_title  text,
  respondent_email  text,
  respondent_phone  text,

  answered_count    integer,
  question_count    integer,
  answers           jsonb not null default '{}'::jsonb
);

-- The two lookups that actually get run: "everything from this org" and
-- "every driver response, newest first".
create index if not exists survey_responses_org_idx
  on public.survey_responses (lower(organization), created_at desc);
create index if not exists survey_responses_instrument_idx
  on public.survey_responses (instrument, created_at desc);

alter table public.survey_responses enable row level security;

comment on table public.survey_responses is
  'Electronic survey intake from /surveys. Service-role only. Email remains the delivery gate; this table is for aggregation.';
