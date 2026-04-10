/**
 * SKYNEX — Naming Convention Module
 *
 * Zentrale Logik für das LSYFN-Namensschema.
 * Wird von Frontend UND Backend importiert.
 *
 * Verwendung:
 *   import { parseDeviceName, resolveLocation, validateName, generateName } from '@shared/naming';
 */

// ═══════════════════════════════════════════════════════════════
// KONSTANTEN
// ═══════════════════════════════════════════════════════════════

/** Firmen-Prefix für alle LSYFN-Assets */
export const COMPANY_PREFIX = 'lido';

/** Standort-Definitionen */
export const LOCATIONS = {
  ZRH: { code: 'ZRH', name: 'Region Zürich',   fullName: 'Zürich',         city: 'Zürich',        type: 'region' },
  STS: { code: 'STS', name: 'Stelzenstrasse',   fullName: 'Stelzenstrasse', city: 'Zürich',        type: 'office' },
  BAS: { code: 'BAS', name: 'Baslerstrasse',    fullName: 'Baslerstrasse',  city: 'Zürich',        type: 'datacenter' },
  PCT: { code: 'PCT', name: 'Princeton',        fullName: 'Princeton',      city: 'Princeton, NJ', type: 'office' },
};

/**
 * Mapping: Workstation-Standort-Code → physischer Standort
 * WICHTIG: lidozrh-Geräte stehen physisch an der Stelzenstrasse (STS)
 */
export const WORKSTATION_LOCATION_MAP = {
  zrh: 'STS',
  sts: 'STS',
  bas: 'BAS',
  pct: 'PCT',
};

/** Gerätetyp-Definitionen */
export const DEVICE_TYPES = {
  // Workstations (Kleinbuchstabe)
  l: { code: 'l', name: 'Laptop',           family: 'workstation', caseRule: 'lower', seqLength: 3 },
  a: { code: 'a', name: 'Desktop',          family: 'workstation', caseRule: 'lower', seqLength: 3 },
  m: { code: 'm', name: 'Mac',              family: 'workstation', caseRule: 'lower', seqLength: 3 },
  // Server (Grossbuchstabe)
  V: { code: 'V', name: 'Virtual Server',   family: 'server',      caseRule: 'upper', seqLength: 3 },
  S: { code: 'S', name: 'Physical Server',  family: 'server',      caseRule: 'upper', seqLength: 2 },
};

/** VLAN-Blöcke pro Standort */
export const VLAN_BLOCKS = {
  STS: { start: 10,  end: 99 },
  BAS: { start: 100, end: 199 },
  PCT: { start: 200, end: 299 },
};

/** VLAN-Funktionen (Offset innerhalb des Blocks) */
export const VLAN_FUNCTIONS = {
  0:  'Management',
  20: 'Production',
  30: 'DMZ',
  40: 'Guest/IoT',
  50: 'VoIP/UC',
  60: 'Backup',
  70: 'Storage/IPMI',
  80: 'Monitoring',
};

/** IP-Schema: 2. Oktett pro Standort */
export const IP_OCTETS = {
  STS: 1,
  BAS: 2,
  PCT: 3,
};

// ═══════════════════════════════════════════════════════════════
// REGEX PATTERNS
// ═══════════════════════════════════════════════════════════════

export const PATTERNS = {
  /** Workstation: lido{standort}{typ}{seq} — Kleinbuchstaben */
  workstation: /^lido(zrh|pct|bas|sts)([lam])(\d{3})$/i,

  /** Server: LIDO{STANDORT}{TYP}{SEQ} — Grossbuchstaben */
  server: /^LIDO(ZRH|BAS|PCT|STS)([VS])(\d{2,3})$/,

  /** Netzwerk: {REGION}{STANDORT}{SEQ} — Grossbuchstaben */
  network: /^(ZRH)(STS|BAS)(\d{2,3})$/,
};

// ═══════════════════════════════════════════════════════════════
// PARSER
// ═══════════════════════════════════════════════════════════════

/**
 * Zerlegt einen Gerätenamen in seine Bestandteile.
 *
 * @param {string} name - Der zu parsende Gerätename
 * @returns {Object} Parsed result mit { valid, family, category, locationCode, resolvedLocation, deviceType, ... }
 *
 * @example
 *   parseDeviceName('lidozrhl001')
 *   // → { valid: true, family: 'lido', category: 'workstation', locationCode: 'ZRH',
 *   //     resolvedLocation: 'STS', resolvedName: 'Stelzenstrasse', city: 'Zürich',
 *   //     deviceType: 'Laptop', typeCode: 'l', sequence: '001' }
 *
 *   parseDeviceName('LIDOZRHV042')
 *   // → { valid: true, family: 'lido', category: 'server', locationCode: 'ZRH',
 *   //     deviceType: 'Virtual Server', typeCode: 'V', sequence: '042' }
 *
 *   parseDeviceName('ZRHSTS003')
 *   // → { valid: true, family: 'location', category: 'network', locationCode: 'STS',
 *   //     resolvedName: 'Stelzenstrasse', sequence: '003' }
 */
export function parseDeviceName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, name, error: 'Kein gültiger Name' };
  }

  const trimmed = name.trim();

  // ── Workstation ──
  const wsMatch = trimmed.match(PATTERNS.workstation);
  if (wsMatch) {
    const [, locCode, typeCode, seq] = wsMatch;
    const locUpper = locCode.toUpperCase();
    const resolvedLoc = WORKSTATION_LOCATION_MAP[locCode.toLowerCase()];
    const location = LOCATIONS[resolvedLoc] || LOCATIONS[locUpper];
    const deviceType = DEVICE_TYPES[typeCode.toLowerCase()];

    return {
      valid: true,
      name: trimmed,
      family: 'lido',
      category: 'workstation',
      prefix: COMPANY_PREFIX,
      locationCode: locUpper,
      resolvedLocation: resolvedLoc || locUpper,
      resolvedName: location?.fullName || locCode,
      city: location?.city || '?',
      locationType: location?.type || '?',
      deviceType: deviceType?.name || typeCode,
      typeCode: typeCode.toLowerCase(),
      sequence: seq,
      sequenceNum: parseInt(seq, 10),
    };
  }

  // ── Server ──
  const srvMatch = trimmed.match(PATTERNS.server);
  if (srvMatch) {
    const [, locCode, typeCode, seq] = srvMatch;
    const location = LOCATIONS[locCode];
    const deviceType = DEVICE_TYPES[typeCode];

    return {
      valid: true,
      name: trimmed,
      family: 'lido',
      category: 'server',
      prefix: COMPANY_PREFIX.toUpperCase(),
      locationCode: locCode,
      resolvedLocation: locCode,
      resolvedName: location?.fullName || locCode,
      city: location?.city || '?',
      locationType: location?.type || '?',
      deviceType: deviceType?.name || typeCode,
      typeCode,
      sequence: seq,
      sequenceNum: parseInt(seq, 10),
    };
  }

  // ── Netzwerk ──
  const netMatch = trimmed.match(PATTERNS.network);
  if (netMatch) {
    const [, region, siteCode, seq] = netMatch;
    const location = LOCATIONS[siteCode];

    return {
      valid: true,
      name: trimmed,
      family: 'location',
      category: 'network',
      prefix: region + siteCode,
      locationCode: siteCode,
      region,
      resolvedLocation: siteCode,
      resolvedName: location?.fullName || siteCode,
      city: location?.city || '?',
      locationType: location?.type || '?',
      deviceType: 'Netzwerk-Gerät',
      typeCode: 'NET',
      sequence: seq,
      sequenceNum: parseInt(seq, 10),
    };
  }

  return {
    valid: false,
    name: trimmed,
    error: `"${trimmed}" entspricht keinem bekannten Namensschema (Workstation, Server oder Netzwerk).`,
  };
}

// ═══════════════════════════════════════════════════════════════
// LOCATION RESOLVER
// ═══════════════════════════════════════════════════════════════

/**
 * Löst einen Gerätenamen direkt zu einem Standort auf.
 * Shortcut für parseDeviceName(name).resolvedLocation.
 *
 * @param {string} name - Gerätename
 * @returns {string|null} Standort-Code (z.B. 'STS', 'BAS', 'PCT') oder null
 */
export function resolveLocation(name) {
  const result = parseDeviceName(name);
  return result.valid ? result.resolvedLocation : null;
}

/**
 * Löst einen Gerätenamen zu vollständigen Standort-Informationen auf.
 *
 * @param {string} name - Gerätename
 * @returns {Object|null} Location-Objekt oder null
 */
export function resolveLocationDetails(name) {
  const result = parseDeviceName(name);
  if (!result.valid) return null;
  return LOCATIONS[result.resolvedLocation] || null;
}

// ═══════════════════════════════════════════════════════════════
// VALIDATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Prüft ob ein Name dem Namensschema entspricht.
 *
 * @param {string} name - Zu prüfender Name
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateName(name) {
  const errors = [];
  const result = parseDeviceName(name);

  if (!result.valid) {
    errors.push(result.error);
    return { valid: false, errors };
  }

  // Sequenz-Länge prüfen
  if (result.category === 'workstation') {
    const dt = DEVICE_TYPES[result.typeCode];
    if (dt && result.sequence.length !== dt.seqLength) {
      errors.push(`Sequenz sollte ${dt.seqLength}-stellig sein, ist aber ${result.sequence.length}-stellig.`);
    }
  }

  if (result.category === 'server') {
    const dt = DEVICE_TYPES[result.typeCode];
    if (dt && result.sequence.length !== dt.seqLength) {
      errors.push(`Sequenz sollte ${dt.seqLength}-stellig sein (${dt.name}), ist aber ${result.sequence.length}-stellig.`);
    }
  }

  // Case-Rule prüfen
  if (result.category === 'workstation' && name !== name.toLowerCase()) {
    errors.push('Workstation-Namen müssen komplett in Kleinbuchstaben sein.');
  }
  if (result.category === 'server' && !name.startsWith('LIDO')) {
    errors.push('Server-Namen müssen mit "LIDO" in Grossbuchstaben beginnen.');
  }
  if (result.category === 'network' && name !== name.toUpperCase()) {
    errors.push('Netzwerk-Gerätenamen müssen komplett in Grossbuchstaben sein.');
  }

  return { valid: errors.length === 0, errors, parsed: result };
}

// ═══════════════════════════════════════════════════════════════
// NAME GENERATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Generiert einen Gerätenamen basierend auf den Parametern.
 *
 * @param {Object} params
 * @param {'workstation'|'server'|'network'} params.category
 * @param {string} params.locationCode - z.B. 'ZRH', 'BAS', 'PCT'
 * @param {string} params.typeCode - z.B. 'l', 'a', 'm', 'V', 'S'
 * @param {number} params.sequence - Sequenznummer
 * @returns {string} Generierter Name
 *
 * @example
 *   generateName({ category: 'workstation', locationCode: 'ZRH', typeCode: 'l', sequence: 42 })
 *   // → 'lidozrhl042'
 *
 *   generateName({ category: 'server', locationCode: 'BAS', typeCode: 'V', sequence: 7 })
 *   // → 'LIDOBASV007'
 */
export function generateName({ category, locationCode, typeCode, sequence, region = 'ZRH' }) {
  const dt = DEVICE_TYPES[typeCode];
  const seqLen = dt?.seqLength || 3;
  const seqStr = String(sequence).padStart(seqLen, '0');

  switch (category) {
    case 'workstation':
      return `${COMPANY_PREFIX}${locationCode.toLowerCase()}${typeCode.toLowerCase()}${seqStr}`;
    case 'server':
      return `${COMPANY_PREFIX.toUpperCase()}${locationCode.toUpperCase()}${typeCode.toUpperCase()}${seqStr}`;
    case 'network':
      return `${region}${locationCode}${seqStr}`;
    default:
      throw new Error(`Unbekannte Kategorie: ${category}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// VLAN HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Berechnet die VLAN-Nummer für einen Standort und eine Funktion.
 *
 * @param {string} locationCode - z.B. 'STS', 'BAS'
 * @param {number} functionOffset - z.B. 0 (Management), 20 (Production)
 * @returns {number|null} VLAN-Nummer oder null wenn ungültig
 */
export function getVlanNumber(locationCode, functionOffset) {
  const block = VLAN_BLOCKS[locationCode];
  if (!block) return null;
  const vlan = block.start + functionOffset;
  return vlan <= block.end ? vlan : null;
}

/**
 * Löst eine VLAN-Nummer zu Standort und Funktion auf.
 *
 * @param {number} vlanId - VLAN-Nummer
 * @returns {{ locationCode: string, functionName: string, vlanId: number }|null}
 */
export function resolveVlan(vlanId) {
  for (const [locCode, block] of Object.entries(VLAN_BLOCKS)) {
    if (vlanId >= block.start && vlanId <= block.end) {
      const offset = vlanId - block.start;
      // Finde nächste passende Funktion (exakt oder nächst-niedrigere)
      const funcOffsets = Object.keys(VLAN_FUNCTIONS).map(Number).sort((a, b) => a - b);
      let matchedOffset = funcOffsets[0];
      for (const fo of funcOffsets) {
        if (fo <= offset) matchedOffset = fo;
        else break;
      }
      return {
        locationCode: locCode,
        locationName: LOCATIONS[locCode]?.fullName || locCode,
        functionName: VLAN_FUNCTIONS[matchedOffset] || 'Unknown',
        functionOffset: matchedOffset,
        vlanId,
      };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// IP HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Generiert das Subnetz für einen Standort und ein VLAN.
 * Schema: 10.{Standort-Oktett}.{VLAN-ID}.0/24
 *
 * @param {string} locationCode
 * @param {number} vlanId
 * @returns {string|null} z.B. '10.1.10.0/24'
 */
export function getSubnet(locationCode, vlanId) {
  const octet = IP_OCTETS[locationCode];
  if (octet === undefined) return null;
  return `10.${octet}.${vlanId}.0/24`;
}

// ═══════════════════════════════════════════════════════════════
// BULK OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Parsed eine Liste von Gerätenamen.
 *
 * @param {string[]} names - Array von Gerätenamen
 * @returns {Object[]} Array von Parse-Ergebnissen
 */
export function parseMultiple(names) {
  return names.map(parseDeviceName);
}

/**
 * Gruppiert geparste Geräte nach Standort.
 *
 * @param {Object[]} parsedDevices - Array von parseDeviceName-Ergebnissen
 * @returns {Object} Gruppiert nach resolvedLocation
 */
export function groupByLocation(parsedDevices) {
  return parsedDevices
    .filter(d => d.valid)
    .reduce((groups, device) => {
      const loc = device.resolvedLocation;
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(device);
      return groups;
    }, {});
}

/**
 * Gruppiert geparste Geräte nach Kategorie.
 *
 * @param {Object[]} parsedDevices
 * @returns {Object} Gruppiert nach category (workstation, server, network)
 */
export function groupByCategory(parsedDevices) {
  return parsedDevices
    .filter(d => d.valid)
    .reduce((groups, device) => {
      const cat = device.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(device);
      return groups;
    }, {});
}
