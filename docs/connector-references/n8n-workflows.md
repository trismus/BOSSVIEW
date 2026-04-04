# Referenz: Bestehende n8n Workflows — Datenpipelines LSYFN

**Version:** 1.0
**Datum:** 5. April 2026
**Kontext:** Diese Workflows laufen aktuell in der n8n-Instanz bei LSYFN und generieren die Daten, die BOSSVIEW ablösen/integrieren soll.
**Klassifikation:** Vertraulich — enthält System-Integrationsbeschreibungen

---

## 1. Workflow: PROTrack v7 — Asset-Export Pipeline

**Dateiname:** `Protack workflow v7 final.json`
**Typ:** Scheduled (monatlich)
**Zweck:** Konsolidiert Assets aus Quest KACE + JAMF Pro → einheitliches PROTrack CSV-Format

### 1.1 Datenfluss

```
📅 Monthly Trigger
       │
       ▼
⚙️ Config & Credentials
       │
       ├──────────────────────┐
       ▼                      ▼
🔐 KACE Login             🔐 JAMF Login (OAuth2)
       │                      │
       ▼                      ▼
✅ Token extrahieren       🍎 JAMF Daten abrufen
       │                      │  (Pagination, /api/v1/computers-inventory)
       ▼                      │
🖥️ KACE Daten abrufen     │
   (Machines + Assets API)    │
       │                      │
       ▼                      ▼
⚙️ KACE Transformieren    ⚙️ JAMF Transformieren
   & Normalisieren            & Normalisieren
       │                      │
       └──────────┬───────────┘
                  ▼
     🔗 KACE + JAMF zusammenführen (Merge)
                  │
                  ▼
     🧹 Duplikate entfernen (KACE hat Priorität)
                  │
                  ▼
     🔀 Mit bestehendem PROTack Export mergen
        (Application-Felder erhalten)
                  │
                  ▼
     🧹 Interne Felder entfernen (_source)
                  │
                  ▼
     📄 CSV Export
        → PROTack_assetdata_sheet_LSYFN_{yyyy-MM}.csv
```

### 1.2 Quellsysteme & API-Endpunkte

| System | URL | Auth | API Version | Endpunkte |
|--------|-----|------|-------------|-----------|
| **Quest KACE** | `https://k1000.lidozrh.ch` | JWT (Cookie-based) | v14 | `/ams/shared/api/security/login`, `/api/inventory/machines`, `/api/asset/assets` |
| **JAMF Pro** | `https://lidozrh.jamfcloud.com` | OAuth2 Client Credentials | v1 | `/api/oauth/token`, `/api/v1/computers-inventory` |

### 1.3 Transformationslogik (Relevanz für BOSSVIEW)

**Hostname-Konventionen (Asset-Typ-Erkennung):**

| Prefix | Asset-Typ | Beispiel |
|--------|-----------|---------|
| `LIDOZRHL` | workstation | lidozrhl099 (Laptop) |
| `LIDOZRHA` | workstation | lidozrha000 (Desktop) |
| `LIDOZRHW` | workstation | — |
| `LIDOZRHM` | workstation | — |
| `LIDOPCTL` | workstation | — (JAMF Macs) |
| `LIDOPCTM` | workstation | — (JAMF Macs) |
| `LIDOZRHV` | virtual server | lidozrhv193 |
| `LIDOZRHC` | virtual server | — |
| `LIDOZRHS` | physical server | lidozrhs01 |
| `ZRHSTSW` | network | — (Stelzenstrasse) |
| `ZRHBASW` | network | — (BAS Datacenter) |
| `ZRH-NG-FW` | network | — (Firewall) |
| `ZRHSTG` | physical server | — (Storage) |

**Data-Center-Zuordnung:**

| Asset-Typ | Data Center |
|-----------|-------------|
| workstation | *(leer — kein DC)* |
| virtual server | LSYFN Atlas Edge (Nugolo) |
| physical server | LSYFN On premises |
| network (ZRHSTSW) | LSYFN Stelzenstrasse |
| network (ZRHBASW) | LSYFN BAS Datacenter |

**FQDN-Normalisierung:**
```
Roh-Input → Bereinigung → Standard-Format
lidozrhv193.lidozrh.ch.lidozrh.ch → lidozrhv193.lidozrh.ch
lidozrhv193.cluster.local → lidozrhv193.lidozrh.ch
lidozrhv193.workgroup → lidozrhv193.lidozrh.ch
lidozrhv193.empty → lidozrhv193.lidozrh.ch
lidozrhv193 → lidozrhv193.lidozrh.ch
```
Domain ist immer `*.lidozrh.ch`.

**ProTack Translation Mapping:**
Ein statisches Mapping von ~90 Hostnamen auf 2nd-Level-Support-Teams und Applikationszuordnungen. Dieses Mapping wird direkt im Workflow-Code gepflegt.

### 1.4 Deduplizierungslogik

- **Schlüssel:** `hardware name` (Hostname, lowercase, trimmed)
- **Priorität:** KACE-Einträge > JAMF-Einträge (bei Duplikaten gewinnt KACE)
- **Merge-Strategie:** Neue Assets hinzufügen, bestehende aktualisieren, manuell gepflegte Application-Felder erhalten

### 1.5 Output

CSV-Datei mit 35 Spalten (exakt das Format aus `quest-kace-protrack.md`) plus internem `_source`-Feld (wird vor Export entfernt).

---

## 2. Workflow: Qualys Open Vulnerabilities + KACE Users

**Dateiname:** `Qualys Open Vulnerabilities + KACE Users.json`
**Typ:** Manual Trigger
**Zweck:** Vulnerability-Tickets aus Jira (Qualys-Quelle) mit KACE-User-Daten anreichern → HTML Dashboard

### 2.1 Datenfluss

```
🔘 Manual Trigger
       │
       ├──────────────────────────┐
       ▼                          ▼
1. Jira - Get Total Count     🔐 KACE Login
   (JQL: project=ISLSYZRH        │
    type=Vulnerability            ▼
    status=Open)               ✅ Token extrahieren
       │                          │
       ▼                          ▼
2. Calculate Pagination        Get Machines
       │                       (KACE API)
       ▼                          │
3. Jira - Fetch All Tickets       ▼
   (paginiert, Batch 1000)     2. Build KACE Lookup
       │                       (Hostname → User Map)
       └──────────┬───────────────┘
                  ▼
     4. Merge Jira + KACE
                  │
                  ▼
     5. Consolidate + Enrich
        (Gruppierung nach Vuln,
         KACE User-Zuordnung)
                  │
                  ▼
     6. Generate HTML Report
                  │
                  ▼
     7. Create HTML File
        → Qualys_Vulnerabilities_with_Users.html
```

### 2.2 Quellsysteme & API-Endpunkte

| System | URL | Auth | Endpunkte |
|--------|-----|------|-----------|
| **Jira (Trackspace)** | `https://trackspace.lhsystems.com` | Bearer Token | `/rest/api/2/search` |
| **Quest KACE** | `https://k1000.lidozrh.ch` | JWT (Cookie-based) | `/api/inventory/machines` |

### 2.3 Jira Custom Fields (Qualys → Jira Mapping)

| Custom Field | Jira ID | Inhalt | BOSSVIEW-Relevanz |
|-------------|---------|--------|-------------------|
| Hostname | `customfield_34832` | Betroffener Host | → Asset-Korrelation |
| IP Address | `customfield_35049` | IP des Hosts | → Asset-Korrelation |
| Severity | `customfield_34800` | Critical/High/Medium/Low | → `vulnerabilities.severity` |
| OS | `customfield_34904` | Betriebssystem | → Validierung |
| CVE Link | `customfield_34803` | Link zur CVE | → `vulnerabilities.remediation` |

### 2.4 KACE User-Enrichment

Der Workflow erstellt einen Lookup aus KACE Machines:
```
Hostname (lowercase) → { user, userFullname, kaceIp, kaceName }
```

**Matching-Strategie:**
1. Exakter Hostname-Match (FQDN)
2. Short-Hostname-Match (erster Teil vor dem Punkt)

**Match-Rate:** Wird im Dashboard als KPI angezeigt (typisch ~70-85%)

### 2.5 Jira JQL-Query

```jql
project = ISLSYZRH
  AND type = Vulnerability
  AND status = Open
ORDER BY summary ASC
```

**Jira-Projekt:** `ISLSYZRH` (ISEC @ LSY ZRH)
**Issue-Typ:** Vulnerability (Qualys-generiert)

### 2.6 Konsolidierungslogik

- Jira-Tickets werden nach `summary` (Vulnerability-Titel) gruppiert
- Pro Vulnerability: Liste betroffener Hosts mit User-Zuordnung
- Sortierung: Anzahl betroffener Hosts (absteigend)
- Statistiken: Total Tickets, Unique Vulns, Severity-Verteilung, KACE Match Rate

### 2.7 Output

Self-contained HTML Dashboard im Lufthansa-Corporate-Design mit:
- KPIs (Total Tickets, Unique Vulns, Critical/High/Medium/Low, KACE Match Rate)
- Filterbare/durchsuchbare Vulnerability-Cards
- Pro Vulnerability: Host-Tabelle mit User, IP, OS, Jira-Ticket-Link
- Druckoptimiert

---

## 3. Implikationen für BOSSVIEW

### 3.1 Was BOSSVIEW ablöst

| Aktuell (n8n) | Zukünftig (BOSSVIEW) |
|---------------|---------------------|
| Monatlicher CSV-Export | Echtzeit-Synchronisierung über Connector Engine |
| Statisches ProTack Mapping (hardcoded) | Dynamisches Mapping über UI-Konfiguration |
| Separate HTML-Dashboards | Integriertes Dashboard mit allen Datenquellen |
| Manuelle Vulnerability-Reports | Automatisierte Vulnerability-KPIs mit Asset-Korrelation |
| KACE + JAMF getrennt zusammengeführt | Einheitlicher Asset-Store mit Multi-Source-Tracking |

### 3.2 Übernahme in BOSSVIEW Connectors

| n8n Workflow-Logik | BOSSVIEW Connector | Priorität |
|-------------------|-------------------|-----------|
| KACE Login + Machines/Assets API | Quest KACE Connector (P2, `cmdb`) | Phase 2 |
| JAMF OAuth2 + Computers API | JAMF Connector (P2, `cmdb`) | Phase 2 |
| KACE + JAMF Merge + Dedup | Asset Merge Engine (Core) | Phase 1 |
| ProTack Translation Mapping | Asset Enrichment Rules (UI-konfigurierbar) | Phase 1 |
| Hostname → Asset-Typ Prefix-Mapping | Asset Type Resolver (konfigurierbar) | Phase 1 |
| FQDN-Normalisierung | Data Transform Pipeline | Phase 1 |
| Jira JQL für Qualys-Vulns | Jira Connector (P0, `itsm`) | Phase 1 |
| KACE User-Lookup für Vulns | Asset-Vulnerability Korrelation (Core) | Phase 1 |
| HTML Report Generierung | Report Service (PDF/DOCX) | Phase 2 |

### 3.3 Zusätzliche Erkenntnisse

**Neue Applikationen (aus ProTack Mapping):**

| Application Name | Application ID | Teams |
|-----------------|---------------|-------|
| LSYFN Active Directory (LIDOZRH) | APP-17974 | it_zrh@ |
| LSYFN Norman | APP-20450 | lido.scrum.goat-data@ |
| LSYFN AMDB Applications | APP-20237 | lido.scrum.goat-data@ |
| LSYFN Hermes Applications | APP-20360 | lido.scrum.logistics@ |
| LSYFN Kairos Application | APP-20390 | lido.scrum.logistics@ |
| LSYFN Post Office | APP-21022 | pausanias@ |

**Neue Asset-Typen für BOSSVIEW Schema:**
- `physical_server` (Prefix LIDOZRHS, ZRHSTG)
- `network_device` (Prefix ZRHSTSW, ZRHBASW, ZRH-NG-FW)

**Zusätzliche Data Centers:**
- LSYFN Stelzenstrasse (Network)
- LSYFN BAS Datacenter (Network)
- LSYFN On premises (Physical Servers)

**Jira-Integration entdeckt:**
- Jira-Instanz: `trackspace.lhsystems.com`
- Projekt: `ISLSYZRH` (ISEC @ LSY ZRH)
- Vulnerability-Tickets werden von Qualys automatisch als Jira-Issues erstellt
- Custom Fields für Hostname, IP, Severity, OS, CVE-Link

---

## 4. Security-Hinweis

Die Workflow-Dateien enthalten Klartext-Credentials (KACE User/Password, JAMF Client ID/Secret). Diese müssen in BOSSVIEW über den verschlüsselten Config-Store (`ENCRYPTION_KEY`) gespeichert werden. Die n8n-Workflows dienen nur als Referenz für API-Endpunkte und Datenstrukturen.

**WICHTIG:** Die Credential-Werte aus diesen Workflows dürfen nicht in den BOSSVIEW-Sourcecode oder Git-Repository übernommen werden.

---

*Dieses Dokument dient als Referenz für die Migration der n8n-Datenpipelines nach BOSSVIEW. Die Workflow-Dateien werden im Repo unter `docs/connector-references/` archiviert.*
