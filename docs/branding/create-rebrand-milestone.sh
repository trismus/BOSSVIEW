#!/usr/bin/env bash
#
# Bootstrap: SKYNEX Rebrand milestone on GitHub
#
# Creates labels, a milestone, and all issues described in
# docs/branding/skynex-rebrand-milestone.md.
#
# Prerequisites:
#   - `gh` CLI installed and authenticated (`gh auth login`)
#     OR
#   - `GH_TOKEN` env var with a PAT that has `repo` scope, and `curl` + `jq`
#
# Usage:
#   bash docs/branding/create-rebrand-milestone.sh
#
# The script is idempotent per resource where possible (labels are upserted;
# milestone and issues are only created if they do not already exist by title).

set -euo pipefail

REPO="${REPO:-trismus/BOSSVIEW}"
MILESTONE_TITLE="SKYNEX Rebrand — Name Change & Logo Integration"
MILESTONE_DESCRIPTION="Vollstaendiger Rebrand von BOSSVIEW zu SKYNEX: Repo-Namen, Code, Docs, Deployment und Logo-Integration. Details: docs/branding/skynex-rebrand-milestone.md"

# ---------- helpers ----------

have_gh() { command -v gh >/dev/null 2>&1; }
have_curl() { command -v curl >/dev/null 2>&1; }
have_jq() { command -v jq >/dev/null 2>&1; }

api() {
    # Generic GitHub API helper. Uses gh if available, else curl + GH_TOKEN.
    local method="$1" path="$2" body="${3:-}"
    if have_gh; then
        if [[ -n "$body" ]]; then
            gh api -X "$method" "$path" --input - <<< "$body"
        else
            gh api -X "$method" "$path"
        fi
    else
        if [[ -z "${GH_TOKEN:-}" ]]; then
            echo "ERROR: Neither 'gh' CLI is available nor GH_TOKEN env var is set." >&2
            exit 1
        fi
        local url="https://api.github.com${path}"
        if [[ -n "$body" ]]; then
            curl -sSL -X "$method" \
                 -H "Authorization: Bearer $GH_TOKEN" \
                 -H "Accept: application/vnd.github+json" \
                 -H "X-GitHub-Api-Version: 2022-11-28" \
                 -d "$body" \
                 "$url"
        else
            curl -sSL -X "$method" \
                 -H "Authorization: Bearer $GH_TOKEN" \
                 -H "Accept: application/vnd.github+json" \
                 -H "X-GitHub-Api-Version: 2022-11-28" \
                 "$url"
        fi
    fi
}

# ---------- labels ----------

upsert_label() {
    local name="$1" color="$2" desc="$3"
    local payload
    payload=$(python3 -c "
import json, sys
print(json.dumps({'name': sys.argv[1], 'color': sys.argv[2], 'description': sys.argv[3]}))
" "$name" "$color" "$desc")

    # Try create; if 422 (already exists) fall back to update.
    if ! api POST "/repos/${REPO}/labels" "$payload" >/dev/null 2>&1; then
        api PATCH "/repos/${REPO}/labels/$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$name")" "$payload" >/dev/null
    fi
    echo "  label: $name"
}

echo "==> Upserting labels..."
upsert_label "rebrand"        "ffd16f" "SKYNEX Rebrand Milestone"
upsert_label "epic:naming"    "c084fc" "Epic: Repo & Naming"
upsert_label "epic:code"      "60a5fa" "Epic: Codebase Rename"
upsert_label "epic:logo"      "99f7ff" "Epic: Logo Integration"
upsert_label "epic:external"  "f472b6" "Epic: External Communication"
upsert_label "frontend"       "4ade80" "Frontend-Arbeit"
upsert_label "backend"        "fb923c" "Backend-Arbeit"
upsert_label "devops"         "94a3b8" "Deployment / Infra"
upsert_label "database"       "a78bfa" "Datenbank-Arbeit"
upsert_label "reporting"      "e879f9" "Report-Generator"
upsert_label "email"          "22d3ee" "E-Mail-Templates"
upsert_label "qa"             "facc15" "Quality Assurance"
upsert_label "tech-debt"      "64748b" "Technische Schuld"
upsert_label "storybook"      "ff716c" "Storybook"
upsert_label "docs"           "94a3b8" "Dokumentation"
upsert_label "test"           "86efac" "Tests"
upsert_label "priority:p0"    "ef4444" "P0 - blockierend"
upsert_label "priority:p1"    "f59e0b" "P1 - wichtig"
upsert_label "priority:p2"    "3b82f6" "P2 - nice to have"

# ---------- milestone ----------

echo "==> Ensuring milestone exists..."

existing_milestone_number=""
if have_gh; then
    existing_milestone_number=$(gh api "/repos/${REPO}/milestones?state=all&per_page=100" \
        --jq ".[] | select(.title==\"$MILESTONE_TITLE\") | .number" || true)
else
    if ! have_jq; then
        echo "ERROR: 'jq' is required when using curl fallback." >&2
        exit 1
    fi
    existing_milestone_number=$(api GET "/repos/${REPO}/milestones?state=all&per_page=100" \
        | jq -r ".[] | select(.title==\"$MILESTONE_TITLE\") | .number")
fi

if [[ -z "$existing_milestone_number" ]]; then
    ms_payload=$(python3 -c "
import json, sys
print(json.dumps({'title': sys.argv[1], 'state': 'open', 'description': sys.argv[2]}))
" "$MILESTONE_TITLE" "$MILESTONE_DESCRIPTION")
    if have_gh; then
        MILESTONE_NUMBER=$(api POST "/repos/${REPO}/milestones" "$ms_payload" | python3 -c "import sys,json;print(json.load(sys.stdin)['number'])")
    else
        MILESTONE_NUMBER=$(api POST "/repos/${REPO}/milestones" "$ms_payload" | jq -r '.number')
    fi
    echo "  created milestone #${MILESTONE_NUMBER}"
else
    MILESTONE_NUMBER="$existing_milestone_number"
    echo "  reusing existing milestone #${MILESTONE_NUMBER}"
fi

# ---------- issues ----------

issue_exists() {
    local title="$1"
    local found
    if have_gh; then
        found=$(gh api "/repos/${REPO}/issues?state=all&milestone=${MILESTONE_NUMBER}&per_page=100" \
            --jq ".[] | select(.title==\"$title\") | .number" || true)
    else
        found=$(api GET "/repos/${REPO}/issues?state=all&milestone=${MILESTONE_NUMBER}&per_page=100" \
            | jq -r ".[] | select(.title==\"$title\") | .number")
    fi
    [[ -n "$found" ]]
}

create_issue() {
    local title="$1" body="$2"; shift 2
    local labels_json
    labels_json=$(python3 -c "
import json, sys
print(json.dumps(sys.argv[1:]))
" "$@")

    if issue_exists "$title"; then
        echo "  skip (exists): $title"
        return
    fi

    local payload
    payload=$(python3 -c "
import json, sys
data = {
  'title': sys.argv[1],
  'body': sys.argv[2],
  'milestone': int(sys.argv[3]),
  'labels': json.loads(sys.argv[4]),
}
print(json.dumps(data))
" "$title" "$body" "$MILESTONE_NUMBER" "$labels_json")

    if have_gh; then
        num=$(api POST "/repos/${REPO}/issues" "$payload" | python3 -c "import sys,json;print(json.load(sys.stdin)['number'])")
    else
        num=$(api POST "/repos/${REPO}/issues" "$payload" | jq -r '.number')
    fi
    echo "  created #${num}: $title"
}

echo "==> Creating issues..."

# ===== Epic 1 — Repository & Naming =====

create_issue \
"Rename GitHub repository trismus/BOSSVIEW -> trismus/SKYNEX" \
"## Ziel
Repo-Rename auf GitHub. Automatische Weiterleitung testen und Team informieren.

## Acceptance Criteria
- [ ] Repo-Rename via GitHub-Settings durchgefuehrt
- [ ] \`git clone git@github.com:trismus/BOSSVIEW.git\` funktioniert weiterhin (Redirect)
- [ ] Team-Mitglieder haben \`git remote set-url origin\` ausgefuehrt
- [ ] README und Repo-Description aktualisiert
- [ ] Interne Links (Confluence, Slack-Pins) umgestellt

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:naming" "priority:p0"

create_issue \
"Update root documentation: README.md, CLAUDE.md, SECURITY.md, LICENSE" \
"## Ziel
Alle Top-Level Doku-Files auf SKYNEX umstellen. Keine funktionalen Code-Aenderungen.

## Acceptance Criteria
- [ ] \`README.md\`: Projektname, Badges, Screenshots, Setup-Befehle
- [ ] \`CLAUDE.md\`: Projektbezeichnung, Tagline, Tech-Stack-Header
- [ ] \`SECURITY.md\`: Contact-E-Mail und Projektbezeichnung
- [ ] \`LICENSE\`: Copyright-Header geprueft

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:naming" "docs" "priority:p0"

create_issue \
"Rename docs/BOSSVIEW_PRD_v1.md -> docs/SKYNEX_PRD_v1.md" \
"## Ziel
PRD umbenennen und alle Querverweise im Repo aktualisieren.

## Acceptance Criteria
- [ ] \`git mv docs/BOSSVIEW_PRD_v1.md docs/SKYNEX_PRD_v1.md\`
- [ ] Alle Verweise auf BOSSVIEW_PRD im Repo aktualisiert (\`grep -r BOSSVIEW_PRD\`)
- [ ] Diagramme und Tabellen im PRD auf SKYNEX umgestellt
- [ ] Versionshistorie am Dateiende: v1.1 mit Rename-Eintrag

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:naming" "docs" "priority:p1"

create_issue \
"Rename docs/BOSSVIEW_Architecture_v1.md -> docs/SKYNEX_Architecture_v1.md" \
"## Ziel
Architektur-Dokument umbenennen, Diagramme aktualisieren.

## Acceptance Criteria
- [ ] \`git mv\` fuer das File
- [ ] Alle Architektur-Referenzen im Code/Docs aktualisiert
- [ ] Diagramm-Titel und Legenden angepasst

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:naming" "docs" "priority:p1"

create_issue \
"Decide and execute: rename legacy BOSSVIEW/ subfolder (archive or rename)" \
"## Ziel
Das alte Prototyp-Verzeichnis \`BOSSVIEW/\` im Repo-Root aufraeumen.

## Acceptance Criteria
- [ ] Decision-Doc: archivieren vs. umbenennen vs. entfernen
- [ ] Bei Archivierung: nach \`archive/bossview-prototype/\` verschieben mit README-Hinweis
- [ ] \`CLAUDE.md\` und \`PROJECT_STRUCTURE.md\` aktualisiert

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:naming" "tech-debt" "priority:p2"

# ===== Epic 2 — Codebase Rename =====

create_issue \
"docker-compose: rename services/containers/networks from bossview- to skynex-" \
"## Ziel
Alle Service-, Container-, Network- und Volume-Namen in \`docker-compose.yml\` und \`docker-compose.dev.yml\` auf SKYNEX umstellen.

## Acceptance Criteria
- [ ] Service-Namen: \`bossview-backend\` -> \`skynex-backend\` etc.
- [ ] Container-Namen und Network-Namen angepasst
- [ ] \`.env.example\` an neue Namen angepasst
- [ ] \`docker compose up\` lokal getestet
- [ ] Migrationshinweis fuer named volumes in PR-Description

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:code" "devops" "priority:p1"

create_issue \
"Nginx config: update upstream names and comments" \
"## Ziel
\`nginx/nginx.conf\` und \`nginx/conf.d/*.conf\` auf SKYNEX umstellen.

## Acceptance Criteria
- [ ] \`upstream bossview_backend\` -> \`upstream skynex_backend\`
- [ ] Kommentare und Titel aktualisiert
- [ ] \`nginx -t\` laeuft ohne Fehler
- [ ] \`server_name\` unveraendert (DNS-Umstellung ist Epic 4)

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:code" "devops" "priority:p1"

create_issue \
"Backend: update log prefixes, swagger title, service name" \
"## Ziel
Alle User-facing Backend-Strings auf SKYNEX umstellen. API-Routen bleiben unveraendert (Backwards Compatibility).

## Acceptance Criteria
- [ ] \`backend/src/swagger.ts\`: API-Titel \"SKYNEX API\"
- [ ] \`backend/src/index.ts\`: Bootstrap-Log-Zeile
- [ ] \`backend/src/websocket.ts\`: WebSocket Server ID/Name
- [ ] \`backend/src/routes/dashboard.ts\`, \`assets.ts\`, \`directory-users.ts\` Strings geprueft
- [ ] Keine Aenderungen an Response-Payloads oder Routen-Pfaden

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:code" "backend" "priority:p1"

create_issue \
"Frontend: update page titles, meta tags, UI copy (BOSSVIEW -> SKYNEX)" \
"## Ziel
Alle User-facing Frontend-Strings auf SKYNEX umstellen.

## Acceptance Criteria
- [ ] \`frontend/index.html\` title und meta-tags
- [ ] \`LoginPage.tsx\`: Welcome-Header, Tagline
- [ ] \`Layout.tsx\`: App-Bezeichnung
- [ ] \`helpContent.ts\`: alle BOSSVIEW-Treffer
- [ ] \`InfrastructurePage.tsx\`, \`VulnerabilityDetailDrawer.tsx\`, \`PageHelpBanner.tsx\`, \`WorldMapView.tsx\`, \`useWebSocket.ts\` geprueft
- [ ] Screenshots im PR angehaengt

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:code" "frontend" "priority:p0"

create_issue \
"Database: decide schema/table rename vs. keep (ADR)" \
"## Ziel
Architektur-Entscheidung dokumentieren: Bleibt der DB-Name \`bossview\` bestehen oder wird er zu \`skynex\` migriert?

## Acceptance Criteria
- [ ] \`docs/decisions/0001-db-name-post-rebrand.md\` angelegt
- [ ] Empfehlung und Begruendung (Audit-Trail-Stabilitaet, Downtime, Compliance)
- [ ] Bei \"behalten\": nur \`COMMENT ON ...\` Statements in Migration-Files aktualisiert
- [ ] Bei \"migrieren\": Folge-Issue mit Downtime-Fenster und Rollback-Plan

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:code" "database" "priority:p2"

create_issue \
"Tests: update fixtures, seed data, describe blocks" \
"## Ziel
Alle Test-Fixtures und -Beschreibungen auf SKYNEX umstellen. Testsuite muss gruen bleiben.

## Acceptance Criteria
- [ ] \`backend/tests/*.test.ts\`: \`describe\`-Blocks aktualisiert
- [ ] \`backend/src/seed.ts\`: Seed-Daten auf SKYNEX
- [ ] \`npm test\` laeuft gruen

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:code" "test" "priority:p2"

# ===== Epic 3 — Logo Integration =====

create_issue \
"Logo: copy brand assets to frontend/ and install vite-plugin-svgr" \
"## Ziel
Produktionsreife Brand-Assets aus \`docs/branding/assets/\` in die Frontend-App uebernehmen.

## Acceptance Criteria
- [ ] \`skynex-lockup.svg\`, \`skynex-mark.svg\`, \`skynex-mono.svg\` -> \`frontend/src/assets/logo/\`
- [ ] \`skynex-favicon.svg\` -> \`frontend/public/favicon.svg\`
- [ ] \`npm install -D vite-plugin-svgr\` durchgefuehrt, \`package.json\` committed
- [ ] \`vite.config.ts\` mit \`svgr()\` Plugin erweitert
- [ ] \`src/vite-env.d.ts\`: \`/// <reference types=\\\"vite-plugin-svgr/client\\\" />\`
- [ ] \`npm run build\` laeuft gruen

## Verweise
- docs/branding/assets/README.md
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:logo" "frontend" "priority:p0"

create_issue \
"Logo: install <Logo> component at frontend/src/components/brand/Logo.tsx" \
"## Ziel
Die React-Komponente aus \`docs/branding/assets/Logo.tsx\` in die App einbauen.

## Acceptance Criteria
- [ ] Datei nach \`frontend/src/components/brand/Logo.tsx\` kopiert
- [ ] TypeScript compiliert ohne Fehler
- [ ] Component exportiert \`Logo\` und \`LogoVariant\`
- [ ] JSDoc mit Usage-Beispielen uebernommen

## Verweise
- docs/branding/assets/Logo.tsx
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:logo" "frontend" "priority:p0"

create_issue \
"Logo: wire favicon + meta tags in frontend/index.html" \
"## Ziel
Favicon und alle Meta-Tags auf SKYNEX umstellen.

## Acceptance Criteria
- [ ] \`<link rel=\\\"icon\\\" type=\\\"image/svg+xml\\\" href=\\\"/favicon.svg\\\" />\`
- [ ] \`<link rel=\\\"mask-icon\\\" href=\\\"/favicon.svg\\\" color=\\\"#00f1fe\\\" />\`
- [ ] \`<meta name=\\\"theme-color\\\" content=\\\"#0b0e14\\\" />\`
- [ ] \`<title>SKYNEX - Mission Control for IT</title>\`
- [ ] \`<meta name=\\\"description\\\">\` aktualisiert
- [ ] Open-Graph-Tags angelegt (og:image als Follow-Up ok, wenn PNG fehlt)

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:logo" "frontend" "priority:p0"

create_issue \
"Logo: integrate <Logo variant=\"lockup\"> in Topbar" \
"## Ziel
Das Logo-Lockup links in der Topbar anzeigen.

## Acceptance Criteria
- [ ] Topbar zeigt \`<Logo variant=\\\"lockup\\\" height={32} />\`
- [ ] Aria-Label \"SKYNEX - Mission Control for IT\"
- [ ] Klick navigiert zum Dashboard (\`/\`)
- [ ] Kein Padding-Hack, Hoehe sitzt sauber

## Verweise
- Related: Issue #76 (App-Shell im Design-System Milestone)
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:logo" "frontend" "priority:p0"

create_issue \
"Logo: integrate <Logo variant=\"mark\"> in collapsed Sidebar" \
"## Ziel
In eingeklapptem Zustand nur das Icon, in ausgeklapptem Zustand Icon + Wordmark.

## Acceptance Criteria
- [ ] Collapsed: nur \`mark\`-Variante (32px)
- [ ] Expanded: Lockup ODER Mark + Wordmark-Text
- [ ] Transition 200ms fluessig

## Verweise
- Related: Issue #76
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:logo" "frontend" "priority:p1"

create_issue \
"Logo: integrate <Logo variant=\"lockup\"> in LoginPage" \
"## Ziel
Login-Screen mit zentriertem Logo-Lockup.

## Acceptance Criteria
- [ ] \`<Logo variant=\\\"lockup\\\" height={48} />\` zentriert ueber dem Formular
- [ ] min. 32px Vertical-Margin
- [ ] Doppelte Tagline entfernt (Tagline ist schon im SVG)

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:logo" "frontend" "priority:p0"

create_issue \
"Logo: loading/splash screen with pulsing mark" \
"## Ziel
Initiale App-Bootphase und \`ProtectedRoute\`-Loading mit pulsierendem SKYNEX-Icon.

## Acceptance Criteria
- [ ] \`<Logo variant=\\\"mark\\\" height={120} className=\\\"animate-pulse\\\" />\`
- [ ] Deep-Space-Background (\`#0b0e14\`)
- [ ] Sichtbarkeit max. 1s, dann Fade-Out

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:logo" "frontend" "priority:p2"

create_issue \
"Logo: Storybook story for Logo component" \
"## Ziel
Logo-Komponente in Storybook dokumentieren.

## Acceptance Criteria
- [ ] \`frontend/src/components/brand/Logo.stories.tsx\` angelegt
- [ ] Stories: Lockup, Mark, Mono, MonoOnLightBackground, SizesRow (16/24/32/48/64/120)
- [ ] Controls fuer \`variant\` und \`height\`
- [ ] Docs-Tab erklaert Brand-Guardrails (SKY/NEX Zweifarbigkeit)

## Verweise
- Related: Issue #88 (Storybook-Setup)
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:logo" "frontend" "storybook" "priority:p2"

# ===== Epic 4 — External Communication & Deployment =====

create_issue \
"Reports: update PDF/DOCX templates with SKYNEX branding" \
"## Ziel
Alle Report-Templates auf SKYNEX-Branding umstellen.

## Acceptance Criteria
- [ ] Report-Header verwendet \`skynex-lockup.svg\`
- [ ] Footer: \"SKYNEX - Mission Control for IT - {generatedAt} - ISO 27001 Audit Trail\"
- [ ] Snapshot-Tests aktualisiert
- [ ] Beispiel-Reports angehaengt

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:external" "reporting" "priority:p1"

create_issue \
"Email templates: update notifications, invites, password reset" \
"## Ziel
Alle Transactional-E-Mails auf SKYNEX-Branding.

## Acceptance Criteria
- [ ] Alle Templates in \`backend/src/email/templates/*\` aktualisiert
- [ ] Absender-Name \"SKYNEX\"
- [ ] Footer-Links auf neue Domain (oder Platzhalter)
- [ ] Visueller Review abgenommen

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:external" "email" "priority:p1"

create_issue \
"DNS + TLS: prepare skynex.* subdomain or new domain" \
"## Ziel
Domain-Strategie entscheiden und umsetzen.

## Acceptance Criteria
- [ ] Decision: neue Domain vs. Subdomain vs. Umleitung dokumentiert
- [ ] DNS-Record angelegt (A/CNAME)
- [ ] TLS-Zertifikat (Let's Encrypt) ausgestellt
- [ ] 301-Redirect von alter Domain (oder Parallel-Betrieb)
- [ ] Nginx-Config angepasst

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:external" "devops" "priority:p2"

create_issue \
"CI/CD + deployment scripts: rename service references" \
"## Ziel
Pipelines, Deployment-Scripts und Monitoring-Alerts auf SKYNEX umstellen.

## Acceptance Criteria
- [ ] GitHub Actions Workflow-Titel/Kommentare
- [ ] \`scripts/*\` Service-Namen
- [ ] Monitoring-Alert-Beschreibungen (falls vorhanden)
- [ ] Dry-Run der Pipeline erfolgreich

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:external" "devops" "priority:p2"

create_issue \
"Final audit: grep -ri bossview + manual UI walkthrough" \
"## Ziel
Abschluss-Pruefung vor dem Milestone-Close.

## Acceptance Criteria
- [ ] \`grep -ri bossview\` liefert nur noch bewusst stehengelassene Treffer
- [ ] Liste aller verbleibenden Treffer mit Begruendung im Issue
- [ ] Manueller UI-Walkthrough durch alle Screens + Screenshots
- [ ] Abnahme durch Christian

## Verweise
- docs/branding/skynex-rebrand-milestone.md" \
"rebrand" "epic:external" "qa" "priority:p0"

echo
echo "==> Done."
echo "Milestone: ${MILESTONE_TITLE} (#${MILESTONE_NUMBER})"
echo "Repo:      https://github.com/${REPO}/milestone/${MILESTONE_NUMBER}"
