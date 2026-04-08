# BOSSVIEW — Empfohlene Repo-Struktur

```
BOSSVIEW/
├── CLAUDE.md                          ← Claude Code Projektkontext (automatisch gelesen)
├── NAMING_CONVENTION.md               ← Vollständige Doku Namenskonzept
├── PROJECT_STRUCTURE.md               ← Dieses File
├── docker-compose.yml
├── package.json
│
├── src/
│   ├── shared/                        ← Shared Utilities (Frontend + Backend nutzbar)
│   │   ├── naming/
│   │   │   ├── namingConvention.js    ← Parser, Resolver, Validator, Konstanten
│   │   │   ├── namingConvention.test.js
│   │   │   └── index.js
│   │   └── constants/
│   │       └── locations.js           ← Standort-Codes, VLAN-Blöcke, IP-Schema
│   │
│   ├── frontend/
│   │   ├── public/
│   │   ├── index.html
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── common/                ← Buttons, Badges, Modals, StatusBadge
│   │   │   ├── layout/               ← TopBar, Sidebar, BottomBar
│   │   │   └── infra/                ← InfraMap spezifische Komponenten
│   │   │       ├── DeviceNode.jsx
│   │   │       ├── DataFlowLine.jsx
│   │   │       ├── VlanZone.jsx
│   │   │       └── RackUnit.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── InfrastructureMap.jsx      ← Weltkarte + Topologie + Racks
│   │   │   ├── NamingConventionManager.jsx ← Naming-Regeln editieren
│   │   │   ├── Assets.jsx
│   │   │   ├── Incidents.jsx
│   │   │   └── Settings.jsx
│   │   ├── hooks/
│   │   │   ├── useInfraMap.js         ← WebSocket + REST für Infrastruktur
│   │   │   └── useNaming.js           ← Hook: wraps namingConvention.js
│   │   ├── styles/
│   │   │   └── theme.js               ← COLORS, Fonts, Dark Trace Design Tokens
│   │   └── vite.config.js
│   │
│   ├── backend/
│   │   ├── server.js                  ← Express Entry Point
│   │   ├── routes/
│   │   │   ├── infrastructure.js      ← /api/v1/infrastructure/*
│   │   │   ├── assets.js
│   │   │   ├── naming.js             ← /api/v1/naming/* (Naming-Regeln CRUD)
│   │   │   └── auth.js
│   │   ├── services/
│   │   │   ├── infraNotifier.js       ← PG LISTEN → Redis Pub/Sub
│   │   │   └── connectorEngine.js     ← PRTG, Zabbix, KACE, JAMF Adapter
│   │   ├── middleware/
│   │   │   ├── auth.js                ← JWT + LDAP
│   │   │   ├── rbac.js               ← Casbin RBAC
│   │   │   └── audit.js              ← Request-Level Audit Logging
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   ├── seeds/
│   │   │   └── knexfile.js
│   │   └── ws/
│   │       └── infraGateway.js        ← Socket.IO WebSocket Gateway
│   │
│   └── connector-engine/              ← Separate Service für API-Adapter
│       ├── adapters/
│       │   ├── prtg.js
│       │   ├── zabbix.js
│       │   ├── esxi.js
│       │   ├── kace.js
│       │   └── jamf.js
│       └── scheduler.js
│
├── docker/
│   ├── nginx/
│   │   └── nginx.conf
│   ├── postgres/
│   │   └── init.sql
│   └── redis/
│       └── redis.conf
│
└── docs/
    ├── MILESTONE_InfrastructureMap.md
    └── architecture.md
```

## Schlüssel-Entscheidung: `src/shared/naming/`

Das Naming-Modul liegt unter `src/shared/` weil es von **beiden Seiten** gebraucht wird:

- **Frontend** importiert es für den Name-Parser, die InfraMap und den NamingConventionManager
- **Backend** importiert es für API-Validierung (z.B. wenn ein neues Gerät angelegt wird)

So gibt es **eine einzige Quelle der Wahrheit** für alle Naming-Regeln.
