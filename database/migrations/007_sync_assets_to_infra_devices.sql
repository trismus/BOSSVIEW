-- ============================================
-- SKYNEX — Sync Assets to Infrastructure Devices
-- Issue #62: Auto-assign assets to topology maps
-- ============================================
-- Idempotent: safe to run multiple times.
-- Does NOT overwrite existing seed devices.
-- ============================================

BEGIN;

-- ============================================
-- Step 1: Link existing seed devices to assets by name match
-- ============================================
UPDATE infra_devices d
SET asset_id = a.id
FROM assets a
WHERE LOWER(d.name) = LOWER(a.name)
  AND d.asset_id IS NULL;

-- ============================================
-- Step 2: Insert new infra_devices from assets
-- Only for: virtual_server, physical_server, network_device, storage
-- Skip assets that already have a matching infra_device (by name)
-- ============================================
WITH asset_candidates AS (
  SELECT
    a.id AS asset_id,
    a.name,
    a.ip_address,
    a.status AS asset_status,
    a.type AS asset_type,
    a.location->>'code' AS loc_code,
    -- Determine target device_type
    CASE
      WHEN a.type IN ('virtual_server', 'physical_server') THEN 'server'
      WHEN a.type = 'storage' THEN 'storage'
      WHEN a.type = 'network_device' THEN
        CASE
          WHEN LOWER(a.name) LIKE '%fw%' THEN 'firewall'
          WHEN LOWER(a.name) LIKE '%sw%' THEN 'switch'
          WHEN LOWER(a.name) ~ 'w[0-9]' THEN 'switch'
          ELSE 'router'
        END
    END AS device_type,
    -- Map status
    CASE
      WHEN a.status = 'active' THEN 'operational'
      WHEN a.status = 'maintenance' THEN 'maintenance'
      ELSE 'offline'
    END AS device_status
  FROM assets a
  WHERE a.type IN ('virtual_server', 'physical_server', 'network_device', 'storage')
    AND NOT EXISTS (
      SELECT 1 FROM infra_devices d
      WHERE LOWER(d.name) = LOWER(a.name)
    )
),
positioned AS (
  SELECT
    ac.*,
    ROW_NUMBER() OVER (
      PARTITION BY ac.loc_code, ac.device_type
      ORDER BY ac.name
    ) AS pos
  FROM asset_candidates ac
)
INSERT INTO infra_devices (
  location_id,
  name,
  device_type,
  ip_address,
  status,
  asset_id,
  topo_x,
  topo_y
)
SELECT
  loc.id,
  p.name,
  p.device_type,
  p.ip_address,
  p.device_status,
  p.asset_id,
  -- topo_x: base 100, spacing depends on device_type
  CASE p.device_type
    WHEN 'firewall' THEN 100 + (p.pos - 1) * 100
    WHEN 'switch'   THEN 100 + (p.pos - 1) * 80
    WHEN 'server'   THEN 100 + (p.pos - 1) * 80
    WHEN 'storage'  THEN 100 + (p.pos - 1) * 100
    WHEN 'router'   THEN 100 + (p.pos - 1) * 100
    ELSE 100 + (p.pos - 1) * 80
  END,
  -- topo_y: fixed row per device_type
  CASE p.device_type
    WHEN 'firewall' THEN 60
    WHEN 'switch'   THEN 180
    WHEN 'router'   THEN 180
    WHEN 'server'   THEN 350
    WHEN 'storage'  THEN 480
    ELSE 350
  END
FROM positioned p
JOIN infra_locations loc ON loc.code = p.loc_code;

COMMIT;
