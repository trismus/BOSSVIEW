# CLAUDE.md

Dieses File gibt Claude Code Kontext und Regeln für die Arbeit in diesem Repository.

## Projekt

**SKYNEX** — Zentralisierte Web-Plattform für IT-Infrastruktur-Management in der Luftfahrtindustrie.
Ziel: Assets, Incidents, Changes, Netzwerk-Topologie und KPIs in einem Dashboard vereinen, mit automatisierter Report-Generierung und vollständigem Audit-Trail.

## Compliance-Anforderungen

- **ISO 27001** — Alle Datenänderungen müssen im Audit-Trail protokolliert werden (Annex A Mapping). RBAC ist Pflicht. Verschlüsselung für Secrets (ENCRYPTION_KEY).
- **Luftfahrt-Industrie** — Erweiterte Nachweispflichten, lückenlose Change-Dokumentation, Aufbewahrung mind. 3 Jahre.
- Jeder Code muss diese Compliance-Anforderungen berücksichtigen. Keine Abkürzungen bei Security oder Logging.

## Tech-Stack

- **Frontend:** React SPA (Vite, Node 20)
- **Backend:** Express.js REST API + WebSocket (Node 20, TypeScript)
- **Datenbank:** PostgreSQL 16 (Audit-Log append-only)
- **Queue/Cache:** Redis 7 (Bull Queue, Session Store, Pub/Sub)
- **Connector Engine:** Node.js Worker für Dritt-System-Synchronisierung (Zabbix, PRTG, ServiceNow, Jira etc.)
- **Report Service:** PDF/DOCX-Generierung mit Template Engine
- **Reverse Proxy:** Nginx (TLS Termination, Rate Limiting)
- **Deployment:** Docker Compose (6 Services)

## Projektstruktur

```
SKYNEX/                    ← Repo-Root
├── CLAUDE.md
├── docker-compose.yml
├── .env.example
├── docs/                  ← Projekt-Dokumentation
│   ├── SKYNEX_PRD_v1.md
│   └── SKYNEX_Architecture_v1.md
├── frontend/              ← React SPA (noch anzulegen)
├── backend/               ← Express.js API + Connector Engine (noch anzulegen)
├── database/
│   └── migrations/        ← SQL Migrations (Init-Scripts für PostgreSQL)
└── nginx/
    ├── nginx.conf
    ├── conf.d/
    └── ssl/
```

## Entwicklungsrichtlinien

- **Sprache:** Code und Kommentare auf Englisch, Dokumentation auf Deutsch
- **Security first:** Keine Secrets in Code oder Git. `.env` ist in `.gitignore`. Alle API-Endpunkte müssen authentifiziert und autorisiert sein (JWT + RBAC).
- **Audit-Trail:** Jede CRUD-Operation muss geloggt werden (User, Timestamp, IP, alte/neue Werte). Audit-Log ist append-only.
- **Docker:** Alle Services mit `security_opt: no-new-privileges:true`. Healthchecks sind Pflicht.
- **Testing:** Tests schreiben für alle Business-Logic und API-Endpunkte.

## Connector-Referenzen

Unter `docs/connector-references/` liegen die verbindlichen Referenzdokumente für die Connector-Implementierung:

- **Quest KACE / PROTrack** (`quest-kace-protrack.md`) — CSV-Import aus Quest KACE SMA via PROTrack. ~470 Assets, 35 Spalten. Phase 1: generischer CSV-Import (P0). Phase 2: dedizierter KACE-API-Connector (P2). Enthält vollständiges Feld-Mapping, Transformationsregeln und Datenqualitäts-Themen.
- **Qualys Vulnerability Scanner** (`qualys-vulnerability.md`) — Vulnerability-Daten (322 Vulns, 206 Workstation). Korrelation mit KACE-Assets über IP/FQDN. Alternativ über Jira-Connector (Trackspace, Projekt ISLSYZRH). Enthält Severity-Mapping, KPI-Definitionen und API-Endpunkte.
- **n8n Workflows** (`n8n-workflows.md`) — Dokumentation der bestehenden n8n-Pipelines (PROTrack v7 Asset-Export, Qualys+KACE Vuln-Report). Enthält Hostname-Konventionen für Asset-Typ-Erkennung, FQDN-Normalisierung, Deduplizierungslogik und die Ablösematrix n8n→SKYNEX.
- **Qualys-KACE Workflow JSON** (`qualys-kace-workflow.json`) — Originaler n8n-Workflow als Referenz. Enthält Klartext-Credentials — nur als API/Datenstruktur-Referenz nutzen, Credentials NICHT übernehmen.

### Externe Systeme

| System | URL | Auth | Connector-Priorität |
|--------|-----|------|---------------------|
| Quest KACE SMA | `k1000.lidozrh.ch` | JWT (Cookie) | P0 (CSV) / P2 (API) |
| JAMF Pro | `lidozrh.jamfcloud.com` | OAuth2 | P2 |
| Jira (Trackspace) | `trackspace.lhsystems.com` | Bearer Token | P0 |
| Qualys | `qualysapi.qualys.eu` | Basic Auth | P1 |
| n8n | Self-hosted | — | P1 (Webhook) |

## Befehle

```bash
# Starten (Development)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Starten (Production)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
