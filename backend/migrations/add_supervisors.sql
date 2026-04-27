-- ============================================================
-- SUPERVISORS TABLE
-- Each supervisor belongs to a specific turf, created by the turf owner
-- ============================================================
CREATE TABLE IF NOT EXISTS supervisors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turf_id     UUID NOT NULL REFERENCES turfs(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supervisors_turf ON supervisors(turf_id);
CREATE INDEX IF NOT EXISTS idx_supervisors_email ON supervisors(email);
