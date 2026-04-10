# SKYNEX — Product Requirements Document (PRD)

**Version:** 1.0
**Datum:** 2. April 2026
**Autor:** Christian Stebler
**Status:** Draft
**Klassifikation:** Vertraulich — ISO 27001 konform

---

## 1. Problem Statement

IT-Infrastruktur-Teams in der Luftfahrtindustrie arbeiten oft mit fragmentierten Tools: Monitoring-Daten in Zabbix/PRTG, Tickets in Jira/ServiceNow, Asset-Informationen in Excel-Listen und Berichte werden manuell zusammengestellt. Diese Fragmentierung führt zu fehlender Transparenz, redundanter Datenpflege und erhöhtem Aufwand bei Audits (ISO 27001, Luftfahrt-Compliance). Ohne eine zentrale Plattform entstehen blinde Flecken im Betrieb, die sowohl Verfügbarkeit als auch Compliance-Nachweise gefährden.

**Betroffene:** IT-Infrastruktur-Team, IT-Management, Compliance-/Audit-Verantwortliche, CISO

**Auswirkung bei Nicht-Lösung:** Manuelle Fehler, verzögerte Incident-Response, nicht nachvollziehbare Changes, unvollständige Audit-Trails, potenzielle Compliance-Verstösse

---

## 2. Goals

1. **Zentralisierung**: Alle IT-Infrastruktur-Daten (Assets, Netzwerk, Incidents, Changes) in einer einzigen Web-Plattform vereinen
2. **Compliance-Readiness**: Jederzeit auditfähige Nachweise gemäss ISO 27001 Annex A und Luftfahrt-Industriestandards generieren können
3. **Reporting-Effizienz**: Monatliche Management-Reports von >4h manueller Arbeit auf <30min automatisierte Generierung reduzieren
4. **Echtzeit-Transparenz**: Live-KPI-Dashboards für Verfügbarkeit, SLA-Einhaltung und offene Incidents bereitstellen
5. **Integration**: Nahtlose bidirektionale Anbindung an bestehende Monitoring- und ITSM-Systeme

---

## 3. Non-Goals

1. **Kein Ersatz für Monitoring-Tools** — SKYNEX aggregiert und visualisiert Monitoring-Daten, ersetzt aber nicht Zabbix/PRTG/Nagios als primäre Datenquelle
2. **Kein vollständiges ITSM-Tool** — Ticket-Erstellung und -Bearbeitung bleibt im bestehenden Ticketing-System; SKYNEX synchronisiert und reportet
3. **Keine Netzwerk-Konfiguration** — SKYNEX dokumentiert Netzwerktopologie, bietet aber keine aktive Konfigurationsänderung an Switches/Firewalls
4. **Kein Multi-Tenant SaaS** — V1 ist als Single-Tenant On-Premise/Private-Cloud Lösung konzipiert
5. **Kein End-User Self-Service Portal** — Fokus liegt auf dem IT-Infrastruktur-Team, nicht auf Endbenutzer-Ticketing

---

## 4. User Stories

### IT-Infrastruktur-Engineer

- Als Engineer möchte ich alle Server, Netzwerkkomponenten und deren Status auf einen Blick sehen, damit ich Probleme schnell erkennen kann
- Als Engineer möchte ich bei einem Incident sofort die betroffenen Assets und deren Abhängigkeiten sehen, damit ich die Ursache schneller finde
- Als Engineer möchte ich Changes dokumentieren und einem Genehmigungsworkflow unterziehen, damit alle Änderungen nachvollziehbar sind
- Als Engineer möchte ich Wartungsfenster planen und betroffene Systeme automatisch benachrichtigen lassen

### IT-Team Lead / Manager

- Als Team Lead möchte ich ein Dashboard mit KPIs (Verfügbarkeit, MTTR, offene Incidents, SLA-Status) sehen, damit ich den Teamstatus jederzeit kenne
- Als Manager möchte ich auf Knopfdruck monatliche Reports generieren können, die Management-tauglich formatiert sind
- Als Team Lead möchte ich Kapazitäten und Auslastung des Teams über Incident-/Change-Volumen tracken können

### Compliance / Audit

- Als Compliance-Beauftragter möchte ich vollständige Audit-Trails aller Changes und Zugriffsaktionen exportieren können
- Als Auditor möchte ich ISO 27001 Control-Nachweise (Annex A) direkt aus dem System generieren können
- Als CISO möchte ich sehen, welche Assets ihre letzte Sicherheitsprüfung überschritten haben

---

## 5. Requirements

### P0 — Must-Have (MVP)

| ID | Anforderung | Akzeptanzkriterien |
|----|------------|-------------------|
| P0-01 | **Asset Management CMDB** — Erfassung und Verwaltung von Hardware, Software, Lizenzen mit Lebenszyklus-Tracking | Assets können angelegt, bearbeitet, kategorisiert werden; Lebenszyklus-Status (Planung → Betrieb → Ablösung → Entsorgung) ist sichtbar; Import via CSV möglich |
| P0-02 | **Netzwerk-Topologie** — Visuelle Darstellung der Netzwerkstruktur (Server, Switches, Firewalls, VLANs) | Interaktive Netzwerkkarte mit Drill-Down; Abhängigkeiten zwischen Komponenten sichtbar; Status-Indikatoren (online/offline/warning) |
| P0-03 | **Incident-Dashboard** — Synchronisation und Darstellung offener/geschlossener Incidents aus ITSM | Incidents werden alle 5 Min. synchronisiert; Filterbar nach Priorität, Status, Kategorie, Zeitraum; Detailansicht mit verlinkten Assets |
| P0-04 | **Change Management** — Erfassung, Genehmigung und Dokumentation von Changes | Change-Requests mit Risikobewertung, Genehmigungsworkflow (mind. 2-Augen-Prinzip), Rollback-Dokumentation; Kalendar-Ansicht für geplante Changes |
| P0-05 | **Audit-Trail** — Vollständige Protokollierung aller Datenänderungen und Zugriffe | Unveränderliches Log aller CRUD-Operationen mit Timestamp, User, IP, alte/neue Werte; Export als CSV/PDF; Aufbewahrung mind. 3 Jahre |
| P0-06 | **Rollen & Berechtigungen (RBAC)** — Granulare Zugriffskontrolle basierend auf Rollen | Vordefinierte Rollen (Admin, Engineer, Manager, Auditor, ReadOnly); Berechtigungen pro Modul; SSO/LDAP-Integration |
| P0-07 | **KPI-Dashboard** — Echtzeit-Übersicht der wichtigsten Infrastruktur-Kennzahlen | Verfügbarkeit (%), MTTR, MTBF, offene Incidents, SLA-Einhaltung, Change-Erfolgsrate; Zeitraum-Selektion; Auto-Refresh |
| P0-08 | **Report-Generierung** — Automatisierte Erstellung von Management- und Compliance-Reports | PDF/Word Export; Konfigurierbare Templates; Zeitplan-basierte automatische Generierung; ISO 27001 Annex A Mapping |

### P1 — Nice-to-Have (v1.1)

| ID | Anforderung | Akzeptanzkriterien |
|----|------------|-------------------|
| P1-01 | **Monitoring-Integration** — Bidirektionale Anbindung an Zabbix/PRTG/Nagios | REST-API Connector; Echtzeit-Status-Sync; Threshold-Alerts in SKYNEX sichtbar |
| P1-02 | **Wartungsverträge** — Verwaltung von SLA- und Wartungsverträgen mit Ablaufwarnungen | Verträge an Assets geknüpft; Automatische Erinnerung 90/60/30 Tage vor Ablauf |
| P1-03 | **Kapazitätsplanung** — Prognose für Hardware-Lifecycle und Kapazitätsengpässe | Historische Trend-Analyse; Warnungen bei Kapazitätsgrenzen; Budget-Schätzung für Erneuerungen |
| P1-04 | **Custom Dashboards** — Benutzer können eigene Dashboard-Ansichten konfigurieren | Drag & Drop Widgets; Speicherbare Layouts; Teilbar mit Team |

### P2 — Future Considerations (v2.0+)

| ID | Anforderung |
|----|------------|
| P2-01 | **Multi-Site Support** — Verwaltung mehrerer Standorte mit standortübergreifendem Reporting |
| P2-02 | **Mobile App** — Native iOS/Android App für Incident-Benachrichtigungen und Status-Checks |
| P2-03 | **AI-gestützte Anomalie-Erkennung** — Automatische Erkennung von ungewöhnlichen Mustern in Infrastruktur-Daten |
| P2-04 | **Automatisierte Runbooks** — Scriptbasierte Automatisierung von Standard-Wartungsaufgaben |

---

## 6. Architektur & Tech-Stack

### Frontend
- **Framework:** React 18+ mit TypeScript
- **UI Library:** Shadcn/UI + Tailwind CSS (professionelles, konsistentes Design)
- **Charts:** Recharts oder Apache ECharts (KPI-Dashboards)
- **Netzwerk-Visualisierung:** D3.js oder Cytoscape.js (Topologie-Karten)
- **State Management:** Zustand oder TanStack Query
- **Report-Export:** Client-seitige PDF/DOCX-Generierung

### Backend
- **Runtime:** Node.js mit Express/Fastify oder alternativ Python (FastAPI)
- **API:** RESTful API + WebSockets für Echtzeit-Updates
- **Authentifizierung:** OAuth 2.0 / OpenID Connect, LDAP/AD-Integration
- **Autorisierung:** RBAC mit Policy-Engine (z.B. CASL oder Casbin)

### Datenbank
- **Primär:** PostgreSQL (relationale Daten, CMDB, Audit-Logs)
- **Cache:** Redis (Session-Management, Dashboard-Caching)
- **Audit-Log:** Append-Only Table mit Trigger-basierter Erfassung (unveränderlich)

### Integrationen
- **ITSM:** REST-API Connector für Jira, ServiceNow, OTRS (abstrahiert über Adapter-Pattern)
- **Monitoring:** API-Anbindung für Zabbix, PRTG, Nagios (Polling + Webhook-Empfang)
- **Authentifizierung:** LDAP/Active Directory, SAML 2.0

### Infrastruktur & Deployment
- **Container:** Docker + Docker Compose (Entwicklung), Kubernetes (Produktion)
- **CI/CD:** GitLab CI oder GitHub Actions
- **Reverse Proxy:** Nginx mit TLS-Terminierung
- **Backup:** Automatisierte PostgreSQL-Backups, verschlüsselt

### Sicherheit (ISO 27001 / Luftfahrt)
- Verschlüsselung: TLS 1.3 (Transit), AES-256 (At Rest)
- Audit-Logging: Alle Zugriffe und Mutationen protokolliert
- Passwort-Policy: Mindestens 12 Zeichen, Komplexitätsregeln, MFA-Pflicht
- Session-Management: Automatisches Timeout, Concurrent-Session-Limit
- Vulnerability Scanning: Regelmässige Dependency-Checks (Snyk/Trivy)
- Penetration Testing: Jährlich durch externen Anbieter
- Data Classification: Alle Daten nach Vertraulichkeitsstufen klassifiziert

---

## 7. Datenmodell (Kernentitäten)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│     Asset        │────▶│   AssetRelation   │◀────│     Asset       │
│─────────────────│     │──────────────────│     │                 │
│ id               │     │ source_asset_id   │     │                 │
│ name             │     │ target_asset_id   │     │                 │
│ type (enum)      │     │ relation_type     │     │                 │
│ status           │     └──────────────────┘     └─────────────────┘
│ location         │
│ ip_address       │     ┌──────────────────┐
│ lifecycle_stage  │────▶│   Maintenance     │
│ criticality      │     │  Contract         │
│ created_at       │     │──────────────────│
│ updated_at       │     │ vendor            │
└─────────────────┘     │ sla_level         │
        │                │ expiry_date       │
        │                └──────────────────┘
        ▼
┌─────────────────┐     ┌──────────────────┐
│    Incident      │     │     Change        │
│─────────────────│     │──────────────────│
│ id               │     │ id                │
│ external_id      │     │ external_id       │
│ title            │     │ title             │
│ priority         │     │ risk_level        │
│ status           │     │ status            │
│ affected_assets[]│     │ affected_assets[] │
│ resolved_at      │     │ approved_by       │
│ mttr             │     │ scheduled_date    │
└─────────────────┘     │ rollback_plan     │
                         └──────────────────┘

┌─────────────────┐
│   AuditLog       │
│─────────────────│
│ id               │
│ timestamp        │
│ user_id          │
│ action           │
│ entity_type      │
│ entity_id        │
│ old_value (JSON) │
│ new_value (JSON) │
│ ip_address       │
└─────────────────┘
```

---

## 8. Success Metrics

### Leading Indicators (kurzfristig messbar)

| Metrik | Ziel | Messmethode |
|--------|------|-------------|
| Datenerfassungsrate | >90% aller IT-Assets in SKYNEX innerhalb 3 Monate | Asset-Count vs. bekannte Infrastruktur-Inventarliste |
| Dashboard-Nutzung | >80% des Teams nutzt Dashboards täglich | Login-/Session-Analytics |
| Incident-Sync-Latenz | <5 Minuten Verzögerung zum ITSM-System | Timestamp-Vergleich ITSM vs. SKYNEX |
| Report-Generierungszeit | <2 Minuten pro Standard-Report | Timer im System |

### Lagging Indicators (langfristig messbar)

| Metrik | Ziel | Messmethode |
|--------|------|-------------|
| Audit-Vorbereitungszeit | -60% Reduktion gegenüber aktuellem Aufwand | Zeiterfassung vor/nach Einführung |
| MTTR (Mean Time to Resolve) | -20% durch bessere Asset-Transparenz | ITSM-Datenvergleich vor/nach |
| Change-Erfolgsrate | >95% (aktuell messen und als Baseline nutzen) | Change-Success/Fail Ratio |
| Compliance-Findings | 0 kritische Findings bei ISO 27001 Audit | Audit-Ergebnis |

---

## 9. Phasenplan

### Phase 1 — Foundation (Wochen 1–8)
- Projekt-Setup (Repository, CI/CD, Docker-Umgebung)
- Authentifizierung & RBAC (LDAP-Integration, Rollen)
- Datenbank-Schema & Audit-Trail-Mechanismus
- Asset-Management CMDB (CRUD, Import, Kategorisierung)
- **Meilenstein:** Erstes Asset kann erfasst und auditiert werden

### Phase 2 — Core Features (Wochen 9–16)
- Netzwerk-Topologie-Visualisierung
- Incident-Dashboard mit ITSM-Sync (1 Connector)
- Change-Management-Modul
- KPI-Dashboard (Basis-Metriken)
- **Meilenstein:** Täglicher Betrieb des Teams wird über SKYNEX abgebildet

### Phase 3 — Reporting & Compliance (Wochen 17–22)
- Report-Templates (Management, Compliance)
- Automatische Report-Generierung (PDF/DOCX)
- ISO 27001 Annex A Control-Mapping
- Export-Funktionen für Audits
- **Meilenstein:** Erster automatisiert generierter Management-Report

### Phase 4 — Integration & Polish (Wochen 23–28)
- Monitoring-Tool-Integration (Zabbix/PRTG)
- Zweiter ITSM-Connector
- Wartungsvertrags-Modul
- Performance-Optimierung & UX-Verfeinerung
- **Meilenstein:** Vollständige Integration in bestehende Tool-Landschaft

### Phase 5 — Go-Live & Stabilisierung (Wochen 29–32)
- Security Review & Penetration Test
- User Acceptance Testing (UAT)
- Dokumentation & Schulung
- Go-Live + Hypercare-Phase (2 Wochen)
- **Meilenstein:** Produktiver Betrieb

---

## 10. Open Questions

| Frage | Verantwortlich | Priorität |
|-------|---------------|-----------|
| Welches ITSM-System ist primär im Einsatz (Jira, ServiceNow, OTRS)? | Christian / IT-Team | Hoch |
| Welches Monitoring-Tool wird primär genutzt (Zabbix, PRTG, Nagios)? | Christian / IT-Team | Hoch |
| Gibt es bestehende LDAP/AD-Infrastruktur für SSO? | Christian / IT-Security | Hoch |
| Wo soll SKYNEX gehostet werden (On-Premise, Private Cloud)? | Christian / IT-Management | Hoch |
| Gibt es spezifische Luftfahrt-Normen (z.B. DO-326A, ED-202A) die berücksichtigt werden müssen? | Compliance | Mittel |
| Wie viele Assets/Nodes muss die Netzwerk-Topologie initial abbilden (Skalierung)? | Christian | Mittel |
| Gibt es Budget-Vorgaben oder Team-Grösse für die Entwicklung? | Management | Mittel |
| Sollen bestehende Excel-Listen als Initialdaten migriert werden? | Christian | Niedrig |

---

## 11. Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| ITSM-API-Limitierungen (Rate Limits, fehlende Endpunkte) | Mittel | Hoch | Frühzeitige API-Evaluation in Phase 1; Fallback auf CSV-Import |
| Datenqualität bei Asset-Migration | Hoch | Mittel | Validierungsregeln beim Import; Bereinigungskampagne vor Go-Live |
| Performance bei grosser Netzwerk-Topologie | Mittel | Mittel | Lazy Loading, Pagination, Server-Side-Rendering der Graphen |
| Widerstand bei Team-Adoption | Mittel | Hoch | Frühzeitige Einbindung des Teams; Quick-Wins in Phase 2; Schulungen |
| Compliance-Anforderungen ändern sich während Entwicklung | Niedrig | Hoch | Modularer Aufbau; Audit-Requirements als eigene Konfigurationsschicht |

---

*Dieses Dokument dient als Grundlage für die technische Umsetzung und wird iterativ weiterentwickelt.*
