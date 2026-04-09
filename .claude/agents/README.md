# BOSSVIEW Agent-Team

Dieses Verzeichnis enthält die Subagenten für die Entwicklung von BOSSVIEW. Jeder Agent ist auf eine Rolle spezialisiert und kennt die Repo-Struktur, die Compliance-Anforderungen (ISO 27001, Luftfahrt) und die projektweiten Regeln aus `CLAUDE.md`.

## Rollen im Überblick

| Agent | Rolle | Zuständig für | Model |
|---|---|---|---|
| `backend-express` | Backend-Engineer | Express.js + TypeScript API, WebSocket, Bull-Queues, Auth/RBAC, Audit-Log-Integration | sonnet |
| `frontend-react` | Frontend-Engineer | React SPA, Vite, Tailwind, Hooks, Route-Guards, API-Client, Echtzeit-UI | sonnet |
| `database-postgres` | Database-Engineer | PostgreSQL 16 Schema, Migrationen, Indizes, Query-Performance, Audit-Log-Integrität | sonnet |
| `devops-docker` | DevOps / Platform | docker-compose, Dockerfiles, Nginx/TLS, Healthchecks, CI/CD, Container-Härtung | sonnet |
| `code-reviewer` | Code-Qualität | Allgemeines Review: Lesbarkeit, Tests, Naming, Abstraktion, Konsistenz | sonnet |
| `connector-engine` | Integration-Engineer | KACE (CSV/API), Qualys, Jira Trackspace, n8n-Ablösung, Sync-Logs, Korrelation | sonnet |
| `report-service` | Document-Engineer | PDF/DOCX-Generierung, Template-Engines, KPI-Reports, Compliance-Evidenz | sonnet |
| `iso27001-aviation-security` | Security / Compliance | ISO-27001-Kontrollen, Aviation-Security-Review, OWASP, Secrets, SoA-Impact | opus |
| `ui-ux-designer` | UI/UX-Designer | Layout, Komponenten-Hierarchie, Interaktions-Design, Accessibility-Konzept | (s. Datei) |

## Zusammenspiel

Die Agenten sind so entworfen, dass sie sich gegenseitig anrufen, wenn eine Aufgabe mehrere Domänen berührt — statt dass einer alles versucht:

- **Neuer API-Endpunkt mit Schema-Änderung:** `backend-express` → delegiert die Migration an `database-postgres` → `iso27001-aviation-security` reviewt Auth/RBAC/Audit → `code-reviewer` vor Merge.
- **Neue Frontend-Seite:** `ui-ux-designer` (Layout-Konzept) → `frontend-react` (Umsetzung) → ggf. `backend-express` für fehlende Endpunkte → `code-reviewer`.
- **Neuer Connector (z. B. KACE-CSV):** `connector-engine` liest zuerst `docs/connector-references/*` → `database-postgres` für neue Spalten/Indizes → `backend-express` für Queue-Job und Status-API → `iso27001-aviation-security` für Credential-Handling.
- **Neuer Report:** `report-service` baut View-Model und Renderer → nutzt `docx`/`pdf`-Skills → `database-postgres` für Query-Performance → `iso27001-aviation-security` für Klassifizierung.
- **Infrastruktur-Änderung (neuer Service, TLS, Nginx):** `devops-docker` → `iso27001-aviation-security` für Security-Impact.

## Gemeinsame Regeln (aus `CLAUDE.md`)

Jeder Agent respektiert:

1. **Sprache:** Code/Kommentare **Englisch**, Kommunikation mit dem User **Deutsch**.
2. **Secrets:** niemals in Code, Images oder Git — nur via `.env`/verschlüsselte DB-Config.
3. **Audit-Trail:** jede CRUD-Operation wird protokolliert (User, Timestamp, IP, alte/neue Werte), append-only.
4. **Auth/RBAC:** JWT + Rollenprüfung auf jedem nicht-öffentlichen Endpunkt. UI-Guards sind UX, nicht Security.
5. **Tests:** Business-Logik und API-Endpunkte sind testpflichtig, keine "grünen" Tasks mit roten Tests.
6. **Docker-Härtung:** non-root, `no-new-privileges`, Healthchecks, minimale Images.

## Aufruf

```text
> Nutze den backend-express Agenten, um den POST /api/assets Endpunkt zu bauen.
> Lass den code-reviewer über den letzten Commit schauen.
> connector-engine soll den KACE-CSV-Import implementieren.
```

Claude wählt oft auch automatisch den passenden Agenten, sobald die Beschreibung zum Task passt.

## Wartung

- Neue Agenten gehören in dieses Verzeichnis und müssen YAML-Frontmatter mit `name`, `description`, `model`, `color`, `memory` haben.
- Die Beschreibung bleibt **auf Deutsch** (damit Du sie schnell scannen kannst), der System-Prompt ist **auf Englisch**.
- Bei neuen Projekt-Konventionen bitte **alle** betroffenen Agenten aktualisieren, nicht nur einen.
