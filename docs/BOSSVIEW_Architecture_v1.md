# SKYNEX — System Architecture

**Version:** 1.0
**Datum:** 2. April 2026
**Status:** Draft
**Klassifikation:** Vertraulich — ISO 27001

---

## 1. Architecture Overview

SKYNEX ist eine containerisierte Web-Applikation mit modularer Architektur, die über ein flexibles **Connector-Framework** Daten von zahlreichen externen Systemen aggregiert, verarbeitet und in einem einheitlichen Dashboard darstellt.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React SPA)                         │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│   │ Dashboard │ │  Assets  │ │ Incidents│ │ Changes  │ │Reports │  │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS / WSS
┌──────────────────────────────┼──────────────────────────────────────┐
│                         NGINX (Reverse Proxy + TLS)                 │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   SKYNEX API   │ │  Connector Engine │ │  Report Service  │
│   (Express.js)   │ │  (Node.js Worker) │ │  (Node.js)       │
│                  │ │                  │ │                  │
│ • REST API       │ │ • Scheduler      │ │ • PDF Generation │
│ • WebSocket      │ │ • Adapter Manager│ │ • DOCX Generation│
│ • Auth (JWT)     │ │ • Data Transform │ │ • Template Engine│
│ • RBAC           │ │ • Queue Consumer │ │ • Scheduled Jobs │
│ • Audit Logger   │ │ • Webhook Server │ │                  │
└────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      REDIS (Bull Queue + Cache)              │
│  • Job Queue (Sync-Jobs, Report-Jobs)                        │
│  • Session Store                                             │
│  • Dashboard Cache (KPI Snapshots)                           │
│  • Pub/Sub (Real-time WebSocket Events)                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────┐
│                     POSTGRESQL 16                             │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │  Assets   │ │ Incidents│ │ Changes  │ │  Audit Log     │  │
│  │  CMDB     │ │ & SLAs   │ │ & Approvals│ │  (Append-Only) │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Connectors│ │  Users   │ │  Reports │ │  Contracts     │  │
│  │  Config   │ │ & Roles  │ │ & Schedules│ │  & SLAs       │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Docker Services (docker-compose.yml)

### 6 Services — Modularer Stack

| Service | Image/Build | Port | Beschreibung |
|---------|------------|------|-------------|
| **nginx** | nginx:alpine | 443, 80 | Reverse Proxy, TLS Termination, Static Files, Rate Limiting |
| **frontend** | node:20-alpine (build) | 3000 (intern) | React SPA, served via Nginx in Production |
| **api** | node:20-alpine (build) | 4000 (intern) | Express.js REST API + WebSocket Server |
| **connector-engine** | node:20-alpine (build) | — (worker) | Hintergrund-Service für API-Synchronisierung |
| **redis** | redis:7-alpine | 6379 (intern) | Queue, Cache, Pub/Sub, Session Store |
| **postgres** | postgres:16-alpine | 5432 (intern) | Primäre Datenbank mit Audit-Trail |

### Optionale Services (Phase 2+)

| Service | Beschreibung |
|---------|-------------|
| **report-service** | Dedizierter PDF/DOCX Report Generator (kann auch im API-Service laufen) |
| **n8n** | Self-hosted n8n für komplexe Workflow-Automationen |
| **pgadmin** | Datenbank-Administration (nur Development) |

### Netzwerk-Architektur

```
┌─────────────────────────────────────────────────────┐
│                  skynex-network                     │
│                  (bridge, internal)                   │
│                                                      │
│  nginx ──── frontend                                 │
│    │                                                 │
│    ├──── api ──── redis                              │
│    │       │                                         │
│    │       └──── postgres                            │
│    │                                                 │
│    └──── connector-engine ──── redis                 │
│                   │                                  │
│                   └──── postgres                     │
└─────────────────────────────────────────────────────┘
          │
          │ Port 443 (einziger exponierter Port)
          ▼
      [Internet / Intranet]
```

---

## 3. Connector Framework — Das Herzstück

Das Connector-Framework ermöglicht es, beliebig viele externe Systeme anzubinden, ohne den Kern-Code zu verändern. Jeder Connector ist ein eigenständiges Modul mit standardisierter Schnittstelle.

### Connector-Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    CONNECTOR ENGINE                          │
│                                                             │
│  ┌─────────────┐    ┌──────────────────────────────────┐    │
│  │  Scheduler   │───▶│       Adapter Manager             │    │
│  │  (cron-based)│    │                                  │    │
│  └─────────────┘    │  ┌──────────┐  ┌──────────────┐  │    │
│                      │  │ Registry │  │ Data Transform│  │    │
│  ┌─────────────┐    │  │ (loaded  │  │ Pipeline     │  │    │
│  │ Webhook      │───▶│  │  at boot)│  │              │  │    │
│  │ Receiver     │    │  └──────────┘  └──────────────┘  │    │
│  └─────────────┘    └──────────────────────────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  ADAPTER PLUGINS                       │   │
│  │                                                       │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐  │   │
│  │  │  Jira   │ │ Confluence│ │   PRTG   │ │  ESXi   │  │   │
│  │  │ Adapter │ │  Adapter  │ │  Adapter │ │ Adapter │  │   │
│  │  └─────────┘ └──────────┘ └──────────┘ └─────────┘  │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐  │   │
│  │  │  n8n    │ │  Qualys  │ │  Zabbix  │ │  SCCM   │  │   │
│  │  │ Adapter │ │  Adapter  │ │  Adapter │ │ Adapter │  │   │
│  │  └─────────┘ └──────────┘ └──────────┘ └─────────┘  │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐  │   │
│  │  │ CSV/JSON│ │  Excel   │ │  REST    │ │ Custom  │  │   │
│  │  │ Import  │ │  Import  │ │  Generic │ │ Webhook │  │   │
│  │  └─────────┘ └──────────┘ └──────────┘ └─────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Adapter Interface (TypeScript)

Jeder Connector implementiert dieses Interface:

```typescript
interface ConnectorAdapter {
  // Metadata
  readonly id: string;                    // z.B. "jira", "prtg", "esxi"
  readonly name: string;                  // z.B. "Jira Service Management"
  readonly version: string;
  readonly category: ConnectorCategory;   // 'itsm' | 'monitoring' | 'cmdb' | 'security' | 'import'

  // Configuration
  getConfigSchema(): ConnectorConfigSchema;   // JSON Schema für UI-Konfigurationsformular
  validateConfig(config: object): Promise<ValidationResult>;
  testConnection(config: object): Promise<ConnectionTestResult>;

  // Data Operations
  sync(context: SyncContext): Promise<SyncResult>;       // Polling-basierte Synchronisation
  handleWebhook?(payload: object): Promise<SyncResult>;  // Webhook-basierte Synchronisation

  // Lifecycle
  onEnable?(config: object): Promise<void>;
  onDisable?(): Promise<void>;
}

interface SyncContext {
  config: object;              // Connector-spezifische Konfiguration
  lastSync: Date | null;       // Zeitpunkt der letzten Synchronisation
  entityTypes: EntityType[];   // Welche Entitäten synchronisiert werden sollen
  logger: Logger;
}

interface SyncResult {
  entities: NormalizedEntity[];  // Transformierte Daten im SKYNEX-Format
  metadata: {
    totalFetched: number;
    created: number;
    updated: number;
    errors: SyncError[];
    nextSyncHint?: Date;
  };
}

type EntityType = 'asset' | 'incident' | 'change' | 'vulnerability' | 'metric' | 'user';

// Alle externen Daten werden in dieses Format normalisiert
interface NormalizedEntity {
  externalId: string;
  entityType: EntityType;
  source: string;              // Connector-ID
  data: Record<string, any>;   // Normalisierte Felder
  rawData?: object;            // Optionale Rohdaten für Audit
  timestamp: Date;
}
```

### Geplante Connectors (Priorität)

| Priorität | Connector | Kategorie | Datenfluss | Entitäten |
|-----------|-----------|-----------|-----------|-----------|
| **P0** | CSV/JSON/Excel Import | import | Manuell | Assets, Incidents, alles |
| **P0** | Jira | itsm | Polling + Webhook | Incidents, Changes |
| **P0** | PRTG | monitoring | Polling + API | Assets, Metriken, Alerts |
| **P1** | Confluence | knowledge | Polling | Dokumentation, Runbooks |
| **P1** | ESXi/vCenter | cmdb | Polling | VMs, Hosts, Datastores |
| **P1** | Qualys | security | Polling | Vulnerabilities |
| **P1** | n8n | workflow | Webhook | Beliebige Daten via n8n Workflows |
| **P2** | Zabbix | monitoring | Polling + API | Assets, Metriken |
| **P2** | SCCM/Intune | cmdb | Polling | Workstations, Software |
| **P2** | Quest KACE | cmdb | Polling | Assets, Software |
| **P2** | JAMF | cmdb | Polling | Apple Devices |
| **P2** | Generic REST | any | Polling | Konfigurierbar |

### Connector-Konfiguration (UI-gesteuert)

Connectors werden über die Web-UI konfiguriert. Die Konfiguration wird verschlüsselt in der Datenbank gespeichert:

```typescript
// Beispiel: Jira Connector Konfiguration
{
  connectorId: "jira",
  enabled: true,
  config: {
    baseUrl: "https://yourcompany.atlassian.net",
    auth: {
      type: "api_token",        // oder "oauth2", "basic"
      email: "bot@company.com",
      token: "encrypted:..."     // AES-256 verschlüsselt
    },
    projects: ["INFRA", "OPS"],  // Welche Projekte synchronisiert werden
    issueTypes: ["Incident", "Change Request"],
    fieldMapping: {              // Mapping Jira-Felder → SKYNEX-Felder
      "customfield_10001": "affected_asset",
      "customfield_10042": "sla_target"
    }
  },
  schedule: {
    type: "interval",
    intervalMinutes: 5
  },
  webhookEnabled: true,
  webhookSecret: "encrypted:..."
}
```

---

## 4. API-Design

### Authentifizierung & Autorisierung

```
Client Request
     │
     ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   JWT Token  │────▶│  RBAC Check  │────▶│  Rate Limiter │
│  Validation  │     │  (Casbin)    │     │  (per user)   │
└─────────────┘     └──────────────┘     └──────────────┘
                           │
                    ┌──────┴──────┐
                    │ Audit Logger│
                    │ (middleware)│
                    └─────────────┘
```

### API-Struktur

```
/api/v1/
├── /auth
│   ├── POST   /login              # JWT Login
│   ├── POST   /logout             # Session invalidieren
│   ├── POST   /refresh            # Token Refresh
│   └── GET    /me                 # Aktueller User + Rollen
│
├── /assets
│   ├── GET    /                   # Liste (paginiert, filterbar)
│   ├── GET    /:id                # Detail mit Relationen
│   ├── POST   /                   # Erstellen
│   ├── PUT    /:id                # Aktualisieren
│   ├── DELETE /:id                # Soft-Delete
│   ├── GET    /:id/history        # Änderungsverlauf
│   ├── GET    /:id/incidents      # Verknüpfte Incidents
│   ├── GET    /:id/relations      # Asset-Abhängigkeiten
│   └── POST   /import             # Bulk-Import (CSV/JSON/Excel)
│
├── /incidents
│   ├── GET    /                   # Liste mit ITSM-Sync-Status
│   ├── GET    /:id                # Detail
│   ├── GET    /stats              # KPIs (MTTR, Offene, SLA)
│   └── GET    /timeline           # Timeline-Ansicht
│
├── /changes
│   ├── GET    /                   # Liste
│   ├── POST   /                   # Neuen Change erfassen
│   ├── PUT    /:id                # Bearbeiten
│   ├── POST   /:id/approve        # Genehmigung erteilen
│   ├── POST   /:id/reject         # Ablehnung
│   ├── GET    /calendar           # Kalender-Ansicht
│   └── GET    /:id/history        # Audit-Trail
│
├── /network
│   ├── GET    /topology           # Netzwerk-Graph (Nodes + Edges)
│   ├── GET    /devices            # Netzwerkgeräte
│   └── GET    /vlans              # VLAN-Übersicht
│
├── /dashboard
│   ├── GET    /kpis               # Aggregierte KPIs
│   ├── GET    /widgets/:id        # Widget-Daten
│   └── WS     /live               # WebSocket für Echtzeit-Updates
│
├── /reports
│   ├── GET    /templates          # Verfügbare Report-Templates
│   ├── POST   /generate           # Report generieren
│   ├── GET    /:id/download       # Report herunterladen
│   └── GET    /scheduled          # Geplante Reports
│
├── /connectors
│   ├── GET    /available          # Verfügbare Connector-Typen
│   ├── GET    /configured         # Konfigurierte Connectors
│   ├── POST   /                   # Connector konfigurieren
│   ├── PUT    /:id                # Konfiguration ändern
│   ├── POST   /:id/test           # Verbindung testen
│   ├── POST   /:id/sync           # Manuelle Synchronisierung
│   ├── GET    /:id/logs           # Sync-Logs
│   └── POST   /webhook/:id        # Webhook-Empfang
│
├── /import
│   ├── POST   /upload             # Datei-Upload (CSV/JSON/XLSX)
│   ├── POST   /preview            # Vorschau & Mapping
│   ├── POST   /execute            # Import ausführen
│   └── GET    /history            # Import-Historie
│
├── /audit
│   ├── GET    /logs               # Audit-Log (paginiert)
│   ├── GET    /export             # Export für Audits
│   └── GET    /compliance         # ISO 27001 Control-Status
│
└── /admin
    ├── GET    /users              # Benutzerverwaltung
    ├── POST   /users              # Benutzer anlegen
    ├── PUT    /users/:id/roles    # Rollen zuweisen
    └── GET    /system/health      # System Health Check
```

---

## 5. Datenbank-Schema (Kern)

### Entity-Relationship Diagramm

```
┌──────────────────┐          ┌──────────────────┐
│      users        │          │      roles        │
│──────────────────│          │──────────────────│
│ id (uuid) PK     │          │ id (uuid) PK     │
│ username          │    ┌────▶│ name              │
│ email             │    │    │ permissions (json)│
│ password_hash     │    │    └──────────────────┘
│ role_id FK ───────│────┘
│ ldap_dn           │          ┌──────────────────┐
│ mfa_enabled       │          │  connector_configs │
│ last_login        │          │──────────────────│
│ is_active         │          │ id (uuid) PK     │
└──────────────────┘          │ connector_type    │
                               │ name              │
┌──────────────────┐          │ config (encrypted)│
│      assets       │          │ schedule (json)   │
│──────────────────│          │ enabled            │
│ id (uuid) PK     │          │ last_sync_at       │
│ external_id       │          │ last_sync_status   │
│ source            │──────────│ webhook_secret     │
│ name              │          └──────────────────┘
│ type (enum)       │
│ category          │          ┌──────────────────┐
│ status (enum)     │          │  asset_relations   │
│ lifecycle_stage   │◀────────▶│──────────────────│
│ criticality       │          │ source_id FK      │
│ location          │          │ target_id FK      │
│ ip_address        │          │ relation_type     │
│ os                │          │ (enum: depends_on,│
│ hardware_info     │          │  runs_on,          │
│ tags (jsonb)      │          │  connected_to,     │
│ custom_fields     │          │  backup_of)        │
│ created_by FK     │          └──────────────────┘
│ created_at        │
│ updated_at        │          ┌──────────────────┐
└──────────────────┘          │    incidents       │
         │                    │──────────────────│
         │                    │ id (uuid) PK     │
         │  ┌────────────────▶│ external_id       │
         │  │                 │ source            │
         │  │                 │ title             │
         │  │                 │ description       │
         │  │                 │ priority (enum)   │
┌────────┴──┴───────┐        │ status (enum)     │
│ asset_incidents    │        │ category          │
│──────────────────│        │ assigned_to        │
│ asset_id FK       │        │ sla_target         │
│ incident_id FK    │        │ opened_at          │
└──────────────────┘        │ resolved_at        │
                              │ mttr_minutes       │
┌──────────────────┐          └──────────────────┘
│     changes       │
│──────────────────│          ┌──────────────────┐
│ id (uuid) PK     │          │   audit_logs       │
│ external_id       │          │──────────────────│
│ title             │          │ id (bigserial) PK │
│ description       │          │ timestamp          │
│ risk_level (enum) │          │ user_id FK        │
│ status (enum)     │          │ action (enum)     │
│ requested_by FK   │          │ entity_type       │
│ approved_by FK    │          │ entity_id         │
│ scheduled_start   │          │ old_value (jsonb) │
│ scheduled_end     │          │ new_value (jsonb) │
│ actual_start      │          │ ip_address        │
│ actual_end        │          │ user_agent        │
│ rollback_plan     │          │ session_id        │
│ success (bool)    │          └──────────────────┘
│ post_review       │          ▲ APPEND-ONLY
└──────────────────┘          │ (keine UPDATE/DELETE Rechte)
                              │ Trigger-basiert
┌──────────────────┐
│  vulnerabilities  │
│──────────────────│
│ id (uuid) PK     │
│ external_id       │
│ source            │
│ title             │
│ severity (enum)   │
│ affected_hosts    │
│ category          │
│ status            │
│ first_seen        │
│ last_seen         │
│ remediation       │
└──────────────────┘
```

### Audit-Trail (ISO 27001 A.12.4)

```sql
-- Unveränderliche Audit-Tabelle
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE, LOGIN, EXPORT, etc.
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id UUID
);

-- Nur INSERT erlaubt (kein UPDATE/DELETE)
REVOKE UPDATE, DELETE ON audit_logs FROM skynex_app;

-- Automatischer Trigger für alle relevanten Tabellen
CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS trigger AS $$
BEGIN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
    VALUES (
        current_setting('app.current_user_id', true)::uuid,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
        current_setting('app.current_ip', true)::inet
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Frontend Architecture

### Design System — "SKYNEX Dark Ops"

Basierend auf den Referenz-Dashboards (PROTrack & Qualys):

```typescript
// theme/tokens.ts
export const theme = {
  colors: {
    bg:       '#060b14',     // Primärer Hintergrund
    bg2:      '#0c1220',     // Sekundärer Hintergrund
    card:     '#111a2b',     // Card Background
    border:   '#1a2540',     // Standard Border

    text: {
      primary:   '#e8edf5',  // Haupttext
      secondary: '#94a3b8',  // Sekundärtext
      muted:     '#5a6a82',  // Gedimmter Text
    },

    accent: {
      cyan:     '#38bdf8',   // Primär-Akzent (Assets, KPIs)
      blue:     '#3b82f6',   // Sekundär (Links, Aktionen)
      indigo:   '#6366f1',   // Tertiär (Charts)
      violet:   '#8b5cf6',   // Quaternär (Charts)
    },

    status: {
      success:  '#10b981',   // Online, OK, Resolved
      warning:  '#f59e0b',   // Warning, Degraded
      danger:   '#f43f5e',   // Critical, Offline
      critical: '#dc2626',   // Severity Critical
      high:     '#f97316',   // Severity High
    },

    glow: {
      cyan:   '0 0 24px rgba(56,189,248,.12)',
      danger: '0 0 24px rgba(220,38,38,.15)',
    }
  },

  fonts: {
    body: "'DM Sans', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },

  spacing: {
    card: '20px',
    gap:  '16px',
    section: '28px',
  },

  radius: {
    card: '14px',
    badge: '16px',
    input: '7px',
  }
} as const;
```

### Component Library

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          # Sidebar + Header + Content
│   │   ├── Sidebar.tsx           # Navigation
│   │   ├── Header.tsx            # Breadcrumb, User, Notifications
│   │   └── Grid.tsx              # 12-Column Grid System
│   │
│   ├── dashboard/
│   │   ├── KPICard.tsx           # Animierte KPI-Karten (wie Referenz)
│   │   ├── ChartCard.tsx         # Card-Wrapper für Charts
│   │   ├── StatusBar.tsx         # Horizontale Fortschrittsbalken
│   │   ├── DataTable.tsx         # Sortierbare, filterbare Tabelle
│   │   ├── TopologyMap.tsx       # D3.js Netzwerk-Visualisierung
│   │   └── WorldMap.tsx          # Standort-Übersicht
│   │
│   ├── charts/
│   │   ├── DoughnutChart.tsx     # Severity-Verteilung
│   │   ├── BarChart.tsx          # Kategorien, Vergleiche
│   │   ├── LineChart.tsx         # Trends über Zeit
│   │   ├── StackedBar.tsx        # Gerätevergleiche
│   │   └── HeatMap.tsx           # Zeitbasierte Aktivität
│   │
│   ├── shared/
│   │   ├── Badge.tsx             # Status-Badges
│   │   ├── Tag.tsx               # Severity-Tags (CRIT, HIGH)
│   │   ├── FilterBar.tsx         # Such- und Filterleiste
│   │   ├── AnimatedCounter.tsx   # KPI-Counter Animation
│   │   ├── SectionHeader.tsx     # "────── SECTION NAME ──────"
│   │   └── LiveIndicator.tsx     # Pulsierender Status-Punkt
│   │
│   └── connectors/
│       ├── ConnectorGrid.tsx     # Übersicht aller Connectors
│       ├── ConnectorConfig.tsx   # Konfigurations-Formular
│       ├── SyncStatus.tsx        # Synchronisations-Status
│       └── ImportWizard.tsx      # Schritt-für-Schritt Import
│
├── pages/
│   ├── DashboardPage.tsx         # Haupt-Dashboard (KPIs + Overview)
│   ├── AssetsPage.tsx            # Asset-Inventar + CMDB
│   ├── AssetDetailPage.tsx       # Asset-Detail mit Relationen
│   ├── IncidentsPage.tsx         # Incident-Übersicht
│   ├── ChangesPage.tsx           # Change-Management
│   ├── NetworkPage.tsx           # Netzwerk-Topologie
│   ├── VulnerabilitiesPage.tsx   # Vulnerability Dashboard (wie Qualys Ref)
│   ├── ReportsPage.tsx           # Report-Generierung
│   ├── ConnectorsPage.tsx        # Connector-Verwaltung
│   ├── AuditPage.tsx             # Audit-Log Viewer
│   └── SettingsPage.tsx          # System-Einstellungen
│
├── hooks/
│   ├── useWebSocket.ts           # Real-time Updates
│   ├── useKPIs.ts                # KPI-Daten mit Auto-Refresh
│   ├── useConnectors.ts          # Connector-Status
│   └── useAudit.ts               # Audit-Trail Abfragen
│
├── services/
│   ├── api.ts                    # Axios-basierter API Client
│   ├── auth.ts                   # JWT Token Management
│   └── websocket.ts              # WebSocket Client
│
└── theme/
    ├── tokens.ts                 # Design Tokens (siehe oben)
    ├── globalStyles.ts           # Globale CSS
    └── chartTheme.ts             # Chart.js Theme-Konfiguration
```

---

## 7. Datenfluss

### Connector Sync (Polling)

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐     ┌──────────┐
│ Scheduler │────▶│ Bull Queue     │────▶│ Adapter.sync()│────▶│ External │
│ (cron)   │     │ (Redis)        │     │              │     │ API      │
└──────────┘     └───────────────┘     └──────┬───────┘     └──────────┘
                                              │
                                              ▼
                                     ┌──────────────┐
                                     │ Data Transform │
                                     │ Pipeline       │
                                     └──────┬───────┘
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                     ▼                     ▼
                 ┌──────────┐         ┌──────────┐         ┌──────────┐
                 │ PostgreSQL│         │  Redis    │         │ WebSocket│
                 │ (persist) │         │ (cache)   │         │ (notify) │
                 └──────────┘         └──────────┘         └──────────┘
```

### Import Flow

```
Browser Upload ──▶ API /import/upload ──▶ Parse File (CSV/JSON/XLSX)
                                              │
                                              ▼
                                     Preview & Mapping UI
                                     (User wählt Spalten-Zuordnung)
                                              │
                                              ▼
                                     API /import/execute
                                              │
                                              ▼
                                     Validation ──▶ Transform ──▶ Insert
                                              │
                                              ▼
                                     Import-Log (Erfolg/Fehler pro Zeile)
```

---

## 8. Sicherheitsarchitektur (ISO 27001 + Luftfahrt)

| Control | Implementierung |
|---------|----------------|
| **A.5.15** Access Control | RBAC via Casbin; Rollen: Admin, Engineer, Manager, Auditor, ReadOnly |
| **A.8.1** Asset Management | CMDB als Kern-Modul; alle Assets klassifiziert und inventarisiert |
| **A.8.9** Encryption in Transit | TLS 1.3 via Nginx; HSTS Header; Certificate Pinning |
| **A.8.24** Encryption at Rest | PostgreSQL Transparent Data Encryption; Connector-Secrets AES-256 |
| **A.8.15** Logging | Audit-Trail auf allen Entitäten; Append-Only; 3 Jahre Aufbewahrung |
| **A.8.16** Monitoring | Health Checks, Error Tracking, Performance Metriken |
| **A.5.23** Vulnerability Mgmt | Qualys-Integration; automatisierte Dependency-Scans (Trivy) |
| **A.5.26** Incident Response | Incident-Modul mit SLA-Tracking und Eskalationsregeln |
| **A.8.32** Change Management | Change-Modul mit Genehmigungsworkflow und Risikobewertung |
| **A.7.1** Session Management | JWT mit kurzer Laufzeit (15min), Refresh Token (7d), MFA-Pflicht |

### Container Security

```yaml
# Alle Container laufen als non-root
security_opt:
  - no-new-privileges:true
user: "1000:1000"
read_only: true          # Read-only Filesystem wo möglich
cap_drop:
  - ALL                  # Alle Linux Capabilities entfernen
```

---

## 9. Deployment

### Development (docker-compose.dev.yml)

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```
- Hot-Reload für Frontend und Backend
- pgAdmin auf Port 5050
- Redis Commander auf Port 8081
- Keine TLS (localhost)

### Production (docker-compose.prod.yml)

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
- Multi-Stage Builds (minimale Images)
- TLS via Let's Encrypt oder internes CA
- Automatische PostgreSQL-Backups (pg_dump, verschlüsselt)
- Health Checks auf allen Services
- Restart-Policy: unless-stopped
- Logging: JSON-Format → Aggregation (optional ELK/Loki)

### Verzeichnisstruktur

```
skynex/
├── docker-compose.yml              # Basis-Stack
├── docker-compose.dev.yml          # Development Overrides
├── docker-compose.prod.yml         # Production Overrides
├── .env.example                    # Umgebungsvariablen Template
│
├── frontend/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/                        # React App (siehe Abschnitt 6)
│
├── backend/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts               # Express App Entry
│       ├── config/                  # Environment Config
│       ├── middleware/              # Auth, RBAC, Audit, RateLimit
│       ├── routes/                  # API Route Handler
│       ├── services/               # Business Logic
│       ├── models/                  # Database Models (Knex/Prisma)
│       ├── connectors/             # Connector Framework
│       │   ├── engine.ts           # Connector Engine
│       │   ├── adapter.interface.ts # Adapter Interface
│       │   ├── registry.ts         # Adapter Registry
│       │   └── adapters/           # Individuelle Adapter
│       │       ├── jira.adapter.ts
│       │       ├── prtg.adapter.ts
│       │       ├── esxi.adapter.ts
│       │       ├── qualys.adapter.ts
│       │       ├── csv-import.adapter.ts
│       │       └── generic-rest.adapter.ts
│       ├── jobs/                    # Bull Queue Job Processors
│       └── utils/                   # Helpers, Crypto, Logger
│
├── nginx/
│   ├── nginx.conf
│   ├── ssl/                        # TLS Certificates
│   └── conf.d/
│
├── database/
│   ├── migrations/                 # SQL Migrations
│   ├── seeds/                      # Seed Data (Demo)
│   └── backup/                     # Backup Scripts
│
└── docs/
    ├── SKYNEX_PRD_v1.md
    └── SKYNEX_Architecture_v1.md
```

---

*Dieses Dokument wird zusammen mit dem PRD iterativ weiterentwickelt.*
