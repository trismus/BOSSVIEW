# BOSSVIEW — Namenskonzept Infrastruktur

**Projekt:** BOSSVIEW · LSYFN
**Version:** 2.0
**Erstellt:** 2026-04-07
**Autor:** Christian Stebler
**Compliance:** ISO 27001 · Luftfahrt-Industrie
**Status:** Entwurf — Review pending

---

## 1. Zielsetzung

Dieses Dokument definiert verbindliche Namenskonventionen für alle physischen und logischen Infrastruktur-Komponenten innerhalb der LSYFN-Umgebung. Einheitliche Benennung gewährleistet: eindeutige Identifikation in Audits (ISO 27001 A.8), konsistente Darstellung in BOSSVIEW, klare Zuordnung bei Incidents und Changes, sowie Nachvollziehbarkeit über alle Standorte hinweg.

---

## 2. Firmen-Prefix

Alle LSYFN-Geräte tragen das Firmen-Prefix **`lido`** (Kleinbuchstaben). Dieses Prefix identifiziert das Gerät eindeutig als LSYFN-Asset und wird bei Workstations direkt vorangestellt. Bei Netzwerk-Geräten und Servern wird stattdessen der Standort-Code als Prefix verwendet (siehe Abschnitte 5 und 6).

---

## 3. Standort-Codes

Jeder Standort hat einen etablierten Code. Bei Workstations wird der Code in Kleinbuchstaben nach dem `lido`-Prefix eingefügt. Bei Netzwerk-Geräten wird der Code in Grossbuchstaben als Prefix verwendet.

| Code | Standort | Typ | Verwendung |
|------|----------|-----|------------|
| ZRH | Zürich | Region | Übergeordnet für alle Zürcher Standorte |
| STS | Stelzenstrasse, Zürich | Office / HQ | Büro-Standort |
| BAS | Baslerstrasse, Zürich | Datacenter | Rechenzentrum |
| PCT | Princeton, NJ, USA | Office | US-Standort |

Weitere Standorte (FRA, AMS, SIN, HKG, NYC, DXB) werden bei Bedarf nach dem gleichen Schema ergänzt.

**Hierarchie:** ZRH ist die Region, STS und BAS sind beide Standorte innerhalb von Zürich. Das spiegelt sich in den Netzwerk-Gerätenamen wider: `ZRHSTS` = Region Zürich + Standort Stelzenstrasse, `ZRHBAS` = Region Zürich + Standort Baslerstrasse.

---

## 4. Workstations (bereits umgesetzt)

### 4.1 Schema

```
lido{standort}{gerätetyp}{sequenz}
```

Alles Kleinbuchstaben, keine Trennzeichen, Sequenz 3-stellig (xxx).

### 4.2 Gerätetyp-Kürzel

| Kürzel | Bedeutung | Beispiel |
|--------|-----------|---------|
| l | Laptop (Windows/Linux) | lidozrhlxxx |
| a | Desktop | lidozrhaxxx |
| m | Mac (MacBook / iMac) | lidozrhmxxx |

### 4.3 Beispiele

| Name | Auflösung |
|------|-----------|
| `lidozrhl001` | LSYFN · Zürich · Laptop · #001 |
| `lidozrha042` | LSYFN · Zürich · Desktop · #042 |
| `lidozrhm015` | LSYFN · Zürich · Mac · #015 |
| `lidopctm003` | LSYFN · Princeton · Mac · #003 |
| `lidopctl017` | LSYFN · Princeton · Laptop · #017 |

### 4.4 Standort-Zuordnung

Alle `lidozrh`-Geräte stehen am Standort **Stelzenstrasse (STS)**. Alle `lidopct`-Geräte stehen am Standort **Princeton (PCT)**.

Sollte es innerhalb einer Region mehrere Bürostandorte mit Workstations geben, wird der spezifischere Standort-Code verwendet (z.B. `lidosts` statt `lidozrh`). Aktuell ist das nicht notwendig, da ZRH nur einen Bürostandort hat.

---

## 5. Netzwerk-Geräte (bereits umgesetzt)

### 5.1 Schema

```
{REGION}{STANDORT}{sequenz}
```

Grossbuchstaben, keine Trennzeichen, Sequenz 2–3-stellig.

### 5.2 Beispiele

| Name | Auflösung |
|------|-----------|
| `ZRHSTS001` | Zürich · Stelzenstrasse · Gerät #001 |
| `ZRHSTS002` | Zürich · Stelzenstrasse · Gerät #002 |
| `ZRHBAS01` | Zürich · Baslerstrasse DC · Gerät #01 |
| `ZRHBAS02` | Zürich · Baslerstrasse DC · Gerät #02 |

### 5.3 Erweiterungsvorschlag: Gerätetyp einfügen

Das aktuelle Schema ist kompakt, lässt aber den Gerätetyp nicht erkennen. Für bessere Lesbarkeit in BOSSVIEW und bei Audits wird empfohlen, nach dem Standort ein Typ-Kürzel einzufügen:

```
{REGION}{STANDORT}-{TYP}{SEQUENZ}
```

| Typ-Kürzel | Bedeutung |
|------------|-----------|
| FW | Firewall |
| CS | Core Switch |
| AS | Access Switch |
| TS | Top-of-Rack Switch |
| MS | Management Switch |
| RT | Router |
| AP | Access Point |

**Beispiele mit Typ-Kürzel:**

| Aktuell | Vorschlag | Beschreibung |
|---------|-----------|-------------|
| ZRHSTS001 | ZRHSTS-FW01 | Firewall Stelzenstrasse #01 |
| ZRHSTS002 | ZRHSTS-CS01 | Core Switch Stelzenstrasse #01 |
| ZRHSTS003 | ZRHSTS-AS01 | Access Switch Stelzenstrasse #01 |
| ZRHBAS01 | ZRHBAS-FW01 | Firewall Baslerstrasse DC #01 |
| ZRHBAS02 | ZRHBAS-FW02 | Firewall Baslerstrasse DC #02 (HA-Peer) |
| ZRHBAS03 | ZRHBAS-CS01 | Core Switch Baslerstrasse DC #01 |
| — | ZRHBAS-TS01 | Top-of-Rack Switch Baslerstrasse DC #01 |

**Entscheidung offen:** Soll das Typ-Kürzel eingeführt werden, oder bleibt das rein sequentielle Schema bestehen? → Review mit Christian.

---

## 6. Server (bereits umgesetzt)

Server folgen dem gleichen `LIDO`-Prefix-Schema wie Workstations, aber in Grossbuchstaben. Der Typ-Buchstabe unterscheidet physische von virtuellen Servern.

### 6.1 Schema

```
LIDO{STANDORT}{TYP}{SEQUENZ}
```

### 6.2 Typ-Kürzel

| Kürzel | Bedeutung | Beispiel |
|--------|-----------|---------|
| S | Physischer Server | LIDOZRHS01 |
| V | Virtueller Server (VM) | LIDOZRHV001 |

### 6.3 Beispiele

| Name | Auflösung |
|------|-----------|
| `LIDOZRHV001` | LSYFN · Zürich · VM · #001 |
| `LIDOZRHV002` | LSYFN · Zürich · VM · #002 |
| `LIDOZRHS01` | LSYFN · Zürich · Physischer Server · #01 |
| `LIDOZRHS02` | LSYFN · Zürich · Physischer Server · #02 |
| `LIDOBASV001` | LSYFN · Baslerstrasse DC · VM · #001 |
| `LIDOBASS01` | LSYFN · Baslerstrasse DC · Physischer Server · #01 |
| `LIDOPCTV001` | LSYFN · Princeton · VM · #001 |

### 6.4 Sequenz-Konvention

Physische Server verwenden 2-stellige Sequenzen (01–99), da die Anzahl typischerweise überschaubar ist. Virtuelle Server verwenden 3-stellige Sequenzen (001–999), da hier deutlich mehr Assets zu erwarten sind.

### 6.5 Standort-Zuordnung

Virtuelle Server laufen physisch im Datacenter, tragen aber den Standort-Code des Standorts dem sie logisch zugeordnet sind. Beispiel: Eine VM die für das Büro Stelzenstrasse betrieben wird heisst `LIDOZRHV012`, auch wenn sie physisch im BAS-Datacenter läuft. VMs die direkt dem Datacenter zugeordnet sind heissen `LIDOBASV001`.

**Offene Frage:** Soll bei Servern zusätzlich zwischen STS und BAS unterschieden werden (z.B. `LIDOSTSV001` vs. `LIDOBASV001`), oder reicht ZRH als Standort-Code für alles in der Region Zürich?

---

## 7. Storage

### 7.1 Schema (Vorschlag)

```
{REGION}{STANDORT}-{TYP}{SEQUENZ}
```

| Typ | Bedeutung |
|-----|-----------|
| SAN | Storage Area Network |
| NAS | Network Attached Storage |

**Beispiele:**

| Name | Auflösung |
|------|-----------|
| `ZRHBAS-SAN01` | Baslerstrasse DC · SAN #01 |
| `ZRHBAS-SAN02` | Baslerstrasse DC · SAN #02 |
| `ZRHSTS-NAS01` | Stelzenstrasse · NAS #01 |

---

## 8. Racks

### 8.1 Schema (Vorschlag)

```
{REGION}{STANDORT}-RK-{REIHE}{POSITION}
```

**Beispiele:**

| Name | Anzeigename in BOSSVIEW | Standort |
|------|------------------------|----------|
| `ZRHSTS-RK-A1` | Rack A1 — Network | Stelzenstrasse |
| `ZRHSTS-RK-A2` | Rack A2 — Compute | Stelzenstrasse |
| `ZRHBAS-RK-B1` | Rack B1 — Network Core | Baslerstrasse DC |
| `ZRHBAS-RK-B2` | Rack B2 — Compute | Baslerstrasse DC |
| `ZRHBAS-RK-B3` | Rack B3 — Storage | Baslerstrasse DC |

In BOSSVIEW wird der technische Name als ID verwendet und der Anzeigename als beschreibendes Label daneben angezeigt.

---

## 9. VLANs

### 9.1 Nummern-Schema

VLAN-Nummern sind standortübergreifend in Funktionsblöcken organisiert. Pro Standort wird ein Hunderter-Block zugewiesen:

| Standort | VLAN-Block |
|----------|-----------|
| STS (Stelzenstrasse) | 10–99 |
| BAS (Baslerstrasse DC) | 100–199 |
| PCT (Princeton) | 200–299 |

### 9.2 Funktionszuordnung (Einerstelle)

| Einerstelle | Funktion |
|------------|----------|
| x0–x9 | Management / Out-of-Band |
| x10–x19 | — (reserviert, fällt in den 10er-Block) |
| x20–x29 | Production / Server |
| x30–x39 | DMZ |
| x40–x49 | Guest / IoT / BYOD |
| x50–x59 | VoIP / UC |
| x60–x69 | Backup / Replikation |
| x70–x79 | Storage (iSCSI, NFS, IPMI) |
| x80–x89 | Monitoring / Logging |
| x90–x99 | Reserved |

### 9.3 Beispiele

| VLAN | Name | Standort |
|------|------|----------|
| 10 | STS Management | Stelzenstrasse |
| 20 | STS Production | Stelzenstrasse |
| 30 | STS DMZ | Stelzenstrasse |
| 40 | STS Guest/IoT | Stelzenstrasse |
| 50 | STS VoIP | Stelzenstrasse |
| 110 | BAS Management | Baslerstrasse DC |
| 120 | BAS Production | Baslerstrasse DC |
| 130 | BAS DMZ | Baslerstrasse DC |
| 160 | BAS Backup/DR | Baslerstrasse DC |
| 170 | BAS Storage/IPMI | Baslerstrasse DC |

BOSSVIEW-Anzeigename: `VLAN 120 — BAS Production`

---

## 10. Subnetze / IP-Bereiche

### 10.1 Schema

```
10.{STANDORT-OKTETT}.{VLAN-ID}.0/24
```

| Standort | 2. Oktett |
|----------|-----------|
| STS | 1 |
| BAS | 2 |
| PCT | 3 |

### 10.2 Beispiele

| Subnetz | VLAN | Standort |
|---------|------|----------|
| 10.1.10.0/24 | VLAN 10 — STS Management | Stelzenstrasse |
| 10.1.20.0/24 | VLAN 20 — STS Production | Stelzenstrasse |
| 10.2.110.0/24 | VLAN 110 — BAS Management | Baslerstrasse DC |
| 10.2.120.0/24 | VLAN 120 — BAS Production | Baslerstrasse DC |
| 10.3.210.0/24 | VLAN 210 — PCT Management | Princeton |

### 10.3 Reservierte Host-Adressen

| Adresse | Reservierung |
|---------|-------------|
| .1 | Default Gateway / Firewall |
| .2–.9 | Netzwerk-Geräte (Switches, Router) |
| .10–.19 | Management-IPs |
| .50–.99 | Server |
| .100–.199 | Clients / Endpoints |
| .200–.249 | DHCP-Range |
| .250–.254 | Reserved |

---

## 11. WAN-Links / Standortverbindungen

### 11.1 Schema (Vorschlag)

```
WAN-{VON}-{NACH}-{TYP}
```

Typen: `PRI` (Primary), `SEC` (Secondary), `BAK` (Backup).

**Beispiele:** `WAN-ZRH-FRA-PRI`, `WAN-ZRH-PCT-PRI`, `WAN-ZRH-SIN-BAK`

---

## 12. UPS / PDU / Infrastruktur

### 12.1 Schema (Vorschlag)

```
{REGION}{STANDORT}-{TYP}{SEQUENZ}
```

| Typ | Bedeutung |
|-----|-----------|
| UPS | Unterbrechungsfreie Stromversorgung |
| PDU | Power Distribution Unit |
| KVM | KVM Switch |

**Beispiele:** `ZRHBAS-UPS01`, `ZRHBAS-UPS02`, `ZRHSTS-UPS01`, `ZRHBAS-PDU01`

---

## 13. Zusammenfassung: Schema-Übersicht

| Kategorie | Prefix | Schema | Beispiel | Status |
|-----------|--------|--------|---------|--------|
| Workstation Laptop | LIDO | `lido{standort}l{xxx}` | `lidozrhl001` | Umgesetzt |
| Workstation Desktop | LIDO | `lido{standort}a{xxx}` | `lidozrha042` | Umgesetzt |
| Workstation Mac | LIDO | `lido{standort}m{xxx}` | `lidopctm003` | Umgesetzt |
| Physischer Server | LIDO | `LIDO{STANDORT}S{xx}` | `LIDOZRHS01` | Umgesetzt |
| Virtueller Server | LIDO | `LIDO{STANDORT}V{xxx}` | `LIDOZRHV001` | Umgesetzt |
| Netzwerk-Gerät | Standort | `{REGION}{STANDORT}{xxx}` | `ZRHSTS001` | Umgesetzt |
| Netzwerk (erweitert) | Standort | `{REGION}{STANDORT}-{TYP}{xx}` | `ZRHSTS-FW01` | Vorschlag |
| Storage | Standort | `{REGION}{STANDORT}-{TYP}{xx}` | `ZRHBAS-SAN01` | Vorschlag |
| Rack | Standort | `{REGION}{STANDORT}-RK-{REIHE}{POS}` | `ZRHBAS-RK-B1` | Vorschlag |
| UPS/PDU | Standort | `{REGION}{STANDORT}-{TYP}{xx}` | `ZRHBAS-UPS01` | Vorschlag |
| VLAN | — | `VLAN {NR} — {STANDORT} {FUNKTION}` | `VLAN 120 — BAS Production` | Vorschlag |
| WAN-Link | — | `WAN-{VON}-{NACH}-{TYP}` | `WAN-ZRH-FRA-PRI` | Vorschlag |

### Zwei Naming-Familien

Das Gesamtschema besteht aus zwei konsistenten Familien:

**Familie 1 — LIDO-Prefix (Endgeräte & Server):** Alle Assets die im CMDB/JAMF/KACE als Einzelgeräte verwaltet werden. Kleinbuchstaben bei Workstations, Grossbuchstaben bei Servern. Typ = einzelner Buchstabe (l, a, m, S, V).

**Familie 2 — Standort-Prefix (Netzwerk & Infrastruktur):** Alle Geräte die primär über ihre Netzwerk-Funktion und ihren Standort identifiziert werden. Grossbuchstaben, Region+Standort als Prefix.

---

## 14. Offene Entscheidungen

| # | Thema | Optionen | Entscheidung |
|---|-------|----------|-------------|
| 1 | Netzwerk-Geräte Typ-Kürzel | Einführen (ZRHSTS-FW01) vs. Status quo (ZRHSTS001) | Pending |
| 2 | Server Standort-Granularität | LIDOZRH (Region) vs. LIDOSTS/LIDOBAS (Standort) | Pending |
| 3 | Storage/UPS Naming-Familie | Familie 1 (LIDO-Prefix) vs. Familie 2 (Standort-Prefix) | Pending |
| 4 | Weitere Standorte | Codes für FRA, AMS, SIN, HKG, NYC, DXB definieren | Pending |
| 5 | Bestehende Geräte umbenennen | Ja (Change Requests) vs. nur neue Geräte | Pending |

---

## 15. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|----------|
| 1.0 | 2026-04-07 | Christian Stebler | Initiale Version (Draft) |
| 2.0 | 2026-04-07 | Christian Stebler | Komplett überarbeitet basierend auf bestehendem lido/ZRHSTS-Schema |
| 2.1 | 2026-04-07 | Christian Stebler | Server-Schema ergänzt: LIDOZRHV (VM) und LIDOZRHS (physisch) als umgesetzt dokumentiert |
