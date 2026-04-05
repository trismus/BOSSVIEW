-- ============================================
-- BOSSVIEW — Initial Database Schema
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'readonly' REFERENCES roles(name),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets table
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255),
    source VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('workstation', 'virtual_server', 'physical_server', 'network_device', 'storage', 'software', 'license', 'other')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
    lifecycle_stage VARCHAR(50) DEFAULT 'active' CHECK (lifecycle_stage IN ('planning', 'procurement', 'deployment', 'active', 'maintenance', 'decommissioned', 'disposed')),
    criticality VARCHAR(50) DEFAULT 'unclassified' CHECK (criticality IN ('critical', 'high', 'medium', 'low', 'unclassified')),
    ip_address INET,
    os VARCHAR(255),
    location JSONB DEFAULT '{}',
    hardware_info JSONB DEFAULT '{}',
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset relations
CREATE TABLE asset_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN ('depends_on', 'runs_on', 'connected_to', 'backup_of')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs (append-only)
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(20) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id UUID
);

-- Enforce append-only: prevent UPDATE and DELETE on audit_logs
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM PUBLIC;

-- Additional safety: trigger that prevents UPDATE/DELETE
CREATE OR REPLACE FUNCTION prevent_audit_modification() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are append-only. UPDATE and DELETE operations are not permitted.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Refresh tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_name ON assets(name);
CREATE INDEX idx_assets_external_id ON assets(external_id);
CREATE INDEX idx_assets_ip ON assets(ip_address);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Insert roles
INSERT INTO roles (name, permissions) VALUES
    ('admin', '["*"]'),
    ('engineer', '["assets:read", "assets:write", "incidents:read", "incidents:write", "changes:read", "changes:write", "dashboard:read", "connectors:read"]'),
    ('manager', '["assets:read", "incidents:read", "incidents:write", "changes:read", "changes:approve", "dashboard:read", "reports:read", "reports:generate"]'),
    ('auditor', '["assets:read", "incidents:read", "changes:read", "dashboard:read", "audit:read", "reports:read"]'),
    ('readonly', '["assets:read", "incidents:read", "changes:read", "dashboard:read"]');
