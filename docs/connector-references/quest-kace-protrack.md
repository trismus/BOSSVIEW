# Connector-Referenz: Quest KACE / PROTrack CSV-Import

**Version:** 1.0
**Datum:** 5. April 2026
**Quelle:** PROTrack Asset-Export (Quest KACE SMA)
**Connector-Typ:** `import` (CSV) — nutzt den generischen CSV/JSON/Excel Import Connector (P0)
**Priorität:** P0 (als CSV-Import) / P2 (zukünftiger Quest KACE API-Connector, Kategorie `cmdb`)

> **Hinweis:** Die Architecture v1 listet Quest KACE als P2/cmdb-Connector (direkter API-Zugang).
> In Phase 1 nutzen wir den generischen CSV-Import-Connector (P0/import) mit Quest KACE Daten aus PROTrack.
> Der dedizierte KACE-API-Connector folgt in Phase 2+.

---

## 1. Übersicht

Quest KACE Systems Management Appliance (SMA) ist das zentrale ITSM- und Asset-Management-Tool bei Lufthansa Systems FlightNav AG (LSY FN, PG 678). Der Datenexport erfolgt über PROTrack als CSV-Datei mit standardisiertem Spalten-Layout.

**Datenumfang (Stand April 2026):**
- ~470 Assets
- 35 Spalten pro Asset
- Asset-Typen: `workstation`, `virtual server`
- Standort: LSYFN Atlas Edge (Nugolo), ZRH, CH

---

## 2. CSV-Spalten → SKYNEX Feld-Mapping

### 2.1 Organisation & Herkunft

| # | CSV-Spalte | SKYNEX-Feld | DB-Tabelle | Typ | Hinweise |
|---|-----------|---------------|------------|-----|----------|
| 1 | `legal company name` | `assets.tags.company_name` | assets | jsonb | Immer "Lufthansa Systems FlightNav AG" |
| 2 | `legal company short code` | `assets.tags.company_code` | assets | jsonb | Immer "LSY FN" |
| 3 | `legal company pg number` | `assets.tags.pg_number` | assets | jsonb | Immer "678" |
| 4 | `itsm tool name` | `assets.source` | assets | varchar | → "quest-kace" (normalisiert) |
| 5 | `id itsm tool` | `assets.external_id` | assets | varchar | Quest KACE Asset-ID |

### 2.2 Support & Verantwortlichkeit

| # | CSV-Spalte | SKYNEX-Feld | DB-Tabelle | Typ | Hinweise |
|---|-----------|---------------|------------|-----|----------|
| 6 | `secondlevelsupport Itsm tool` | `assets.tags.support_l2` | assets | jsonb | E-Mail oder Team-Name |
| 7 | `thirdlevelsuppert Itsm tool` | `assets.tags.support_l3` | assets | jsonb | E-Mail oder Team-Name (Typo im Original beachten!) |

### 2.3 Kern-Asset-Daten

| # | CSV-Spalte | SKYNEX-Feld | DB-Tabelle | Typ | Hinweise |
|---|-----------|---------------|------------|-----|----------|
| 8 | `asset type` | `assets.type` | assets | enum | Mapping: "workstation" → `workstation`, "virtual server" → `virtual_server` |
| 9 | `ip address` | `assets.ip_address` | assets | inet | Kann leer sein (v.a. bei Workstations) |
| 10 | `fqdn` | `assets.tags.fqdn` | assets | jsonb | z.B. "lidozrhv193.lidozrh.ch" |
| 11 | `hardware name` | `assets.name` | assets | varchar | Hostname, z.B. "lidozrhv193" |
| 12 | `hwSourceSystem` | `assets.hardware_info.source_system` | assets | jsonb | Hersteller + Modell-String |
| 13 | `operating system & version` | `assets.os` | assets | varchar | z.B. "Microsoft Windows 11 Enterprise x64" |
| 14 | `asset criticality` | `assets.criticality` | assets | enum | Mapping nötig: leer → `unclassified` |

### 2.4 ITSM & Lifecycle

| # | CSV-Spalte | SKYNEX-Feld | DB-Tabelle | Typ | Hinweise |
|---|-----------|---------------|------------|-----|----------|
| 15 | `business service name itsm tool` | `assets.tags.business_service` | assets | jsonb | z.B. "Quest KACE" |
| 16 | `asset manufacturer` | `assets.hardware_info.manufacturer` | assets | jsonb | z.B. "Dell Inc.", "VMware, Inc.", "Apple Inc." |
| 17 | `asset model` | `assets.hardware_info.model` | assets | jsonb | z.B. "Precision T3610", "VMware20,1" |
| 18 | `timezone` | `assets.tags.timezone` | assets | jsonb | z.B. "Europe/Berlin" |
| 19 | `system environment` | `assets.tags.environment` | assets | jsonb | z.B. "Prod", "Dev", "Test" |
| 20 | `asset lifecycle status` | `assets.lifecycle_stage` | assets | enum | Mapping: "active" → `active`, "retired" → `decommissioned` |

### 2.5 Kontakt & Standort

| # | CSV-Spalte | SKYNEX-Feld | DB-Tabelle | Typ | Hinweise |
|---|-----------|---------------|------------|-----|----------|
| 21 | `hardware contact name & email adress` | `assets.tags.hw_contact` | assets | jsonb | E-Mail-Adresse |
| 22 | `IT provider name` | `assets.tags.it_provider` | assets | jsonb | z.B. "LSYFN IT Infrastructure" |
| 23 | `data center name` | `assets.location.name` | assets | jsonb | z.B. "LSYFN Atlas Edge (Nugolo)" |
| 24 | `data center city` | `assets.location.city` | assets | jsonb | z.B. "ZRH" |
| 25 | `data center country` | `assets.location.country` | assets | jsonb | z.B. "CH" |

### 2.6 Applikations-Kontext (Erweiterte Felder)

| # | CSV-Spalte | SKYNEX-Feld | DB-Tabelle | Typ | Hinweise |
|---|-----------|---------------|------------|-----|----------|
| 26 | `application name` | `assets.custom_fields.app_name` | assets | jsonb | z.B. "LSYFN Active Directory" |
| 27 | `applicationID` | `assets.custom_fields.app_id` | assets | jsonb | z.B. "APP-17974" |
| 28 | `application confidentiality` | `assets.custom_fields.app_confidentiality` | assets | jsonb | CIA-Triad: C-Wert |
| 29 | `application integrity` | `assets.custom_fields.app_integrity` | assets | jsonb | CIA-Triad: I-Wert |
| 30 | `application availability` | `assets.custom_fields.app_availability` | assets | jsonb | CIA-Triad: A-Wert |
| 31 | `application pci scope` | `assets.custom_fields.app_pci_scope` | assets | jsonb | PCI-DSS relevant? |
| 32 | `application vulnerability scan frequency` | `assets.custom_fields.app_vuln_scan_freq` | assets | jsonb | Scan-Intervall |
| 33 | `application internet exposure` | `assets.custom_fields.app_internet_exposure` | assets | jsonb | Extern erreichbar? |
| 34 | `application legal criticality` | `assets.custom_fields.app_legal_criticality` | assets | jsonb | Rechtliche Einstufung |
| 35 | `application contact e-mail address` | `assets.custom_fields.app_contact_email` | assets | jsonb | App-Verantwortlicher |

---

## 3. Daten-Transformationsregeln

### 3.1 Asset-Typ Normalisierung

```typescript
const ASSET_TYPE_MAP: Record<string, AssetType> = {
  'workstation': 'workstation',
  'virtual server': 'virtual_server',
  'physical server': 'physical_server',
  'network device': 'network_device',
  'storage': 'storage',
};
```

### 3.2 Lifecycle-Status Normalisierung

```typescript
const LIFECYCLE_MAP: Record<string, LifecycleStage> = {
  'active': 'active',
  'retired': 'decommissioned',
  'in stock': 'in_stock',
  'missing': 'missing',
  'disposed': 'disposed',
};
```

### 3.3 Criticality Normalisierung

```typescript
const CRITICALITY_MAP: Record<string, Criticality> = {
  'critical': 'critical',
  'high': 'high',
  'medium': 'medium',
  'low': 'low',
  '': 'unclassified',  // Leere Felder → unclassified
};
```

### 3.4 Location-Objekt Aggregation

Drei CSV-Spalten werden zu einem `location`-Objekt zusammengeführt:

```typescript
function buildLocation(row: CsvRow): AssetLocation {
  return {
    name: row['data center name'] || null,
    city: row['data center city'] || null,
    country: row['data center country'] || null,
    // Deriviert aus data center name falls bekannt:
    type: row['data center name']?.includes('Atlas Edge') ? 'edge' : 'datacenter',
  };
}
```

### 3.5 Hardware-Info Aggregation

```typescript
function buildHardwareInfo(row: CsvRow): HardwareInfo {
  return {
    source_system: row['hwSourceSystem'] || null,
    manufacturer: row['asset manufacturer'] || null,
    model: row['asset model'] || null,
  };
}
```

---

## 4. Bekannte Datenqualitäts-Themen

| Problem | Betroffene Spalte | Häufigkeit | Behandlung |
|---------|-------------------|-----------|------------|
| Leere IP-Adressen | `ip address` | ~60% (Workstations) | `null` setzen, kein Fehler |
| Typo in Spaltenname | `thirdlevelsuppert` (statt support) | 100% | Im Parser als Alias behandeln |
| Leere Applikationsfelder | Spalten 26-35 | ~40% | `null` setzen, Assets trotzdem importieren |
| Komma in Modellnamen | `asset model` | ~5% | CSV-Parser muss Quoted Fields unterstützen |
| Inkonsistente E-Mail-Formate | Support-Spalten | ~10% | Normalisierung auf Lowercase |
| Fehlende KACE-ID | `id itsm tool` | ~2% | Fallback: FQDN als external_id |

---

## 5. Connector-Konfiguration (Template)

```typescript
// Quest KACE CSV Import Connector Konfiguration
const questKaceConfig: ConnectorConfig = {
  connectorId: 'csv-import-quest-kace',
  connectorType: 'csv-import',
  name: 'Quest KACE / PROTrack Asset-Import',
  enabled: true,
  config: {
    source: 'quest-kace',
    fileType: 'csv',
    encoding: 'utf-8',
    delimiter: ',',
    hasHeader: true,
    entityType: 'asset',
    fieldMapping: {
      // Pflichtfelder
      'hardware name': { target: 'name', required: true },
      'id itsm tool': { target: 'external_id', required: false, fallback: 'fqdn' },
      'asset type': { target: 'type', transform: 'ASSET_TYPE_MAP' },
      'ip address': { target: 'ip_address', required: false },
      'operating system & version': { target: 'os', required: false },
      'asset criticality': { target: 'criticality', transform: 'CRITICALITY_MAP' },
      'asset lifecycle status': { target: 'lifecycle_stage', transform: 'LIFECYCLE_MAP' },
      // Location-Gruppe
      'data center name': { target: 'location.name' },
      'data center city': { target: 'location.city' },
      'data center country': { target: 'location.country' },
      // Hardware-Info-Gruppe
      'asset manufacturer': { target: 'hardware_info.manufacturer' },
      'asset model': { target: 'hardware_info.model' },
      'hwSourceSystem': { target: 'hardware_info.source_system' },
      // Alle weiteren → tags / custom_fields (siehe Mapping oben)
    },
    deduplication: {
      strategy: 'external_id_or_fqdn',
      updateExisting: true,
    },
    validation: {
      requireName: true,
      requireType: true,
      warnOnEmptyIp: true,
    },
  },
  schedule: {
    type: 'manual',  // CSV-Import ist üblicherweise manuell
  },
};
```

---

## 6. Bekannte Teams & Verantwortlichkeiten (aus Echtdaten)

| Team / E-Mail | Rolle | Assets |
|--------------|-------|--------|
| `it_zrh@lhsystems.com` | 2nd/3rd Level Support, HW-Kontakt | Workstations, Basis-Infrastruktur |
| `pausanias@lhsystems.com` | 2nd/3rd Level Support | Applikations-Server |
| `lido.scrum.logistics@lhsystems.com` | App-Team | LSYFN Hermes Applications |
| `nav-data.standards@lhsystems.com` | App-Team | LSYFN Kairos Application |
| `lido.scrum.goat-data@lhsystems.com` | App-Team | Diverse App-Server |

---

## 7. Referenz: Bekannte Applikationen (erweitert aus n8n ProTack Mapping)

| Application Name | Application ID | Typ | Team |
|-----------------|---------------|-----|------|
| LSYFN Active Directory (LIDOZRH) | APP-17974 | Infrastruktur | it_zrh@ |
| LSYFN Kairos Application | APP-20390 | Business Application | lido.scrum.logistics@ |
| LSYFN Hermes Applications | APP-20360 | Business Application | lido.scrum.logistics@ |
| LSYFN AMDB Applications | APP-20237 | Business Application | lido.scrum.goat-data@ |
| LSYFN Norman | APP-20450 | Business Application | lido.scrum.goat-data@ |
| LSYFN Post Office | APP-21022 | Business Application | pausanias@ |

---

## 8. Zusätzliche Asset-Typen (aus n8n Workflows)

Das bestehende n8n PROTrack Workflow kennt zwei weitere Asset-Typen, die im SKYNEX Schema ergänzt werden müssen:

| Asset-Typ | Hostnamen-Prefix | Data Center |
|-----------|-----------------|-------------|
| `physical_server` | LIDOZRHS, ZRHSTG | LSYFN On premises |
| `network_device` | ZRHSTSW, ZRHBASW, ZRH-NG-FW | LSYFN Stelzenstrasse / BAS Datacenter |

---

## 9. Quellsystem-APIs (für zukünftigen KACE API-Connector P2)

| Endpunkt | Methode | Auth | Beschreibung |
|----------|---------|------|-------------|
| `/ams/shared/api/security/login` | POST | JSON Body (User/Pass) | Login → JWT Cookie |
| `/api/inventory/machines` | GET | JWT Bearer + Cookie | Alle Maschinen (Pagination: `paging=limit 0`) |
| `/api/asset/assets` | GET | JWT Bearer + Cookie | Alle Assets mit Custom Fields |

API Version: v14 (ab KACE 12.1+, kein CSRF Token mehr nötig)

**Siehe auch:** `docs/connector-references/n8n-workflows.md` für vollständige Workflow-Dokumentation.

---

*Dieses Dokument dient als verbindliche Referenz für die Implementierung des Quest KACE CSV-Import-Connectors in SKYNEX. Änderungen am CSV-Format müssen hier dokumentiert werden.*
