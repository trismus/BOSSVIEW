import { useState, useMemo, useCallback } from 'react'
import { PageHelpBanner } from '../components/PageHelpBanner'

// ─── Dark Trace Color Palette ────────────────────────────────
const COLORS = {
  bg: '#0a0e17',
  bgPanel: '#111827',
  bgCard: '#0f172a',
  border: '#1e293b',
  borderActive: '#0ea5e9',
  cyan: '#06b6d4',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#64748b',
}

// ═══════════════════════════════════════════════════════════════
// NAMING CONVENTION DATA & LOGIC (from docs/namingConvention.js)
// ═══════════════════════════════════════════════════════════════

const COMPANY_PREFIX = 'lido'

interface LocationDef {
  code: string
  name: string
  fullName: string
  city: string
  type: string
}

const LOCATIONS: Record<string, LocationDef> = {
  ZRH: { code: 'ZRH', name: 'Region Zürich', fullName: 'Zürich', city: 'Zürich', type: 'region' },
  STS: { code: 'STS', name: 'Stelzenstrasse', fullName: 'Stelzenstrasse', city: 'Zürich', type: 'office' },
  BAS: { code: 'BAS', name: 'Baslerstrasse', fullName: 'Baslerstrasse', city: 'Zürich', type: 'datacenter' },
  PCT: { code: 'PCT', name: 'Princeton', fullName: 'Princeton', city: 'Princeton, NJ', type: 'office' },
}

const WORKSTATION_LOCATION_MAP: Record<string, string> = {
  zrh: 'STS',
  sts: 'STS',
  bas: 'BAS',
  pct: 'PCT',
}

interface DeviceTypeDef {
  code: string
  name: string
  family: 'workstation' | 'server'
  caseRule: 'lower' | 'upper'
  seqLength: number
}

const DEVICE_TYPES: Record<string, DeviceTypeDef> = {
  l: { code: 'l', name: 'Laptop', family: 'workstation', caseRule: 'lower', seqLength: 3 },
  a: { code: 'a', name: 'Desktop', family: 'workstation', caseRule: 'lower', seqLength: 3 },
  m: { code: 'm', name: 'Mac', family: 'workstation', caseRule: 'lower', seqLength: 3 },
  V: { code: 'V', name: 'Virtual Server', family: 'server', caseRule: 'upper', seqLength: 3 },
  S: { code: 'S', name: 'Physical Server', family: 'server', caseRule: 'upper', seqLength: 2 },
}

const VLAN_BLOCKS: Record<string, { start: number; end: number }> = {
  STS: { start: 10, end: 99 },
  BAS: { start: 100, end: 199 },
  PCT: { start: 200, end: 299 },
}

const VLAN_FUNCTIONS: Record<number, string> = {
  0: 'Management',
  20: 'Production',
  30: 'DMZ',
  40: 'Guest/IoT',
  50: 'VoIP/UC',
  60: 'Backup',
  70: 'Storage/IPMI',
  80: 'Monitoring',
}

const IP_OCTETS: Record<string, number> = {
  STS: 1,
  BAS: 2,
  PCT: 3,
}

const PATTERNS = {
  workstation: /^lido(zrh|pct|bas|sts)([lam])(\d{3})$/i,
  server: /^LIDO(ZRH|BAS|PCT|STS)([VS])(\d{2,3})$/,
  network: /^(ZRH)(STS|BAS)(\d{2,3})$/,
}

type Category = 'workstation' | 'server' | 'network'

interface ParsedValid {
  valid: true
  name: string
  family: string
  category: Category
  prefix: string
  locationCode: string
  resolvedLocation: string
  resolvedName: string
  city: string
  locationType: string
  deviceType: string
  typeCode: string
  sequence: string
  sequenceNum: number
  region?: string
}

interface ParsedInvalid {
  valid: false
  name: string
  error: string
}

type ParseResult = ParsedValid | ParsedInvalid

function parseDeviceName(name: string): ParseResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, name, error: 'Kein gültiger Name' }
  }

  const trimmed = name.trim()
  if (!trimmed) {
    return { valid: false, name: trimmed, error: 'Kein gültiger Name' }
  }

  // Workstation
  const wsMatch = trimmed.match(PATTERNS.workstation)
  if (wsMatch) {
    const [, locCode, typeCode, seq] = wsMatch
    const locUpper = locCode.toUpperCase()
    const resolvedLoc = WORKSTATION_LOCATION_MAP[locCode.toLowerCase()]
    const location = LOCATIONS[resolvedLoc] || LOCATIONS[locUpper]
    const deviceType = DEVICE_TYPES[typeCode.toLowerCase()]

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
    }
  }

  // Server
  const srvMatch = trimmed.match(PATTERNS.server)
  if (srvMatch) {
    const [, locCode, typeCode, seq] = srvMatch
    const location = LOCATIONS[locCode]
    const deviceType = DEVICE_TYPES[typeCode]

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
    }
  }

  // Network
  const netMatch = trimmed.match(PATTERNS.network)
  if (netMatch) {
    const [, region, siteCode, seq] = netMatch
    const location = LOCATIONS[siteCode]

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
    }
  }

  return {
    valid: false,
    name: trimmed,
    error: `"${trimmed}" entspricht keinem bekannten Namensschema (Workstation, Server oder Netzwerk).`,
  }
}

function validateName(name: string): { valid: boolean; errors: string[]; parsed?: ParsedValid } {
  const errors: string[] = []
  const result = parseDeviceName(name)

  if (!result.valid) {
    errors.push(result.error)
    return { valid: false, errors }
  }

  // Sequence length check
  if (result.category === 'workstation' || result.category === 'server') {
    const dt = DEVICE_TYPES[result.typeCode]
    if (dt && result.sequence.length !== dt.seqLength) {
      errors.push(`Sequenz sollte ${dt.seqLength}-stellig sein, ist aber ${result.sequence.length}-stellig.`)
    }
  }

  // Case rule check
  if (result.category === 'workstation' && name !== name.toLowerCase()) {
    errors.push('Workstation-Namen müssen komplett in Kleinbuchstaben sein.')
  }
  if (result.category === 'server' && !name.startsWith('LIDO')) {
    errors.push('Server-Namen müssen mit "LIDO" in Grossbuchstaben beginnen.')
  }
  if (result.category === 'network' && name !== name.toUpperCase()) {
    errors.push('Netzwerk-Gerätenamen müssen komplett in Grossbuchstaben sein.')
  }

  return { valid: errors.length === 0, errors, parsed: result }
}

function generateName(params: {
  category: Category
  locationCode: string
  typeCode: string
  sequence: number
  region?: string
}): string {
  const { category, locationCode, typeCode, sequence, region = 'ZRH' } = params
  const dt = DEVICE_TYPES[typeCode]
  const seqLen = dt?.seqLength || 3
  const seqStr = String(sequence).padStart(seqLen, '0')

  switch (category) {
    case 'workstation':
      return `${COMPANY_PREFIX}${locationCode.toLowerCase()}${typeCode.toLowerCase()}${seqStr}`
    case 'server':
      return `${COMPANY_PREFIX.toUpperCase()}${locationCode.toUpperCase()}${typeCode.toUpperCase()}${seqStr}`
    case 'network':
      return `${region}${locationCode}${seqStr}`
    default:
      return ''
  }
}

interface VlanResolution {
  locationCode: string
  locationName: string
  functionName: string
  functionOffset: number
  vlanId: number
}

function resolveVlan(vlanId: number): VlanResolution | null {
  for (const [locCode, block] of Object.entries(VLAN_BLOCKS)) {
    if (vlanId >= block.start && vlanId <= block.end) {
      const offset = vlanId - block.start
      const funcOffsets = Object.keys(VLAN_FUNCTIONS).map(Number).sort((a, b) => a - b)
      let matchedOffset = funcOffsets[0]
      for (const fo of funcOffsets) {
        if (fo <= offset) matchedOffset = fo
        else break
      }
      return {
        locationCode: locCode,
        locationName: LOCATIONS[locCode]?.fullName || locCode,
        functionName: VLAN_FUNCTIONS[matchedOffset] || 'Unknown',
        functionOffset: matchedOffset,
        vlanId,
      }
    }
  }
  return null
}

function getSubnet(locationCode: string, vlanId: number): string | null {
  const octet = IP_OCTETS[locationCode]
  if (octet === undefined) return null
  return `10.${octet}.${vlanId}.0/24`
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY-DEPENDENT OPTIONS
// ═══════════════════════════════════════════════════════════════

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'workstation', label: 'Workstation' },
  { value: 'server', label: 'Server' },
  { value: 'network', label: 'Network' },
]

const LOCATION_OPTIONS = [
  { value: 'ZRH', label: 'ZRH — Region Zürich' },
  { value: 'STS', label: 'STS — Stelzenstrasse' },
  { value: 'BAS', label: 'BAS — Baslerstrasse' },
  { value: 'PCT', label: 'PCT — Princeton' },
]

function getTypeOptions(category: Category) {
  if (category === 'workstation') {
    return [
      { value: 'l', label: 'l — Laptop' },
      { value: 'a', label: 'a — Desktop' },
      { value: 'm', label: 'm — Mac' },
    ]
  }
  if (category === 'server') {
    return [
      { value: 'V', label: 'V — Virtual Server' },
      { value: 'S', label: 'S — Physical Server' },
    ]
  }
  return []
}

function getLocationOptions(category: Category) {
  if (category === 'network') {
    // Network only supports STS and BAS (pattern: ZRH + STS|BAS)
    return LOCATION_OPTIONS.filter((l) => l.value === 'STS' || l.value === 'BAS')
  }
  return LOCATION_OPTIONS
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

const EXAMPLE_NAMES = ['lidozrhl001', 'LIDOZRHV042', 'ZRHSTS003', 'lidopctm005']

export function NamingConventionPage() {
  // Section 1: Parser
  const [parserInput, setParserInput] = useState('')
  // Section 2: Generator
  const [genCategory, setGenCategory] = useState<Category>('workstation')
  const [genLocation, setGenLocation] = useState('ZRH')
  const [genType, setGenType] = useState('l')
  const [genSequence, setGenSequence] = useState(1)
  const [copied, setCopied] = useState(false)
  // Section 4: VLAN Resolver
  const [vlanInput, setVlanInput] = useState('')

  // Parser result
  const parseResult = useMemo(() => {
    if (!parserInput.trim()) return null
    return validateName(parserInput.trim())
  }, [parserInput])

  const parsedDetails = useMemo(() => {
    if (!parserInput.trim()) return null
    return parseDeviceName(parserInput.trim())
  }, [parserInput])

  // Generator result
  const generatedName = useMemo(() => {
    if (genCategory === 'network') {
      return generateName({ category: genCategory, locationCode: genLocation, typeCode: 'NET', sequence: genSequence })
    }
    return generateName({ category: genCategory, locationCode: genLocation, typeCode: genType, sequence: genSequence })
  }, [genCategory, genLocation, genType, genSequence])

  // When category changes, reset type to first available
  const handleCategoryChange = useCallback((cat: Category) => {
    setGenCategory(cat)
    const types = getTypeOptions(cat)
    if (types.length > 0) {
      setGenType(types[0].value)
    }
    const locs = getLocationOptions(cat)
    if (!locs.find((l) => l.value === genLocation)) {
      setGenLocation(locs[0].value)
    }
  }, [genLocation])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedName).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [generatedName])

  // VLAN resolution
  const vlanResult = useMemo(() => {
    const id = parseInt(vlanInput, 10)
    if (isNaN(id) || id < 0) return null
    const resolved = resolveVlan(id)
    if (!resolved) return null
    const subnet = getSubnet(resolved.locationCode, id)
    return { ...resolved, subnet }
  }, [vlanInput])

  return (
    <div className="space-y-8">
      <PageHelpBanner
        pageKey="naming-convention"
        title="Naming Convention Tool"
        description="Enter a device name to parse it, or use the generator to create standardized names."
        learnMoreSection="naming-convention"
      />

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Naming Convention</h1>
        <p className="text-slate-400 mt-1">
          LSYFN device naming schema — parser, generator, and reference documentation
        </p>
      </div>

      {/* ─── Section 1: Parser / Validator ─── */}
      <section
        className="rounded-xl border p-6"
        style={{
          background: COLORS.bgCard,
          borderColor: parseResult
            ? parseResult.valid
              ? COLORS.green
              : COLORS.red
            : COLORS.border,
          boxShadow: parseResult
            ? parseResult.valid
              ? `0 0 20px ${COLORS.green}20`
              : `0 0 20px ${COLORS.red}20`
            : 'none',
        }}
      >
        <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <span className="text-cyan-400">01</span> Name Parser / Validator
        </h2>

        <div className="relative">
          <input
            type="text"
            value={parserInput}
            onChange={(e) => setParserInput(e.target.value)}
            placeholder="Enter a device name to parse..."
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 font-mono text-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            style={{
              borderColor: parseResult
                ? parseResult.valid
                  ? COLORS.green
                  : COLORS.red
                : undefined,
            }}
          />
          {parseResult && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">
              {parseResult.valid ? (
                <span style={{ color: COLORS.green }}>&#x2713;</span>
              ) : (
                <span style={{ color: COLORS.red }}>&#x2717;</span>
              )}
            </span>
          )}
        </div>

        {/* Parse result */}
        {parseResult && parsedDetails && (
          <div className="mt-4">
            {parseResult.valid && parsedDetails.valid ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { label: 'Category', value: parsedDetails.category },
                  { label: 'Location', value: `${parsedDetails.locationCode} (${parsedDetails.resolvedName})` },
                  { label: 'Phys. Location', value: parsedDetails.resolvedLocation },
                  { label: 'Device Type', value: parsedDetails.deviceType },
                  { label: 'Type Code', value: parsedDetails.typeCode },
                  { label: 'Sequence', value: parsedDetails.sequence },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-mono text-slate-200 mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
                <p className="text-sm text-red-400">
                  {parseResult.errors.join(' ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Example names */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Examples:</span>
          {EXAMPLE_NAMES.map((name) => (
            <button
              key={name}
              onClick={() => setParserInput(name)}
              className="font-mono text-xs px-2.5 py-1 rounded bg-slate-800 text-cyan-400 hover:bg-slate-700 transition-colors border border-slate-700 hover:border-cyan-800"
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Section 2: Name Generator ─── */}
      <section
        className="rounded-xl border p-6"
        style={{ background: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <span className="text-cyan-400">02</span> Name Generator
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Category */}
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
            <select
              value={genCategory}
              onChange={(e) => handleCategoryChange(e.target.value as Category)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Location</label>
            <select
              value={genLocation}
              onChange={(e) => setGenLocation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {getLocationOptions(genCategory).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Type (not for network) */}
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Type</label>
            {genCategory === 'network' ? (
              <div className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-500 italic">
                N/A for Network
              </div>
            ) : (
              <select
                value={genType}
                onChange={(e) => setGenType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {getTypeOptions(genCategory).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Sequence */}
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Sequence</label>
            <input
              type="number"
              min={1}
              max={999}
              value={genSequence}
              onChange={(e) => setGenSequence(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="mt-5 flex items-center gap-4">
          <div className="flex-1 bg-slate-900 border border-cyan-800/50 rounded-lg px-5 py-3 font-mono text-xl text-cyan-400 tracking-wider">
            {generatedName}
          </div>
          <button
            onClick={handleCopy}
            className="px-4 py-3 rounded-lg text-sm font-medium transition-colors border"
            style={{
              background: copied ? `${COLORS.green}20` : `${COLORS.cyan}10`,
              borderColor: copied ? COLORS.green : COLORS.cyan,
              color: copied ? COLORS.green : COLORS.cyan,
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </section>

      {/* ─── Section 3: Reference Documentation ─── */}
      <section
        className="rounded-xl border p-6"
        style={{ background: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <h2 className="text-lg font-semibold text-slate-100 mb-6 flex items-center gap-2">
          <span className="text-cyan-400">03</span> Reference Documentation
        </h2>

        {/* Naming Schema Overview */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Naming Schema Overview</h3>
          <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm space-y-1 border border-slate-800">
            <p>
              <span className="text-slate-500">Workstation:</span>
              {'  '}
              <span className="text-cyan-400">lido</span>
              <span className="text-amber-400">{'{standort}'}</span>
              <span className="text-green-400">{'{typ}'}</span>
              <span className="text-purple-400">{'{seq}'}</span>
              {'     '}
              <span className="text-slate-500">{'->'}</span>
              {'  '}
              <span className="text-slate-200">lidozrhl001</span>
              {'  '}
              <span className="text-slate-500">(lowercase)</span>
            </p>
            <p>
              <span className="text-slate-500">Server:</span>
              {'       '}
              <span className="text-cyan-400">LIDO</span>
              <span className="text-amber-400">{'{STANDORT}'}</span>
              <span className="text-green-400">{'{TYP}'}</span>
              <span className="text-purple-400">{'{SEQ}'}</span>
              {'     '}
              <span className="text-slate-500">{'->'}</span>
              {'  '}
              <span className="text-slate-200">LIDOZRHV042</span>
              {'  '}
              <span className="text-slate-500">(UPPERCASE)</span>
            </p>
            <p>
              <span className="text-slate-500">Network:</span>
              {'      '}
              <span className="text-amber-400">{'{REGION}'}</span>
              <span className="text-amber-400">{'{STANDORT}'}</span>
              <span className="text-purple-400">{'{SEQ}'}</span>
              {'           '}
              <span className="text-slate-500">{'->'}</span>
              {'  '}
              <span className="text-slate-200">ZRHSTS003</span>
              {'    '}
              <span className="text-slate-500">(UPPERCASE)</span>
            </p>
          </div>
        </div>

        {/* Device Types Table */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Device Types</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Code</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Family</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Case</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Sequence</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(DEVICE_TYPES).map((dt, i) => (
                  <tr
                    key={dt.code}
                    className={`border-b border-slate-800 ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}
                  >
                    <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">{dt.code}</td>
                    <td className="py-2.5 px-3 text-slate-200">{dt.name}</td>
                    <td className="py-2.5 px-3 text-slate-300">{dt.family}</td>
                    <td className="py-2.5 px-3 text-slate-300">{dt.caseRule === 'lower' ? 'lower' : 'UPPER'}</td>
                    <td className="py-2.5 px-3 text-slate-300">{dt.seqLength}-digit</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Locations Table */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Locations</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Code</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">City</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(LOCATIONS).map((loc, i) => (
                  <tr
                    key={loc.code}
                    className={`border-b border-slate-800 ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}
                  >
                    <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">{loc.code}</td>
                    <td className="py-2.5 px-3 text-slate-200">{loc.name}</td>
                    <td className="py-2.5 px-3 text-slate-300">{loc.city}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background:
                            loc.type === 'region'
                              ? `${COLORS.cyan}20`
                              : loc.type === 'datacenter'
                              ? `${COLORS.amber}20`
                              : `${COLORS.green}20`,
                          color:
                            loc.type === 'region'
                              ? COLORS.cyan
                              : loc.type === 'datacenter'
                              ? COLORS.amber
                              : COLORS.green,
                        }}
                      >
                        {loc.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-start gap-2 bg-amber-900/20 border border-amber-800/40 rounded-lg px-4 py-2.5">
            <span className="text-amber-400 text-sm mt-0.5">!</span>
            <p className="text-sm text-amber-300/90">
              <code className="font-mono text-amber-400">lidozrh</code> devices are physically located at
              Stelzenstrasse (STS)
            </p>
          </div>
        </div>

        {/* VLAN Schema */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">VLAN Schema</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Location</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Range</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Ex: Management</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Ex: Production</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(VLAN_BLOCKS).map(([loc, block], i) => (
                  <tr
                    key={loc}
                    className={`border-b border-slate-800 ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}
                  >
                    <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">{loc}</td>
                    <td className="py-2.5 px-3 text-slate-300">{block.start}–{block.end}</td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">VLAN {block.start}</td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">VLAN {block.start + 20}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">VLAN Functions (Offset)</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(VLAN_FUNCTIONS).map(([offset, name]) => (
                <span
                  key={offset}
                  className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700"
                >
                  <span className="text-cyan-400">{offset}</span>
                  <span className="text-slate-600 mx-1">=</span>
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* IP Schema */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">IP Schema</h3>
          <p className="text-sm text-slate-400 mb-3 font-mono">
            10.<span className="text-amber-400">{'{Location}'}</span>.<span className="text-cyan-400">{'{VLAN}'}</span>.<span className="text-purple-400">{'{Host}'}</span>/24
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Location</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">2nd Octet</th>
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Example</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(IP_OCTETS).map(([loc, octet], i) => (
                  <tr
                    key={loc}
                    className={`border-b border-slate-800 ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}
                  >
                    <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">{loc}</td>
                    <td className="py-2.5 px-3 text-slate-300">{octet}</td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">
                      10.{octet}.{VLAN_BLOCKS[loc]?.start || '?'}.0/24
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Section 4: VLAN Resolver ─── */}
      <section
        className="rounded-xl border p-6"
        style={{ background: COLORS.bgCard, borderColor: COLORS.border }}
      >
        <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <span className="text-cyan-400">04</span> VLAN Resolver
        </h2>

        <div className="max-w-md">
          <input
            type="number"
            min={0}
            max={299}
            value={vlanInput}
            onChange={(e) => setVlanInput(e.target.value)}
            placeholder="Enter a VLAN ID (e.g. 10, 130, 200)..."
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 font-mono text-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {vlanInput && (
          <div className="mt-4">
            {vlanResult ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Location</p>
                  <p className="text-sm font-mono text-slate-200 mt-1">
                    {vlanResult.locationCode} — {vlanResult.locationName}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Function</p>
                  <p className="text-sm font-mono text-slate-200 mt-1">{vlanResult.functionName}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Subnet</p>
                  <p className="text-sm font-mono text-cyan-400 mt-1">{vlanResult.subnet || 'N/A'}</p>
                </div>
              </div>
            ) : (
              <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 max-w-2xl">
                <p className="text-sm text-red-400">
                  VLAN {vlanInput} does not match any known location block (STS: 10–99, BAS: 100–199, PCT: 200–299).
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
