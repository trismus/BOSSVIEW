-- 006_vuln_source_external_id_unique.sql
-- Add unique constraint on (source, external_id) for vulnerability upserts.
-- Required by the connector engine to perform ON CONFLICT upserts for
-- vulnerability entities (same pattern as the assets table).

CREATE UNIQUE INDEX IF NOT EXISTS idx_vulns_source_external_id
  ON vulnerabilities(source, external_id)
  WHERE external_id IS NOT NULL;
