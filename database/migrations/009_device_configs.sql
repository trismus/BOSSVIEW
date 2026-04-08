-- Device configuration storage
CREATE TABLE IF NOT EXISTS infra_device_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES infra_devices(id) ON DELETE CASCADE,
  config_type VARCHAR(30) NOT NULL DEFAULT 'running-config',
  config_raw TEXT NOT NULL,
  config_parsed JSONB DEFAULT '{}',
  file_name VARCHAR(255),
  file_size INTEGER,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (config_type IN ('running-config', 'startup-config', 'show-version', 'show-interfaces'))
);

CREATE INDEX IF NOT EXISTS idx_device_configs_device ON infra_device_configs(device_id);
CREATE INDEX IF NOT EXISTS idx_device_configs_created ON infra_device_configs(created_at DESC);

-- Add config_data to infra_devices for current parsed config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infra_devices' AND column_name = 'config_data'
  ) THEN
    ALTER TABLE infra_devices ADD COLUMN config_data JSONB DEFAULT '{}';
  END IF;
END $$;
