-- ============================================
-- SKYNEX — Incidents & Changes Migration
-- ============================================
-- NOTE: If the database was already initialized with 001_init.sql via Docker,
-- this migration must be run manually:
--   docker exec -i skynex-postgres psql -U skynex -d skynex < database/migrations/002_incidents_changes.sql
-- ============================================

-- incidents table
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255),
    source VARCHAR(100) DEFAULT 'manual',
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'p3' CHECK (priority IN ('p1', 'p2', 'p3', 'p4')),
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed')),
    category VARCHAR(100),
    assigned_to UUID REFERENCES users(id),
    reported_by UUID REFERENCES users(id),
    sla_target TIMESTAMPTZ,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    mttr_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- changes table
CREATE TABLE IF NOT EXISTS changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255),
    source VARCHAR(100) DEFAULT 'manual',
    title VARCHAR(500) NOT NULL,
    description TEXT,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'in_progress', 'completed', 'failed', 'cancelled')),
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    rollback_plan TEXT,
    success BOOLEAN,
    post_review TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- asset_incidents join table
CREATE TABLE IF NOT EXISTS asset_incidents (
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, incident_id)
);

-- asset_changes join table
CREATE TABLE IF NOT EXISTS asset_changes (
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    change_id UUID REFERENCES changes(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, change_id)
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority);
CREATE INDEX IF NOT EXISTS idx_incidents_opened ON incidents(opened_at);
CREATE INDEX IF NOT EXISTS idx_changes_status ON changes(status);
CREATE INDEX IF NOT EXISTS idx_changes_risk ON changes(risk_level);
CREATE INDEX IF NOT EXISTS idx_changes_scheduled ON changes(scheduled_start);

-- audit triggers (only if audit_trigger_func exists from 001_init.sql)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger_func') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_incidents') THEN
            CREATE TRIGGER audit_incidents
                AFTER INSERT OR UPDATE OR DELETE ON incidents
                FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_changes') THEN
            CREATE TRIGGER audit_changes
                AFTER INSERT OR UPDATE OR DELETE ON changes
                FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
        END IF;
    END IF;
END
$$;
