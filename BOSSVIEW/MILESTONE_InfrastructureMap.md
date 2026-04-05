# Milestone: Virtual Infrastructure Map

**Projekt:** BOSSVIEW
**Modul:** Infrastructure Map
**Status:** Ready for Implementation
**Erstellt:** 2026-04-05
**Prototyp:** `InfrastructureMap.jsx` (statische Demo vorhanden)
**Zugewiesen an:** Martin
**Reviewer:** Christian

---

## 1. Zielsetzung

Interaktive Infrastruktur-Karte mit drei Ebenen:

1. **Weltkarte** — Alle LSYFN-Standorte global mit Live-Status, animierten Verbindungslinien und Asset-KPIs
2. **Netzwerk-Topologie** — Detailansicht pro Standort (Stelzenstrasse + Datacenter BAS) mit VLANs, physischen Geräten und animierten Datenflüssen
3. **Rack-View** — Physische Rack-Ansicht mit U-Positionen, Geräte-Status und Kapazitätsindikatoren

Design: **Elegant Dark / Sci-Fi "Dark Trace"** — Cyan-Glow-Akzente, subtile Pulse-Animationen, Scanline-Overlay, professionell genug für Management-Demos.

Alle Daten kommen **live aus der PostgreSQL-Datenbank** und werden per **WebSocket in Echtzeit aktualisiert**.

---

## 2. Datenbank-Schema

### 2.1 Standorte

```sql
CREATE TABLE infra_locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(10) UNIQUE NOT NULL,  -- z.B. 'ZRH', 'FRA'
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

-- Audit-Trail (Append-Only, ISO 27001)
CREATE TABLE infra_locations_audit (
    audit_id        BIGSERIAL PRIMARY KEY,
    location_id     UUID NOT NULL REFERENCES infra_locations(id),
    changed_by      UUID NOT NULL REFERENCES users(id),
    changed_at      TIMESTAMPTZ DEFAULT NOW(),
    change_type     VARCHAR(10) NOT NULL CHECK (change_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values      JSONB,
    new_values      JSONB
);
```

### 2.2 Standort-Verbindungen (WAN-Links)

```sql
CREATE TABLE infra_wan_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_location   UUID NOT NULL REFERENCES infra_locations(id),
    to_location     UUID NOT NULL REFERENCES infra_locations(id),
    link_type       VARCHAR(20) NOT NULL CHECK (link_type IN ('primary', 'secondary', 'backup')),
    bandwidth       VARCHAR(20),         -- z.B. '10 Gbps'
    provider        VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    latency_ms      INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 VLANs

```sql
CREATE TABLE infra_vlans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES infra_locations(id),
    vlan_id         INTEGER NOT NULL,     -- VLAN-Nummer (10, 20, 30...)
    name            VARCHAR(100) NOT NULL,
    cidr            VARCHAR(18) NOT NULL,  -- z.B. '10.1.10.0/24'
    purpose         VARCHAR(200),
    color_hex       VARCHAR(7),            -- Für UI-Darstellung
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(location_id, vlan_id)
);
```

### 2.4 Netzwerk-Geräte

```sql
CREATE TABLE infra_devices (
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
    -- Position auf der Topologie-Karte (vom User per Drag&Drop setzbar)
    topo_x          DECIMAL(6,1),
    topo_y          DECIMAL(6,1),
    -- Rack-Position
    rack_id         UUID REFERENCES infra_racks(id),
    rack_u_start    INTEGER,              -- Erste U-Position im Rack
    rack_u_height   INTEGER DEFAULT 1,    -- Höhe in Rack-Units
    -- CMDB-Link
    asset_id        UUID REFERENCES assets(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_infra_devices_location ON infra_devices(location_id);
CREATE INDEX idx_infra_devices_status ON infra_devices(status);

-- Audit-Trail
CREATE TABLE infra_devices_audit (
    audit_id        BIGSERIAL PRIMARY KEY,
    device_id       UUID NOT NULL,
    changed_by      UUID NOT NULL REFERENCES users(id),
    changed_at      TIMESTAMPTZ DEFAULT NOW(),
    change_type     VARCHAR(10) NOT NULL,
    old_values      JSONB,
    new_values      JSONB
);
```

### 2.5 Geräte-Verbindungen (Links)

```sql
CREATE TABLE infra_device_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_device     UUID NOT NULL REFERENCES infra_devices(id),
    to_device       UUID NOT NULL REFERENCES infra_devices(id),
    from_port       VARCHAR(30),          -- z.B. 'Gi0/1', 'Eth1/48'
    to_port         VARCHAR(30),
    link_type       VARCHAR(20) NOT NULL CHECK (link_type IN ('trunk', 'access', 'ha', 'vpc', 'storage', 'management')),
    speed           VARCHAR(10),          -- z.B. '10G', '25G', '100G'
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.6 Racks

```sql
CREATE TABLE infra_racks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES infra_locations(id),
    name            VARCHAR(50) NOT NULL,
    total_units     INTEGER NOT NULL DEFAULT 42,
    row_label       VARCHAR(10),
    position        INTEGER,
    -- Floorplan-Position (für zukünftige Floorplan-View)
    floor_x         DECIMAL(6,1),
    floor_y         DECIMAL(6,1),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. API-Endpoints

Alle Endpoints unter `/api/v1/infrastructure/`. Authentifizierung via JWT. RBAC-Rollen: `infra-viewer`, `infra-editor`, `infra-admin`.

### 3.1 REST Endpoints

| Method | Endpoint | Beschreibung | Rolle |
|--------|----------|-------------|-------|
| GET | `/locations` | Alle Standorte mit Asset-Counts | viewer |
| GET | `/locations/:id` | Standort-Detail | viewer |
| PUT | `/locations/:id` | Standort aktualisieren | editor |
| GET | `/locations/:id/topology` | Komplette Topologie eines Standorts (Devices + Links + VLANs) | viewer |
| GET | `/wan-links` | Alle WAN-Verbindungen | viewer |
| GET | `/devices` | Geräte-Liste (Filter: location, type, status, vlan) | viewer |
| GET | `/devices/:id` | Gerät-Detail inkl. Verbindungen | viewer |
| PUT | `/devices/:id` | Gerät aktualisieren | editor |
| PATCH | `/devices/:id/position` | Topologie-Position per Drag&Drop setzen | editor |
| GET | `/vlans?location_id=` | VLANs eines Standorts | viewer |
| GET | `/racks?location_id=` | Racks eines Standorts mit Geräte-Belegung | viewer |
| GET | `/health-summary` | Globaler Status-Überblick (Counts pro Status) | viewer |

### 3.2 Response-Beispiel: `GET /locations/:id/topology`

```json
{
  "location": {
    "id": "uuid",
    "code": "ZRH",
    "name": "Zürich HQ",
    "status": "operational"
  },
  "vlans": [
    { "id": "uuid", "vlan_id": 10, "name": "Management", "cidr": "10.1.10.0/24", "color_hex": "#06b6d4" }
  ],
  "devices": [
    {
      "id": "uuid",
      "name": "FW-STZ-01",
      "device_type": "firewall",
      "ip_address": "10.1.10.1",
      "model": "Palo Alto PA-850",
      "status": "operational",
      "vlan_id": null,
      "topo_x": 400,
      "topo_y": 60
    }
  ],
  "links": [
    {
      "id": "uuid",
      "from_device": "uuid",
      "to_device": "uuid",
      "link_type": "trunk",
      "speed": "10G",
      "status": "active"
    }
  ],
  "racks": [
    {
      "id": "uuid",
      "name": "Rack A1",
      "total_units": 42,
      "devices": [
        { "device_id": "uuid", "name": "FW-STZ-01", "rack_u_start": 2, "rack_u_height": 1, "status": "operational" }
      ]
    }
  ]
}
```

---

## 4. Echtzeit-Updates via WebSocket

### 4.1 Architektur

```
┌─────────────┐       ┌────────────┐       ┌──────────────┐
│  PostgreSQL  │──────>│   Redis    │──────>│  WebSocket   │
│  NOTIFY/     │  Pub  │  Pub/Sub   │  Sub  │  Gateway     │
│  TRIGGER     │       │  Channel:  │       │  (Socket.IO) │
│              │       │  infra:*   │       │              │
└─────────────┘       └────────────┘       └──────┬───────┘
                                                   │
                                           ┌───────▼───────┐
                                           │  React Client │
                                           │  useInfraMap() │
                                           └───────────────┘
```

### 4.2 PostgreSQL Trigger

```sql
-- Generischer Notify-Trigger für alle Infra-Tabellen
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

-- Trigger auf allen relevanten Tabellen
CREATE TRIGGER trg_infra_locations_notify
    AFTER INSERT OR UPDATE OR DELETE ON infra_locations
    FOR EACH ROW EXECUTE FUNCTION notify_infra_change();

CREATE TRIGGER trg_infra_devices_notify
    AFTER INSERT OR UPDATE OR DELETE ON infra_devices
    FOR EACH ROW EXECUTE FUNCTION notify_infra_change();

CREATE TRIGGER trg_infra_device_links_notify
    AFTER INSERT OR UPDATE OR DELETE ON infra_device_links
    FOR EACH ROW EXECUTE FUNCTION notify_infra_change();
```

### 4.3 Backend: Redis Pub/Sub Bridge (Node.js)

```javascript
// services/infraNotifier.js
const { Client } = require('pg');
const Redis = require('ioredis');

const pgClient = new Client({ /* DB config */ });
const redisPub = new Redis({ /* Redis config */ });

async function startInfraNotifier() {
    await pgClient.connect();
    await pgClient.query('LISTEN infra_changes');

    pgClient.on('notification', (msg) => {
        const payload = JSON.parse(msg.payload);
        // Publish auf Redis-Channel für horizontale Skalierung
        redisPub.publish(`infra:${payload.table}`, msg.payload);
        // Generischer Channel für alle Änderungen
        redisPub.publish('infra:all', msg.payload);
    });
}
```

### 4.4 WebSocket Gateway (Socket.IO)

```javascript
// ws/infraGateway.js
const Redis = require('ioredis');
const redisSub = new Redis({ /* Redis config */ });

function setupInfraWebSocket(io) {
    const infraNs = io.of('/infrastructure');

    // RBAC Middleware — nur authentifizierte User mit infra-viewer Rolle
    infraNs.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        const user = await verifyJWT(token);
        if (!user || !user.roles.includes('infra-viewer')) {
            return next(new Error('Unauthorized'));
        }
        socket.user = user;
        next();
    });

    // Redis → WebSocket Bridge
    redisSub.subscribe('infra:all');
    redisSub.on('message', async (channel, message) => {
        const payload = JSON.parse(message);

        // Lade aktualisierte Daten aus der DB
        const updatedData = await fetchUpdatedEntity(payload.table, payload.id);

        infraNs.emit('infra:update', {
            entity: payload.table,
            operation: payload.operation,
            id: payload.id,
            data: updatedData,
            timestamp: payload.timestamp
        });
    });

    infraNs.on('connection', (socket) => {
        console.log(`[InfraMap] ${socket.user.name} connected`);

        // Client kann sich auf bestimmten Standort subscriben
        socket.on('subscribe:location', (locationId) => {
            socket.join(`location:${locationId}`);
        });

        socket.on('disconnect', () => {
            console.log(`[InfraMap] ${socket.user.name} disconnected`);
        });
    });
}
```

### 4.5 Frontend: React Hook

```javascript
// hooks/useInfraMap.js
import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

export function useInfraMap() {
    const [locations, setLocations] = useState([]);
    const [wanLinks, setWanLinks] = useState([]);
    const [topology, setTopology] = useState(null);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        // Initial Load via REST
        Promise.all([
            fetch('/api/v1/infrastructure/locations').then(r => r.json()),
            fetch('/api/v1/infrastructure/wan-links').then(r => r.json()),
        ]).then(([locs, links]) => {
            setLocations(locs);
            setWanLinks(links);
        });

        // WebSocket für Live-Updates
        const socket = io('/infrastructure', {
            auth: { token: getAuthToken() }
        });

        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));

        socket.on('infra:update', (payload) => {
            switch (payload.entity) {
                case 'infra_locations':
                    setLocations(prev => upsert(prev, payload.data, payload.operation));
                    break;
                case 'infra_devices':
                    setTopology(prev => prev ? updateDevice(prev, payload.data, payload.operation) : prev);
                    break;
                case 'infra_device_links':
                    setTopology(prev => prev ? updateLink(prev, payload.data, payload.operation) : prev);
                    break;
            }
        });

        socketRef.current = socket;
        return () => socket.disconnect();
    }, []);

    const loadTopology = useCallback(async (locationId) => {
        const data = await fetch(`/api/v1/infrastructure/locations/${locationId}/topology`).then(r => r.json());
        setTopology(data);
        socketRef.current?.emit('subscribe:location', locationId);
    }, []);

    return { locations, wanLinks, topology, loadTopology, connected };
}
```

---

## 5. Connector-Integration

Status-Daten können automatisch via Connector Framework aktualisiert werden:

| Connector | Datenquelle | Update-Intervall |
|-----------|-------------|-----------------|
| PRTG | Gerätestatus, Latenz, Bandbreite | 60s (Polling) |
| Zabbix | Server-Health, CPU/RAM/Disk | 60s (Polling) |
| ESXi/vCenter | VM-Status, Host-Health | 120s (Polling) |
| Quest KACE | Asset-Daten, Inventar | 15min |
| JAMF | macOS-Geräte Status | 15min |

Connector-Updates schreiben in die `infra_devices`-Tabelle → PostgreSQL Trigger → Redis → WebSocket → UI.

---

## 6. Frontend-Komponenten Struktur

```
src/
  components/
    InfrastructureMap/
      index.jsx                   -- Haupt-Container, View-Routing
      WorldMapView.jsx            -- Globale Karte mit D3.js
      NetworkTopologyView.jsx     -- Topologie mit animierten Datenflüssen
      RackView.jsx                -- Physische Rack-Darstellung
      hooks/
        useInfraMap.js            -- WebSocket + REST Hook
        useTopologyDrag.js        -- Drag&Drop für Geräte-Positionierung
      components/
        DeviceNode.jsx            -- Einzelnes Gerät (Icon, Status, Glow)
        DataFlowLine.jsx          -- Animierte Verbindungslinie
        VlanZone.jsx              -- VLAN-Bereich Overlay
        RackUnit.jsx              -- Einzelne Rack-Unit
        StatusBadge.jsx           -- Status-Indikator
        ScanlineOverlay.jsx       -- Sci-Fi Scanline-Effekt
        HudHeader.jsx             -- HUD-Titel-Element
      styles/
        infraTheme.js             -- Farben, Fonts, Glow-Definitionen
```

---

## 7. Feature-Details

### 7.1 Weltkarte
- D3.js `geoNaturalEarth1` Projektion
- Standort-Punkte mit Pulse-Animation (Farbe = Status)
- WAN-Links als animierte Linien mit fliessenden Datenpunkten
- Hover: Tooltip mit Asset-Count, Server-Count, Status
- Klick auf Standort → Wechsel zur Detail-Topologie
- Headquarters (ZRH) visuell hervorgehoben

### 7.2 Netzwerk-Topologie
- SVG-basierte Netzwerk-Darstellung
- Geräte als interaktive Nodes mit Typ-spezifischen Icons
- VLAN-Zonen als halbtransparente farbige Bereiche (toggle-bar)
- Animierte Datenfluss-Linien (Geschwindigkeit abhängig von Bandbreite)
- Klick auf Gerät → Detail-Popup (Name, Model, IP, Status)
- **Drag&Drop** zum Repositionieren von Geräten (speichert `topo_x`/`topo_y` via PATCH)
- Link-Typen visuell unterscheidbar (trunk, ha, vpc, storage)

### 7.3 Rack-View
- Massstabsgetreue 42U-Rack-Darstellung
- Farbcodierung nach Geräte-Typ
- Status-LEDs mit Pulse-Animation
- Hover: Highlight + Detail-Info
- Freie Units erkennbar für Kapazitätsplanung
- U-Nummerierung links

### 7.4 Design-System: "Dark Trace"
- Hintergrund: `#0a0e17` mit subtilen Grid-Linien
- Akzentfarbe: Cyan `#06b6d4` mit Glow-Effekt (`box-shadow: 0 0 8px`)
- Fonts: JetBrains Mono (technisch), DM Sans (Labels)
- Scanline-Overlay: 2px repeating gradient, 1.5% Opacity
- Status-Farben: Grün (operational), Amber (warning), Rot (critical), Blau (maintenance)
- Alle Animationen subtil — keine ablenkenden Effekte

---

## 8. Acceptance Criteria

- [ ] Weltkarte zeigt alle Standorte aus `infra_locations` mit korrektem Status
- [ ] WAN-Links werden animiert dargestellt
- [ ] Klick auf ZRH öffnet Stelzenstrasse-Topologie
- [ ] Topologie zeigt alle Geräte und Verbindungen aus DB
- [ ] VLAN-Zonen korrekt dargestellt und toggle-bar
- [ ] Rack-View zeigt korrekte U-Positionen
- [ ] Status-Änderung in DB wird innerhalb von 2 Sekunden in der UI reflektiert (WebSocket)
- [ ] Drag&Drop Repositionierung funktioniert und persistiert
- [ ] Alle API-Calls authentifiziert (JWT) und autorisiert (RBAC)
- [ ] Audit-Trail für alle Änderungen an Infrastruktur-Daten
- [ ] Responsive: funktioniert auf 1920x1080 und 1440x900
- [ ] Performance: Initiales Laden < 2s, Topologie-Wechsel < 500ms

---

## 9. Migrationsschritte

1. DB-Migration: Schema erstellen (`npx knex migrate:make infra_map`)
2. Seed-Daten: Bekannte LSYFN-Standorte + Stelzenstrasse/BAS-Geräte einspielen
3. API-Routes implementieren + Tests
4. WebSocket-Gateway aufsetzen + Redis Pub/Sub
5. React-Komponenten aus Prototyp (`InfrastructureMap.jsx`) refactoren
6. Connector-Integration (PRTG/Zabbix) für Live-Status

---

## 10. Offene Punkte / Entscheidungen

| Thema | Frage | Entscheidung |
|-------|-------|-------------|
| Topologie-Layout | Automatisches Layout (Force-Directed) oder manuell? | Manuell mit Drag&Drop + gespeicherten Positionen |
| Floorplan | 2D-Floorplan als Bild-Overlay? | Phase 2 — erst Rack-View |
| Monitoring-Tiefe | Soll die Map auch Metriken zeigen (CPU, Bandbreite)? | Phase 2 — erst Status-basiert |
| Multi-Standort Topologie | Können mehrere Standorte gleichzeitig offen sein? | Nein, Tab-basierter Switch |
| Mobile | Soll die Map auf Tablets funktionieren? | Nice-to-have, nicht Prio |

---

**Prototyp zum Testen:** `InfrastructureMap.jsx` — kann als React-Komponente direkt eingebunden werden. Enthält alle Views mit statischen Demo-Daten und dem finalen Design-System.
