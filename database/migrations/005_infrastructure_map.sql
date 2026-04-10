-- ============================================
-- SKYNEX — Infrastructure Map Schema
-- Issue #52: DB Migration for Virtual Infrastructure Map
-- ============================================

-- ============================================
-- 1. Racks (referenced by infra_devices)
-- ============================================
CREATE TABLE IF NOT EXISTS infra_racks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL,  -- FK added after infra_locations exists
    name            VARCHAR(50) NOT NULL,
    total_units     INTEGER NOT NULL DEFAULT 42,
    row_label       VARCHAR(10),
    position        INTEGER,
    floor_x         DECIMAL(6,1),
    floor_y         DECIMAL(6,1),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Locations
-- ============================================
CREATE TABLE IF NOT EXISTS infra_locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(10) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    country         VARCHAR(100) NOT NULL,
    latitude        DECIMAL(9,6) NOT NULL,
    longitude       DECIMAL(9,6) NOT NULL,
    location_type   VARCHAR(20) NOT NULL CHECK (location_type IN ('headquarters', 'datacenter', 'office', 'branch')),
    status          VARCHAR(20) NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'warning', 'critical', 'maintenance', 'offline')),
    timezone        VARCHAR(40),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from racks to locations
ALTER TABLE infra_racks
    ADD CONSTRAINT fk_infra_racks_location
    FOREIGN KEY (location_id) REFERENCES infra_locations(id);

-- Locations audit trail (append-only, ISO 27001)
CREATE TABLE IF NOT EXISTS infra_locations_audit (
    audit_id        BIGSERIAL PRIMARY KEY,
    location_id     UUID NOT NULL REFERENCES infra_locations(id),
    changed_by      UUID NOT NULL REFERENCES users(id),
    changed_at      TIMESTAMPTZ DEFAULT NOW(),
    change_type     VARCHAR(10) NOT NULL CHECK (change_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values      JSONB,
    new_values      JSONB
);

-- ============================================
-- 3. WAN Links
-- ============================================
CREATE TABLE IF NOT EXISTS infra_wan_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_location   UUID NOT NULL REFERENCES infra_locations(id),
    to_location     UUID NOT NULL REFERENCES infra_locations(id),
    link_type       VARCHAR(20) NOT NULL CHECK (link_type IN ('primary', 'secondary', 'backup')),
    bandwidth       VARCHAR(20),
    provider        VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    latency_ms      INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. VLANs
-- ============================================
CREATE TABLE IF NOT EXISTS infra_vlans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES infra_locations(id),
    vlan_id         INTEGER NOT NULL,
    name            VARCHAR(100) NOT NULL,
    cidr            VARCHAR(18) NOT NULL,
    purpose         VARCHAR(200),
    color_hex       VARCHAR(7),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(location_id, vlan_id)
);

-- ============================================
-- 5. Devices
-- ============================================
CREATE TABLE IF NOT EXISTS infra_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES infra_locations(id),
    vlan_id         UUID REFERENCES infra_vlans(id),
    name            VARCHAR(100) NOT NULL,
    device_type     VARCHAR(30) NOT NULL CHECK (device_type IN (
        'firewall', 'switch-core', 'switch', 'router',
        'server', 'storage', 'wireless', 'ups', 'patch-panel', 'pdu'
    )),
    model           VARCHAR(100),
    manufacturer    VARCHAR(100),
    serial_number   VARCHAR(100),
    ip_address      INET,
    mac_address     MACADDR,
    firmware        VARCHAR(50),
    status          VARCHAR(20) NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'warning', 'critical', 'maintenance', 'offline', 'decommissioned')),
    topo_x          DECIMAL(6,1),
    topo_y          DECIMAL(6,1),
    rack_id         UUID REFERENCES infra_racks(id),
    rack_u_start    INTEGER,
    rack_u_height   INTEGER DEFAULT 1,
    asset_id        UUID REFERENCES assets(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infra_devices_location ON infra_devices(location_id);
CREATE INDEX IF NOT EXISTS idx_infra_devices_status ON infra_devices(status);
CREATE INDEX IF NOT EXISTS idx_infra_devices_type ON infra_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_infra_devices_rack ON infra_devices(rack_id);
CREATE INDEX IF NOT EXISTS idx_infra_devices_vlan ON infra_devices(vlan_id);

-- Devices audit trail
CREATE TABLE IF NOT EXISTS infra_devices_audit (
    audit_id        BIGSERIAL PRIMARY KEY,
    device_id       UUID NOT NULL,
    changed_by      UUID NOT NULL REFERENCES users(id),
    changed_at      TIMESTAMPTZ DEFAULT NOW(),
    change_type     VARCHAR(10) NOT NULL CHECK (change_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values      JSONB,
    new_values      JSONB
);

-- ============================================
-- 6. Device Links
-- ============================================
CREATE TABLE IF NOT EXISTS infra_device_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_device     UUID NOT NULL REFERENCES infra_devices(id),
    to_device       UUID NOT NULL REFERENCES infra_devices(id),
    from_port       VARCHAR(30),
    to_port         VARCHAR(30),
    link_type       VARCHAR(20) NOT NULL CHECK (link_type IN ('trunk', 'access', 'ha', 'vpc', 'storage', 'management')),
    speed           VARCHAR(10),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infra_device_links_from ON infra_device_links(from_device);
CREATE INDEX IF NOT EXISTS idx_infra_device_links_to ON infra_device_links(to_device);

-- ============================================
-- 7. PG NOTIFY trigger function
-- ============================================
CREATE OR REPLACE FUNCTION notify_infra_change() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'infra_changes',
        json_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'id', COALESCE(NEW.id, OLD.id),
            'timestamp', NOW()
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Triggers on all infra tables
-- ============================================
DROP TRIGGER IF EXISTS trg_infra_locations_notify ON infra_locations;
CREATE TRIGGER trg_infra_locations_notify
    AFTER INSERT OR UPDATE OR DELETE ON infra_locations
    FOR EACH ROW EXECUTE FUNCTION notify_infra_change();

DROP TRIGGER IF EXISTS trg_infra_devices_notify ON infra_devices;
CREATE TRIGGER trg_infra_devices_notify
    AFTER INSERT OR UPDATE OR DELETE ON infra_devices
    FOR EACH ROW EXECUTE FUNCTION notify_infra_change();

DROP TRIGGER IF EXISTS trg_infra_device_links_notify ON infra_device_links;
CREATE TRIGGER trg_infra_device_links_notify
    AFTER INSERT OR UPDATE OR DELETE ON infra_device_links
    FOR EACH ROW EXECUTE FUNCTION notify_infra_change();

DROP TRIGGER IF EXISTS trg_infra_wan_links_notify ON infra_wan_links;
CREATE TRIGGER trg_infra_wan_links_notify
    AFTER INSERT OR UPDATE OR DELETE ON infra_wan_links
    FOR EACH ROW EXECUTE FUNCTION notify_infra_change();

DROP TRIGGER IF EXISTS trg_infra_vlans_notify ON infra_vlans;
CREATE TRIGGER trg_infra_vlans_notify
    AFTER INSERT OR UPDATE OR DELETE ON infra_vlans
    FOR EACH ROW EXECUTE FUNCTION notify_infra_change();

DROP TRIGGER IF EXISTS trg_infra_racks_notify ON infra_racks;
CREATE TRIGGER trg_infra_racks_notify
    AFTER INSERT OR UPDATE OR DELETE ON infra_racks
    FOR EACH ROW EXECUTE FUNCTION notify_infra_change();

-- ============================================
-- 9. updated_at auto-update triggers
-- ============================================
CREATE OR REPLACE FUNCTION infra_update_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_infra_locations_updated ON infra_locations;
CREATE TRIGGER trg_infra_locations_updated
    BEFORE UPDATE ON infra_locations
    FOR EACH ROW EXECUTE FUNCTION infra_update_timestamp();

DROP TRIGGER IF EXISTS trg_infra_devices_updated ON infra_devices;
CREATE TRIGGER trg_infra_devices_updated
    BEFORE UPDATE ON infra_devices
    FOR EACH ROW EXECUTE FUNCTION infra_update_timestamp();

DROP TRIGGER IF EXISTS trg_infra_device_links_updated ON infra_device_links;
CREATE TRIGGER trg_infra_device_links_updated
    BEFORE UPDATE ON infra_device_links
    FOR EACH ROW EXECUTE FUNCTION infra_update_timestamp();

DROP TRIGGER IF EXISTS trg_infra_wan_links_updated ON infra_wan_links;
CREATE TRIGGER trg_infra_wan_links_updated
    BEFORE UPDATE ON infra_wan_links
    FOR EACH ROW EXECUTE FUNCTION infra_update_timestamp();

DROP TRIGGER IF EXISTS trg_infra_vlans_updated ON infra_vlans;
CREATE TRIGGER trg_infra_vlans_updated
    BEFORE UPDATE ON infra_vlans
    FOR EACH ROW EXECUTE FUNCTION infra_update_timestamp();

DROP TRIGGER IF EXISTS trg_infra_racks_updated ON infra_racks;
CREATE TRIGGER trg_infra_racks_updated
    BEFORE UPDATE ON infra_racks
    FOR EACH ROW EXECUTE FUNCTION infra_update_timestamp();
