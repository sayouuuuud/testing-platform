-- Floating "tester updates" notepad — shared checklist across all testers.
-- Each row is one "card" (tester name + list of checklist items).

CREATE TABLE IF NOT EXISTS tester_updates (
  id          BIGSERIAL PRIMARY KEY,
  category    TEXT NOT NULL DEFAULT 'update' CHECK (category IN ('update', 'general_error')),
  tester_name TEXT NOT NULL DEFAULT '',
  items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If the table already exists from a previous version of this migration,
-- add the category column without losing existing rows.
ALTER TABLE tester_updates
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'update';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'tester_updates'
      AND constraint_name = 'tester_updates_category_check'
  ) THEN
    ALTER TABLE tester_updates
      ADD CONSTRAINT tester_updates_category_check
      CHECK (category IN ('update', 'general_error'));
  END IF;
END $$;

-- Allow public read so anyone visiting the dashboard sees the notepad.
ALTER TABLE tester_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tester_updates_read_all" ON tester_updates;
CREATE POLICY "tester_updates_read_all"
  ON tester_updates
  FOR SELECT
  USING (true);

-- Writes happen through the service role (server actions), so no public
-- INSERT / UPDATE / DELETE policy is created.

-- Realtime: include this table in the supabase_realtime publication so the
-- client picks up changes the same way it does for test_items.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tester_updates'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tester_updates';
  END IF;
END $$;
