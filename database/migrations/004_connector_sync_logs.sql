-- ============================================
-- BOSSVIEW — Connector Sync Logs Table
-- ============================================
-- Run manually if database was already initialized:
--   docker exec -i bossview-postgres psql -U bossview -d bossview < database/migrations/004_connector_sync_logs.sql
-- ============================================

CREATE TABLE IF NOT EXISTS connector_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_id UUID NOT NULL REFERENCES connector_configs(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_fetched INTEGER DEFAULT 0,
    created INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_connector ON connector_sync_logs(connector_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON connector_sync_logs(started_at);
