# SKYNEX

**SKYNEX — Mission Control for IT Infrastructure**

---

## Überblick

SKYNEX vereint Asset Management, Incident & Change Tracking, Netzwerk-Topologie und KPIs in einem zentralen Dashboard — mit automatisierter Report-Generierung und vollständigem Audit-Trail für die Luftfahrtindustrie.

## Features

- **Asset Management (CMDB)** — Zentrale Verwaltung aller IT-Assets mit Lifecycle-Tracking
- **Incident & Change Tracking** — Erfassung, Zuweisung und Nachverfolgung von Störungen und Änderungen
- **Echtzeit-Dashboard** — KPIs, Asset-Status und Vulnerability-Übersicht auf einen Blick
- **Connector Engine** — Integration mit Dritt-Systemen (Quest KACE, Qualys, Jira, JAMF, n8n)
- **Audit-Trail** — Lückenlose Protokollierung aller Datenänderungen (ISO 27001)
- **RBAC** — Rollenbasierte Zugriffskontrolle mit 5 Rollen (Admin, Manager, Operator, Viewer, Auditor)

## Tech-Stack

| Komponente | Technologie |
|---|---|
| Frontend | React SPA (Vite, TypeScript) |
| Backend | Express.js REST API + WebSocket (Node 20, TypeScript) |
| Datenbank | PostgreSQL 16 |
| Queue / Cache | Redis 7 (Bull Queue, Session Store, Pub/Sub) |
| Reverse Proxy | Nginx (TLS, Rate Limiting) |
| Deployment | Docker Compose (6 Services) |

## Schnellstart

```bash
git clone https://github.com/trismus/SKYNEX.git
cd SKYNEX
cp .env.example .env
```

Secrets in `.env` anpassen — mindestens `JWT_SECRET`, `ENCRYPTION_KEY` und Datenbank-Passwörter generieren:

```bash
# Secrets generieren (Linux/macOS)
openssl rand -base64 64   # für JWT_SECRET
openssl rand -base64 32   # für ENCRYPTION_KEY
openssl rand -base64 32   # für DB-Passwörter
```

Anwendung starten:

```bash
docker compose up
```

Die Anwendung ist unter `https://localhost` erreichbar.

**Default Login:** `admin@skynex.local` / `Admin123!`

> Nach dem ersten Login das Passwort sofort ändern.

## Projektstruktur

```
SKYNEX/
├── frontend/          React SPA
├── backend/           Express.js API + Connector Engine
├── database/          SQL Migrations
├── nginx/             Reverse Proxy Konfiguration
├── docs/              Projekt-Dokumentation
├── docker-compose.yml
├── .env.example
└── CLAUDE.md          AI-Agenten-Kontext
```

## Team

| Name | Rolle |
|---|---|
| Martin | System-Architekt |
| Peter | Senior Fullstack Developer |
| Kim | UI/UX Designer |
| Ioannis | Security Agent |

## Compliance

- **ISO 27001** — Vollständiger Audit-Trail, RBAC, verschlüsselte Secrets
- **Luftfahrt-Industrie** — Erweiterte Nachweispflichten, lückenlose Change-Dokumentation, Aufbewahrung mind. 3 Jahre

## Lizenz

Vertraulich / Proprietary — Siehe [LICENSE](./LICENSE).
