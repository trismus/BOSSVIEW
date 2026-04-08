# BOSSVIEW — Projektkontext für Claude Code

## Projekt

BOSSVIEW ist eine Browser-basierte IT-Infrastruktur-Management-Plattform für LSYFN (Lufthansa Systems FlightNav AG). Das Projekt unterliegt ISO 27001 und Luftfahrt-Industrie-Compliance.

## Tech-Stack

- Frontend: React + TypeScript, Vite, Chart.js, D3.js
- Backend: Node.js + Express.js
- Datenbank: PostgreSQL 16 + Redis 7
- Deployment: Docker Compose
- Design: Dark "Mission Control" Theme (Cyan/Blue Akzente, DM Sans + JetBrains Mono)

## Namenskonzept (VERBINDLICH)

Vollständige Dokumentation: `NAMING_CONVENTION.md`

### Zwei Naming-Familien

**Familie 1 — LIDO-Prefix** (Endgeräte & Server):
Alles was im CMDB als Asset verwaltet wird.

**Familie 2 — Standort-Prefix** (Netzwerk & Infrastruktur):
Alles was über Netzwerk-Funktion identifiziert wird.

### Standorte

| Code | Standort | Stadt |
|------|----------|-------|
| ZRH | Region Zürich | Zürich (übergeordnet) |
| STS | Stelzenstrasse | Zürich — Office/HQ |
| BAS | Baslerstrasse | Zürich — Datacenter |
| PCT | Princeton | New Jersey, USA — Office |

**WICHTIG:** STS und BAS sind BEIDE in Zürich. BAS = Baslerstrasse (NICHT Basel).

### Parsing-Regeln für Gerätenamen

#### Workstations: `lido{standort}{typ}{sequenz}`

Kleinbuchstaben, keine Trennzeichen.

```
lidozrhl001  → Standort: STS (Stelzenstrasse), Typ: Laptop,  Seq: 001
lidozrha042  → Standort: STS (Stelzenstrasse), Typ: Desktop, Seq: 042
lidozrhm015  → Standort: STS (Stelzenstrasse), Typ: Mac,     Seq: 015
lidopctm003  → Standort: PCT (Princeton),      Typ: Mac,     Seq: 003
lidopctl017  → Standort: PCT (Princeton),      Typ: Laptop,  Seq: 017
```

Typ-Buchstaben: `l` = Laptop, `a` = Desktop, `m` = Mac

**Regel:** Alle `lidozrh`-Geräte stehen physisch an der Stelzenstrasse (STS).

#### Server: `LIDO{STANDORT}{TYP}{SEQUENZ}`

Grossbuchstaben, keine Trennzeichen.

```
LIDOZRHV001  → Standort: ZRH, Typ: Virtueller Server, Seq: 001
LIDOZRHS01   → Standort: ZRH, Typ: Physischer Server, Seq: 01
LIDOBASV001  → Standort: BAS, Typ: Virtueller Server, Seq: 001
LIDOBASS01   → Standort: BAS, Typ: Physischer Server, Seq: 01
```

Typ-Buchstaben: `V` = Virtuell (3-stellige Seq), `S` = Physisch (2-stellige Seq)

#### Netzwerk-Geräte: `{REGION}{STANDORT}{SEQUENZ}`

Grossbuchstaben, keine Trennzeichen.

```
ZRHSTS001  → Region: ZRH, Standort: STS (Stelzenstrasse), Seq: 001
ZRHSTS002  → Region: ZRH, Standort: STS (Stelzenstrasse), Seq: 002
ZRHBAS01   → Region: ZRH, Standort: BAS (Baslerstrasse),  Seq: 01
ZRHBAS02   → Region: ZRH, Standort: BAS (Baslerstrasse),  Seq: 02
```

### Regex-Patterns für Parsing

```javascript
// Workstations
/^lido(zrh|pct|bas|sts)([lamw])(\d{3})$/i

// Server
/^LIDO(ZRH|BAS|PCT|STS)([VS])(\d{2,3})$/

// Netzwerk-Geräte
/^(ZRH)(STS|BAS)(\d{2,3})$/
```

### Standort-Auflösung (Name → Location)

```javascript
const LOCATION_MAP = {
  // Workstation-Standorte (nach lido-prefix)
  'zrh': { location: 'STS', fullName: 'Stelzenstrasse', city: 'Zürich', type: 'office' },
  'pct': { location: 'PCT', fullName: 'Princeton',      city: 'Princeton, NJ', type: 'office' },
  'bas': { location: 'BAS', fullName: 'Baslerstrasse',  city: 'Zürich', type: 'datacenter' },
  'sts': { location: 'STS', fullName: 'Stelzenstrasse', city: 'Zürich', type: 'office' },

  // Netzwerk-Standorte (nach Region-Prefix)
  'ZRHSTS': { location: 'STS', fullName: 'Stelzenstrasse', city: 'Zürich', type: 'office' },
  'ZRHBAS': { location: 'BAS', fullName: 'Baslerstrasse',  city: 'Zürich', type: 'datacenter' },
};

const DEVICE_TYPES = {
  // Workstation-Typen
  'l': 'Laptop',
  'a': 'Desktop',
  'm': 'Mac',
  // Server-Typen
  'V': 'Virtual Server',
  'S': 'Physical Server',
};
```

## VLAN-Bereiche

| Standort | Block | Beispiel |
|----------|-------|---------|
| STS | 10–99 | VLAN 10 = STS Management |
| BAS | 100–199 | VLAN 120 = BAS Production |
| PCT | 200–299 | VLAN 210 = PCT Management |

Funktionszuordnung (Einerstelle): x0=Management, x20=Production, x30=DMZ, x40=Guest, x50=VoIP, x60=Backup, x70=Storage, x80=Monitoring.

## IP-Schema

```
10.{Standort-Oktett}.{VLAN-ID}.{Host}/24
```

Standort-Oktett: STS=1, BAS=2, PCT=3

## Naming-Modul im Code

Das zentrale Utility-Modul liegt unter `src/shared/naming/namingConvention.js`. Es wird von Frontend UND Backend importiert.

```javascript
// Import in jeder Komponente / jedem Service:
import { parseDeviceName, resolveLocation, validateName, generateName } from '@shared/naming';

// Beispiel: Gerätename → Standort
resolveLocation('lidozrhl001');    // → 'STS'
resolveLocation('LIDOZRHV042');    // → 'ZRH'
resolveLocation('ZRHBAS01');       // → 'BAS'

// Beispiel: Name generieren
generateName({ category: 'workstation', locationCode: 'ZRH', typeCode: 'l', sequence: 42 });
// → 'lidozrhl042'

// Beispiel: VLAN auflösen
resolveVlan(120);  // → { locationCode: 'BAS', functionName: 'Production', vlanId: 120 }
```

**Wichtig für Claude Code:** Wenn du Code schreibst der Gerätenamen verarbeitet, importiere IMMER aus `@shared/naming` statt die Logik zu duplizieren.

## Projektstruktur

Siehe `PROJECT_STRUCTURE.md` für die vollständige Ordnerstruktur. Schlüssel-Pfade:

- `src/shared/naming/` — Naming-Logik (Parser, Validator, Generator)
- `src/frontend/pages/` — React-Seiten (InfrastructureMap, NamingConventionManager, ...)
- `src/backend/routes/` — Express API-Routes
- `src/backend/db/migrations/` — Knex DB-Migrationen

## Compliance-Anforderungen

- ISO 27001: Append-Only Audit-Trail, RBAC, AES-256 Verschlüsselung
- Luftfahrt: Vollständige Nachvollziehbarkeit aller Änderungen
- Jede Namensänderung erfordert einen Change Request
