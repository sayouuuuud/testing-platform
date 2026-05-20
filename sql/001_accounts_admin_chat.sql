-- ─────────────────────────────────────────────────────────────────────────────
-- 001 — Accounts, admin panel, presence & chat
--
-- Adds a real account system on top of Supabase Auth and the supporting tables
-- needed for the admin panel, real-time chat, presence indicators and tester
-- profiles. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                TEXT NOT NULL,
  display_name         TEXT NOT NULL DEFAULT '',
  is_admin             BOOLEAN NOT NULL DEFAULT FALSE,
  registration_order   INTEGER UNIQUE,
  avatar_url           TEXT,
  last_seen_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_registration_order_idx
  ON profiles (registration_order);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles
  FOR SELECT USING (true);

-- Writes go through the service role; no public write policy.

-- ── visits log (admin analytics) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  path        TEXT NOT NULL DEFAULT '/',
  user_agent  TEXT,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visits_created_at_idx ON visits (created_at DESC);
CREATE INDEX IF NOT EXISTS visits_user_id_idx ON visits (user_id);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visits_read_admin" ON visits;
CREATE POLICY "visits_read_admin" ON visits
  FOR SELECT USING (false);
-- Reads happen through the service role on the admin pages.

-- ── activity log (per-tester history) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL, -- e.g. 'status_change', 'item_edit', 'note_edit'
  item_id      INTEGER REFERENCES test_items(id) ON DELETE SET NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_user_id_idx ON activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_item_id_idx ON activity_log (item_id, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_read_all" ON activity_log;
CREATE POLICY "activity_log_read_all" ON activity_log
  FOR SELECT USING (true);

-- ── chat messages (public channel) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  mentions     UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx
  ON chat_messages (created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_read_all" ON chat_messages;
CREATE POLICY "chat_messages_read_all" ON chat_messages
  FOR SELECT USING (true);

-- ── augment test_items / tester_updates with tester_id ──────────────────────
ALTER TABLE test_items
  ADD COLUMN IF NOT EXISTS tester_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE tester_updates
  ADD COLUMN IF NOT EXISTS tester_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS test_items_tester_id_idx ON test_items (tester_id);
CREATE INDEX IF NOT EXISTS tester_updates_tester_id_idx ON tester_updates (tester_id);

-- ── always stamp updated_at on test_items / test_phases / test_sections ────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS test_items_set_updated_at ON test_items;
CREATE TRIGGER test_items_set_updated_at
  BEFORE UPDATE ON test_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── on signup: create profile + bump registration_order + rebind legacy data
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
DECLARE
  next_order INTEGER;
  legacy_name TEXT;
  new_display TEXT;
BEGIN
  -- Pull a display name from raw_user_meta_data.display_name if the inviter
  -- attached one; otherwise fall back to the local-part of the email.
  new_display := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  SELECT COALESCE(MAX(registration_order), 0) + 1 INTO next_order FROM profiles;

  INSERT INTO profiles (id, email, display_name, registration_order)
  VALUES (NEW.id, NEW.email, new_display, next_order)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Re-bind legacy testers in registration order:
  --   1st registrant → all rows tagged 'سيد'
  --   2nd registrant → all rows tagged 'mazen' / 'Mazen' / 'مازن'
  legacy_name := CASE next_order
    WHEN 1 THEN 'سيد'
    WHEN 2 THEN 'mazen'
    ELSE NULL
  END;

  IF legacy_name IS NOT NULL THEN
    UPDATE test_items
      SET tester_name = new_display, tester_id = NEW.id
      WHERE LOWER(tester_name) = LOWER(legacy_name)
         OR (next_order = 2 AND tester_name IN ('Mazen', 'مازن'));

    UPDATE tester_updates
      SET tester_name = new_display, tester_id = NEW.id
      WHERE LOWER(tester_name) = LOWER(legacy_name)
         OR (next_order = 2 AND tester_name IN ('Mazen', 'مازن'));
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── realtime publications ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activity_log'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log';
  END IF;
END $$;
