-- Migration 008: Directory Users (imported from external systems like KACE)
-- Stores user identities from directory/CMDB sources, separate from BOSSVIEW auth users.
-- Includes asset-user assignments for tracking device ownership.

-- Directory Users
CREATE TABLE IF NOT EXISTS directory_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255),
  source VARCHAR(100) NOT NULL DEFAULT 'quest-kace',
  username VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  email VARCHAR(255),
  domain VARCHAR(100),
  department VARCHAR(255),
  title VARCHAR(255),
  manager VARCHAR(255),
  phone VARCHAR(50),
  locale VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_directory_users_username ON directory_users(username);
CREATE INDEX IF NOT EXISTS idx_directory_users_email ON directory_users(email);
CREATE INDEX IF NOT EXISTS idx_directory_users_source ON directory_users(source);

-- Asset-User Assignments (which user uses which device)
CREATE TABLE IF NOT EXISTS asset_user_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES directory_users(id) ON DELETE CASCADE,
  assignment_type VARCHAR(30) NOT NULL DEFAULT 'primary_user',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  source VARCHAR(100) DEFAULT 'quest-kace',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, user_id, assignment_type),
  CHECK (assignment_type IN ('primary_user', 'last_user', 'owner', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_asset_user_asset ON asset_user_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_user_user ON asset_user_assignments(user_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION directory_users_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to make migration idempotent
DROP TRIGGER IF EXISTS trg_directory_users_updated ON directory_users;
CREATE TRIGGER trg_directory_users_updated
  BEFORE UPDATE ON directory_users
  FOR EACH ROW EXECUTE FUNCTION directory_users_update_timestamp();

-- Audit log support: track changes to directory_users
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value, ip_address)
SELECT
  '00000000-0000-0000-0000-000000000000',
  'SCHEMA_MIGRATION',
  'system',
  '008_directory_users',
  '{"migration": "008_directory_users", "tables": ["directory_users", "asset_user_assignments"]}'::jsonb,
  '127.0.0.1'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')
ON CONFLICT DO NOTHING;
