-- ============================================================
-- DAS .com (driverappreciationsolutions.com) — Migration 024
-- Publications Builder, USER-SCOPED MVP
--
-- Context: the .com /account portal authenticates with Supabase
-- but stores its company/roster only in localStorage. It has no
-- companies/users.company_id/drivers rows, so the das-portal
-- company-scoped publications model (RLS via current_company_id())
-- cannot work here. This migration adds a self-contained,
-- user-scoped publications table keyed directly on auth.uid(),
-- with featured-driver cards stored INLINE as JSONB (no FK to a
-- real drivers table).
--
-- Reuses the public `publication-assets` bucket already created by
-- migration 023 (das-portal) and adds an authenticated INSERT
-- policy so uploads use the caller's own token — no service-role
-- secret is required on the .com Vercel project.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF
-- EXISTS before CREATE, bucket insert ON CONFLICT DO NOTHING,
-- storage policy guarded by a pg_policies existence check.
-- Safe to re-run.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- das_publications — one row = one newsletter issue, owned by the
-- logged-in Supabase user. Driver spotlight cards live inline in
-- the `drivers` JSONB array (each element matches
-- PublicationDriverContent + a name), so no real drivers table is
-- needed. `settings` holds module toggles, the letter from
-- management, etc.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS das_publications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Untitled Issue',
  format      text NOT NULL DEFAULT 'magazine',   -- 'magazine' | 'mailer'
  quarter     text,                               -- 'Q1'..'Q4' or NULL (special issue)
  year        int,
  page_count  int  NOT NULL DEFAULT 8,
  status      text NOT NULL DEFAULT 'draft'       -- 'draft' | 'generating' | 'published'
              CHECK (status IN ('draft','generating','published')),
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { modules:{…}, letter:'…', company_name:'…' }
  drivers     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [ { name, driver_type, milestone, quote, photo_url, … } ]
  pdf_url     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE das_publications IS
  'User-scoped driver-recognition newsletter issues for the .com /account builder. Owner = auth.uid(). Driver spotlight cards stored inline in drivers JSONB (no FK to a drivers table). Created by .com migration 024.';

CREATE INDEX IF NOT EXISTS das_publications_owner_id_idx
  ON das_publications(owner_id);

CREATE INDEX IF NOT EXISTS das_publications_status_idx
  ON das_publications(status);

-- ── updated_at touch trigger ─────────────────────────────────
CREATE OR REPLACE FUNCTION das_publications_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS das_publications_set_updated_at ON das_publications;
CREATE TRIGGER das_publications_set_updated_at
  BEFORE UPDATE ON das_publications
  FOR EACH ROW
  EXECUTE FUNCTION das_publications_touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE das_publications ENABLE ROW LEVEL SECURITY;

-- Owner can do everything with their own issues.
DROP POLICY IF EXISTS "das_publications_owner_all" ON das_publications;
CREATE POLICY "das_publications_owner_all"
  ON das_publications FOR ALL
  USING      (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Anyone (incl. logged-out) can read a PUBLISHED issue — powers the
-- public /pub share page. Drafts stay private to the owner.
DROP POLICY IF EXISTS "das_publications_public_read" ON das_publications;
CREATE POLICY "das_publications_public_read"
  ON das_publications FOR SELECT
  USING (status = 'published');

-- ─────────────────────────────────────────────────────────────
-- Storage: publication-assets bucket (already created public-read
-- by migration 023). Add an INSERT policy so an AUTHENTICATED user
-- can upload driver photos / generated PDFs into their OWN folder
-- ({uid}/…) using their session token — no service-role key needed
-- on the .com. Guarded existence check keeps this re-runnable.
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('publication-assets', 'publication-assets', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'publication_assets_owner_insert'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "publication_assets_owner_insert"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'publication-assets'
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
    $pol$;
  END IF;

  -- Allow owners to overwrite/replace their own assets (re-generate PDF).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'publication_assets_owner_update'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "publication_assets_owner_update"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (
          bucket_id = 'publication-assets'
          AND (storage.foldername(name))[1] = auth.uid()::text
        )
    $pol$;
  END IF;
END $$;

COMMIT;
