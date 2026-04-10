-- ============================================
-- SKYNEX — Connector Configurations Table
-- ============================================
-- Run manually if database was already initialized:
--   docker exec -i skynex-postgres psql -U skynex -d skynex < database/migrations/003_connector_configs.sql
-- ============================================

CREATE TABLE IF NOT EXISTS connector_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    adapter_type VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('itsm', 'monitoring', 'cmdb', 'security', 'import', 'workflow')),
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT false,
    schedule VARCHAR(100),
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(20) CHECK (last_sync_status IN ('running', 'success', 'failed', 'partial')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connector_configs_enabled ON connector_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_connector_configs_adapter ON connector_configs(adapter_type);
