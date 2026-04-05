import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

// ═══════════════════════════════════════════════════════════════
// BOSSVIEW Infrastructure Map — Milestone: Virtual Network Map
// Dark Trace / Elegant Sci-Fi Theme
// ═══════════════════════════════════════════════════════════════

// ─── Color Palette ───────────────────────────────────────────
const COLORS = {
  bg: "#0a0e17",
  bgCard: "#0f1420",
  bgPanel: "#111827",
  border: "#1e293b",
  borderActive: "#0ea5e9",
  cyan: "#06b6d4",
  cyanGlow: "#22d3ee",
  cyanDim: "#0e7490",
  blue: "#3b82f6",
  blueGlow: "#60a5fa",
  green: "#10b981",
  greenGlow: "#34d399",
  amber: "#f59e0b",
  amberGlow: "#fbbf24",
  red: "#ef4444",
  redGlow: "#f87171",
  purple: "#8b5cf6",
  purpleGlow: "#a78bfa",
  text: "#e2e8f0",
  textDim: "#94a3b8",
  textMuted: "#64748b",
  grid: "rgba(6, 182, 212, 0.04)",
};

// ─── LSYFN Global Locations ──────────────────────────────────
const LOCATIONS = [
  { id: "zrh", name: "Zürich HQ", city: "Zürich", country: "Switzerland", lat: 47.3769, lon: 8.5417, assets: 142, servers: 5, status: "operational", type: "headquarters" },
  { id: "fra", name: "Frankfurt Hub", city: "Frankfurt", country: "Germany", lat: 50.1109, lon: 8.6821, assets: 89, servers: 3, status: "operational", type: "datacenter" },
  { id: "ams", name: "Amsterdam Node", city: "Amsterdam", country: "Netherlands", lat: 52.3676, lon: 4.9041, assets: 34, servers: 2, status: "operational", type: "office" },
  { id: "nyc", name: "New York Office", city: "New York", country: "USA", lat: 40.7128, lon: -74.006, assets: 67, servers: 2, status: "warning", type: "office" },
  { id: "sin", name: "Singapore DC", city: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198, assets: 45, servers: 2, status: "operational", type: "datacenter" },
  { id: "hkg", name: "Hong Kong Office", city: "Hong Kong", country: "China", lat: 22.3193, lon: 114.1694, assets: 28, servers: 1, status: "operational", type: "office" },
  { id: "dxb", name: "Dubai Branch", city: "Dubai", country: "UAE", lat: 25.2048, lon: 55.2708, assets: 19, servers: 1, status: "maintenance", type: "office" },
];

const CONNECTIONS = [
  { from: "zrh", to: "fra", bandwidth: "10 Gbps", type: "primary" },
  { from: "zrh", to: "ams", bandwidth: "1 Gbps", type: "primary" },
  { from: "fra", to: "nyc", bandwidth: "1 Gbps", type: "primary" },
  { from: "fra", to: "dxb", bandwidth: "500 Mbps", type: "secondary" },
  { from: "sin", to: "hkg", bandwidth: "1 Gbps", type: "primary" },
  { from: "fra", to: "sin", bandwidth: "500 Mbps", type: "secondary" },
  { from: "zrh", to: "sin", bandwidth: "500 Mbps", type: "backup" },
];

// ─── Stelzenstrasse Network Topology ─────────────────────────
const STELZEN_VLANS = [
  { id: "vlan10", name: "VLAN 10 — Management", cidr: "10.1.10.0/24", color: COLORS.cyan },
  { id: "vlan20", name: "VLAN 20 — Production", cidr: "10.1.20.0/24", color: COLORS.green },
  { id: "vlan30", name: "VLAN 30 — DMZ", cidr: "10.1.30.0/24", color: COLORS.amber },
  { id: "vlan40", name: "VLAN 40 — Guest/IoT", cidr: "10.1.40.0/24", color: COLORS.purple },
  { id: "vlan50", name: "VLAN 50 — VoIP", cidr: "10.1.50.0/24", color: COLORS.blue },
];

const STELZEN_DEVICES = [
  { id: "fw1", name: "FW-STZ-01", type: "firewall", vlan: null, x: 400, y: 60, status: "operational", model: "Palo Alto PA-850", ip: "10.1.10.1" },
  { id: "core1", name: "SW-CORE-01", type: "switch-core", vlan: null, x: 400, y: 160, status: "operational", model: "Cisco C9300-48P", ip: "10.1.10.2" },
  { id: "sw1", name: "SW-ACC-01", type: "switch", vlan: "vlan10", x: 160, y: 280, status: "operational", model: "Cisco C9200-24P", ip: "10.1.10.10" },
  { id: "sw2", name: "SW-ACC-02", type: "switch", vlan: "vlan20", x: 340, y: 280, status: "operational", model: "Cisco C9200-48P", ip: "10.1.20.10" },
  { id: "sw3", name: "SW-ACC-03", type: "switch", vlan: "vlan30", x: 520, y: 280, status: "warning", model: "Cisco C9200-24P", ip: "10.1.30.10" },
  { id: "sw4", name: "SW-ACC-04", type: "switch", vlan: "vlan40", x: 660, y: 280, status: "operational", model: "Cisco C9200-24P", ip: "10.1.40.10" },
  { id: "srv1", name: "SRV-ESX-01", type: "server", vlan: "vlan20", x: 240, y: 400, status: "operational", model: "Dell R740xd", ip: "10.1.20.50" },
  { id: "srv2", name: "SRV-ESX-02", type: "server", vlan: "vlan20", x: 400, y: 400, status: "operational", model: "Dell R740xd", ip: "10.1.20.51" },
  { id: "srv3", name: "SRV-MGMT-01", type: "server", vlan: "vlan10", x: 100, y: 400, status: "operational", model: "Dell R640", ip: "10.1.10.50" },
  { id: "wap1", name: "WAP-FL1-01", type: "wireless", vlan: "vlan40", x: 620, y: 400, status: "operational", model: "Aruba AP-535", ip: "10.1.40.100" },
  { id: "wap2", name: "WAP-FL2-01", type: "wireless", vlan: "vlan40", x: 720, y: 400, status: "operational", model: "Aruba AP-535", ip: "10.1.40.101" },
];

const STELZEN_LINKS = [
  { from: "fw1", to: "core1", speed: "10G", type: "trunk" },
  { from: "core1", to: "sw1", speed: "10G", type: "trunk" },
  { from: "core1", to: "sw2", speed: "10G", type: "trunk" },
  { from: "core1", to: "sw3", speed: "10G", type: "trunk" },
  { from: "core1", to: "sw4", speed: "1G", type: "trunk" },
  { from: "sw1", to: "srv3", speed: "1G", type: "access" },
  { from: "sw2", to: "srv1", speed: "10G", type: "access" },
  { from: "sw2", to: "srv2", speed: "10G", type: "access" },
  { from: "sw4", to: "wap1", speed: "1G", type: "access" },
  { from: "sw4", to: "wap2", speed: "1G", type: "access" },
];

// ─── Datacenter BAS Topology ─────────────────────────────────
const BAS_VLANS = [
  { id: "bvlan100", name: "VLAN 100 — Core Infra", cidr: "10.2.100.0/24", color: COLORS.cyan },
  { id: "bvlan200", name: "VLAN 200 — Production", cidr: "10.2.200.0/24", color: COLORS.green },
  { id: "bvlan300", name: "VLAN 300 — Backup/DR", cidr: "10.2.300.0/24", color: COLORS.amber },
  { id: "bvlan400", name: "VLAN 400 — Storage", cidr: "10.2.400.0/24", color: COLORS.purple },
  { id: "bvlan500", name: "VLAN 500 — iLO/IPMI", cidr: "10.2.500.0/24", color: COLORS.red },
];

const BAS_DEVICES = [
  { id: "bfw1", name: "FW-BAS-01", type: "firewall", vlan: null, x: 300, y: 50, status: "operational", model: "Palo Alto PA-3260", ip: "10.2.100.1" },
  { id: "bfw2", name: "FW-BAS-02", type: "firewall", vlan: null, x: 500, y: 50, status: "operational", model: "Palo Alto PA-3260", ip: "10.2.100.2" },
  { id: "bcore1", name: "SW-CORE-B1", type: "switch-core", vlan: null, x: 300, y: 150, status: "operational", model: "Cisco N9K-9336C", ip: "10.2.100.10" },
  { id: "bcore2", name: "SW-CORE-B2", type: "switch-core", vlan: null, x: 500, y: 150, status: "operational", model: "Cisco N9K-9336C", ip: "10.2.100.11" },
  { id: "bsw1", name: "SW-TOR-R1", type: "switch", vlan: "bvlan200", x: 140, y: 270, status: "operational", model: "Cisco N9K-9348", ip: "10.2.200.10" },
  { id: "bsw2", name: "SW-TOR-R2", type: "switch", vlan: "bvlan200", x: 340, y: 270, status: "operational", model: "Cisco N9K-9348", ip: "10.2.200.11" },
  { id: "bsw3", name: "SW-TOR-R3", type: "switch", vlan: "bvlan300", x: 540, y: 270, status: "operational", model: "Cisco N9K-9348", ip: "10.2.300.10" },
  { id: "bsw4", name: "SW-MGMT-01", type: "switch", vlan: "bvlan500", x: 700, y: 270, status: "operational", model: "Cisco C9200-24P", ip: "10.2.500.10" },
  { id: "bsrv1", name: "ESX-BAS-01", type: "server", vlan: "bvlan200", x: 100, y: 400, status: "operational", model: "Dell R750xa", ip: "10.2.200.50" },
  { id: "bsrv2", name: "ESX-BAS-02", type: "server", vlan: "bvlan200", x: 220, y: 400, status: "operational", model: "Dell R750xa", ip: "10.2.200.51" },
  { id: "bsrv3", name: "ESX-BAS-03", type: "server", vlan: "bvlan200", x: 340, y: 400, status: "operational", model: "Dell R750xa", ip: "10.2.200.52" },
  { id: "bsrv4", name: "ESX-BAS-04", type: "server", vlan: "bvlan200", x: 460, y: 400, status: "warning", model: "Dell R750xa", ip: "10.2.200.53" },
  { id: "bsrv5", name: "SRV-BACKUP-01", type: "server", vlan: "bvlan300", x: 580, y: 400, status: "operational", model: "Dell R740xd", ip: "10.2.300.50" },
  { id: "bsan1", name: "SAN-BAS-01", type: "storage", vlan: "bvlan400", x: 220, y: 510, status: "operational", model: "NetApp AFF A400", ip: "10.2.400.10" },
  { id: "bsan2", name: "SAN-BAS-02", type: "storage", vlan: "bvlan400", x: 400, y: 510, status: "operational", model: "NetApp AFF A400", ip: "10.2.400.11" },
];

const BAS_LINKS = [
  { from: "bfw1", to: "bcore1", speed: "40G", type: "trunk" },
  { from: "bfw2", to: "bcore2", speed: "40G", type: "trunk" },
  { from: "bfw1", to: "bfw2", speed: "10G", type: "ha" },
  { from: "bcore1", to: "bcore2", speed: "100G", type: "vpc" },
  { from: "bcore1", to: "bsw1", speed: "40G", type: "trunk" },
  { from: "bcore1", to: "bsw2", speed: "40G", type: "trunk" },
  { from: "bcore2", to: "bsw3", speed: "40G", type: "trunk" },
  { from: "bcore2", to: "bsw4", speed: "10G", type: "trunk" },
  { from: "bsw1", to: "bsrv1", speed: "25G", type: "access" },
  { from: "bsw1", to: "bsrv2", speed: "25G", type: "access" },
  { from: "bsw2", to: "bsrv3", speed: "25G", type: "access" },
  { from: "bsw2", to: "bsrv4", speed: "25G", type: "access" },
  { from: "bsw3", to: "bsrv5", speed: "10G", type: "access" },
  { from: "bsrv1", to: "bsan1", speed: "25G", type: "storage" },
  { from: "bsrv2", to: "bsan1", speed: "25G", type: "storage" },
  { from: "bsrv3", to: "bsan2", speed: "25G", type: "storage" },
  { from: "bsrv4", to: "bsan2", speed: "25G", type: "storage" },
];

// ─── Rack Data ───────────────────────────────────────────────
const STELZEN_RACKS = [
  {
    id: "rack-stz-1", name: "Rack A1 — Network", units: 42,
    devices: [
      { u: 1, height: 1, name: "Patch Panel 1", type: "patch", status: "operational" },
      { u: 2, height: 1, name: "FW-STZ-01", type: "firewall", status: "operational" },
      { u: 3, height: 1, name: "SW-CORE-01", type: "switch-core", status: "operational" },
      { u: 5, height: 1, name: "SW-ACC-01", type: "switch", status: "operational" },
      { u: 6, height: 1, name: "SW-ACC-02", type: "switch", status: "operational" },
      { u: 7, height: 1, name: "SW-ACC-03", type: "switch", status: "warning" },
      { u: 8, height: 1, name: "SW-ACC-04", type: "switch", status: "operational" },
      { u: 10, height: 1, name: "UPS-STZ-01", type: "ups", status: "operational" },
    ],
  },
  {
    id: "rack-stz-2", name: "Rack A2 — Compute", units: 42,
    devices: [
      { u: 1, height: 1, name: "Patch Panel 2", type: "patch", status: "operational" },
      { u: 2, height: 2, name: "SRV-ESX-01", type: "server", status: "operational" },
      { u: 4, height: 2, name: "SRV-ESX-02", type: "server", status: "operational" },
      { u: 6, height: 1, name: "SRV-MGMT-01", type: "server", status: "operational" },
      { u: 8, height: 2, name: "NAS-STZ-01", type: "storage", status: "operational" },
      { u: 11, height: 1, name: "UPS-STZ-02", type: "ups", status: "operational" },
    ],
  },
];

const BAS_RACKS = [
  {
    id: "rack-bas-1", name: "Rack B1 — Network Core", units: 42,
    devices: [
      { u: 1, height: 1, name: "Patch Panel B1", type: "patch", status: "operational" },
      { u: 2, height: 2, name: "FW-BAS-01", type: "firewall", status: "operational" },
      { u: 4, height: 2, name: "FW-BAS-02", type: "firewall", status: "operational" },
      { u: 6, height: 1, name: "SW-CORE-B1", type: "switch-core", status: "operational" },
      { u: 7, height: 1, name: "SW-CORE-B2", type: "switch-core", status: "operational" },
      { u: 9, height: 1, name: "SW-TOR-R1", type: "switch", status: "operational" },
      { u: 10, height: 1, name: "SW-TOR-R2", type: "switch", status: "operational" },
      { u: 11, height: 1, name: "SW-TOR-R3", type: "switch", status: "operational" },
      { u: 12, height: 1, name: "SW-MGMT-01", type: "switch", status: "operational" },
    ],
  },
  {
    id: "rack-bas-2", name: "Rack B2 — Compute", units: 42,
    devices: [
      { u: 1, height: 1, name: "Patch Panel B2", type: "patch", status: "operational" },
      { u: 2, height: 2, name: "ESX-BAS-01", type: "server", status: "operational" },
      { u: 4, height: 2, name: "ESX-BAS-02", type: "server", status: "operational" },
      { u: 6, height: 2, name: "ESX-BAS-03", type: "server", status: "operational" },
      { u: 8, height: 2, name: "ESX-BAS-04", type: "server", status: "warning" },
      { u: 10, height: 2, name: "SRV-BACKUP-01", type: "server", status: "operational" },
    ],
  },
  {
    id: "rack-bas-3", name: "Rack B3 — Storage", units: 42,
    devices: [
      { u: 1, height: 1, name: "Patch Panel B3", type: "patch", status: "operational" },
      { u: 2, height: 4, name: "SAN-BAS-01", type: "storage", status: "operational" },
      { u: 6, height: 4, name: "SAN-BAS-02", type: "storage", status: "operational" },
      { u: 11, height: 2, name: "UPS-BAS-01", type: "ups", status: "operational" },
      { u: 13, height: 2, name: "UPS-BAS-02", type: "ups", status: "operational" },
    ],
  },
];

// ─── Utility: Device Icon ────────────────────────────────────
const DeviceIcon = ({ type, size = 20, color = COLORS.cyan }) => {
  const s = size;
  const icons = {
    firewall: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M12 6v12M6 12h12" strokeDasharray="2 2" />
        <circle cx="12" cy="12" r="3" fill={color} opacity="0.3" />
      </svg>
    ),
    "switch-core": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="2" y="7" width="20" height="10" rx="2" />
        <circle cx="6" cy="12" r="1.5" fill={color} />
        <circle cx="10" cy="12" r="1.5" fill={color} />
        <circle cx="14" cy="12" r="1.5" fill={color} />
        <circle cx="18" cy="12" r="1.5" fill={color} />
      </svg>
    ),
    switch: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="3" y="8" width="18" height="8" rx="1.5" />
        <circle cx="7" cy="12" r="1" fill={color} />
        <circle cx="11" cy="12" r="1" fill={color} />
        <circle cx="15" cy="12" r="1" fill={color} />
      </svg>
    ),
    server: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="4" y="2" width="16" height="6" rx="1.5" />
        <rect x="4" y="10" width="16" height="6" rx="1.5" />
        <circle cx="8" cy="5" r="1" fill={color} />
        <circle cx="8" cy="13" r="1" fill={color} />
        <line x1="14" y1="5" x2="18" y2="5" />
        <line x1="14" y1="13" x2="18" y2="13" />
        <line x1="8" y1="20" x2="8" y2="22" />
        <line x1="16" y1="20" x2="16" y2="22" />
      </svg>
    ),
    storage: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
        <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
      </svg>
    ),
    wireless: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill={color} />
      </svg>
    ),
  };
  return icons[type] || icons.server;
};

// ─── Animated Pulse Dot ──────────────────────────────────────
const PulseDot = ({ cx, cy, color, size = 4 }) => (
  <g>
    <circle cx={cx} cy={cy} r={size} fill={color} opacity="0.8">
      <animate attributeName="r" values={`${size};${size * 3};${size}`} dur="2.5s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.8;0;0.8" dur="2.5s" repeatCount="indefinite" />
    </circle>
    <circle cx={cx} cy={cy} r={size * 0.7} fill={color} />
  </g>
);

// ─── Animated Data Flow on Link ──────────────────────────────
const DataFlowLine = ({ x1, y1, x2, y2, color, speed = "2s", dashed = false }) => {
  const id = `flow-${x1}-${y1}-${x2}-${y2}`.replace(/\./g, "_");
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1" opacity="0.2" strokeDasharray={dashed ? "6 4" : "none"} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" opacity="0.6" strokeDasharray="4 12" strokeDashoffset="0">
        <animate attributeName="stroke-dashoffset" values="0;-16" dur={speed} repeatCount="indefinite" />
      </line>
      <circle r="2" fill={color} opacity="0.9">
        <animateMotion dur={speed} repeatCount="indefinite" path={`M${x1},${y1} L${x2},${y2}`} />
      </circle>
    </g>
  );
};

// ─── Scanline overlay ────────────────────────────────────────
const ScanlineOverlay = () => (
  <div
    style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50,
      background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.015) 2px, rgba(6,182,212,0.015) 4px)",
    }}
  />
);

// ─── Status Badge ────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    operational: { color: COLORS.green, label: "ONLINE" },
    warning: { color: COLORS.amber, label: "WARNING" },
    maintenance: { color: COLORS.blue, label: "MAINT" },
    critical: { color: COLORS.red, label: "CRITICAL" },
  };
  const s = map[status] || map.operational;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: s.color, textTransform: "uppercase", letterSpacing: 1 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
      {s.label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════
// VIEW: World Map
// ═══════════════════════════════════════════════════════════════
const WorldMapView = ({ onLocationClick }) => {
  const svgRef = useRef(null);
  const [hoveredLoc, setHoveredLoc] = useState(null);
  const [worldData, setWorldData] = useState(null);

  const projection = useMemo(
    () => d3.geoNaturalEarth1().scale(160).translate([420, 240]),
    []
  );

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((topo) => {
        const feature = d3.geoPath().projection(projection);
        const countries = topojsonFeature(topo, topo.objects.countries);
        setWorldData({ countries, path: feature });
      })
      .catch(() => setWorldData(null));
  }, [projection]);

  const locPoints = LOCATIONS.map((l) => {
    const [x, y] = projection([l.lon, l.lat]);
    return { ...l, x, y };
  });

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ScanlineOverlay />
      <svg ref={svgRef} viewBox="0 0 840 480" style={{ width: "100%", height: "100%" }}>
        <defs>
          <radialGradient id="globeGlow">
            <stop offset="0%" stopColor={COLORS.cyan} stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`gx${i}`} x1={i * 70} y1={0} x2={i * 70} y2={480} stroke={COLORS.grid} strokeWidth="0.5" />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`gy${i}`} x1={0} y1={i * 80} x2={840} y2={i * 80} stroke={COLORS.grid} strokeWidth="0.5" />
        ))}

        {/* World outline — simple fallback rectangles if no topojson */}
        {!worldData && (
          <g opacity="0.15">
            <rect x={300} y={100} width={200} height={120} rx={8} fill={COLORS.cyan} />
            <rect x={120} y={140} width={100} height={80} rx={6} fill={COLORS.cyan} />
            <rect x={550} y={130} width={160} height={130} rx={6} fill={COLORS.cyan} />
            <rect x={600} y={300} width={80} height={60} rx={4} fill={COLORS.cyan} />
          </g>
        )}

        {worldData && worldData.countries && worldData.countries.features && (
          <g>
            {worldData.countries.features.map((f, i) => (
              <path key={i} d={worldData.path(f)} fill="rgba(6,182,212,0.07)" stroke="rgba(6,182,212,0.15)" strokeWidth="0.5" />
            ))}
          </g>
        )}

        {/* Connection lines */}
        {CONNECTIONS.map((conn, i) => {
          const from = locPoints.find((l) => l.id === conn.from);
          const to = locPoints.find((l) => l.id === conn.to);
          if (!from || !to) return null;
          const lineColor = conn.type === "primary" ? COLORS.cyan : conn.type === "secondary" ? COLORS.blue : COLORS.textMuted;
          return <DataFlowLine key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} color={lineColor} speed={conn.type === "primary" ? "3s" : "5s"} dashed={conn.type === "backup"} />;
        })}

        {/* Location dots */}
        {locPoints.map((loc) => {
          const statusColor = loc.status === "operational" ? COLORS.green : loc.status === "warning" ? COLORS.amber : COLORS.blue;
          return (
            <g key={loc.id} style={{ cursor: "pointer" }} onClick={() => onLocationClick && onLocationClick(loc)} onMouseEnter={() => setHoveredLoc(loc.id)} onMouseLeave={() => setHoveredLoc(null)}>
              <PulseDot cx={loc.x} cy={loc.y} color={statusColor} size={loc.type === "headquarters" ? 5 : 3.5} />
              <text x={loc.x} y={loc.y - 12} textAnchor="middle" fill={COLORS.text} fontSize="9" fontFamily="JetBrains Mono, monospace" opacity={hoveredLoc === loc.id ? 1 : 0.7}>
                {loc.name}
              </text>
              {hoveredLoc === loc.id && (
                <g filter="url(#glow)">
                  <rect x={loc.x - 70} y={loc.y + 10} width={140} height={50} rx={4} fill={COLORS.bgCard} stroke={COLORS.borderActive} strokeWidth="0.5" opacity="0.95" />
                  <text x={loc.x} y={loc.y + 26} textAnchor="middle" fill={COLORS.text} fontSize="9" fontFamily="DM Sans, sans-serif">{loc.city}, {loc.country}</text>
                  <text x={loc.x} y={loc.y + 40} textAnchor="middle" fill={COLORS.textDim} fontSize="8" fontFamily="JetBrains Mono, monospace">{loc.assets} Assets · {loc.servers} Server</text>
                  <text x={loc.x} y={loc.y + 52} textAnchor="middle" fill={statusColor} fontSize="8" fontFamily="JetBrains Mono, monospace">{loc.status.toUpperCase()}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Title HUD */}
        <text x={20} y={24} fill={COLORS.cyan} fontSize="11" fontFamily="JetBrains Mono, monospace" letterSpacing="3" opacity="0.8">BOSSVIEW :: GLOBAL INFRASTRUCTURE</text>
        <text x={20} y={40} fill={COLORS.textMuted} fontSize="9" fontFamily="JetBrains Mono, monospace">LSYFN · 7 LOCATIONS · {LOCATIONS.reduce((s, l) => s + l.assets, 0)} ASSETS</text>

        {/* Legend */}
        <g transform="translate(640, 420)">
          {[{ label: "Primary", color: COLORS.cyan }, { label: "Secondary", color: COLORS.blue }, { label: "Backup", color: COLORS.textMuted }].map((item, i) => (
            <g key={i} transform={`translate(0, ${i * 16})`}>
              <line x1={0} y1={0} x2={20} y2={0} stroke={item.color} strokeWidth="1.5" strokeDasharray={item.label === "Backup" ? "4 3" : "none"} />
              <text x={26} y={3} fill={COLORS.textDim} fontSize="8" fontFamily="JetBrains Mono, monospace">{item.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

// Simple topojson → geojson helper
function topojsonFeature(topology, object) {
  const arcs = topology.arcs;
  function arcToCoords(arcIndex) {
    let arc = arcs[arcIndex < 0 ? ~arcIndex : arcIndex];
    let coords = [], x = 0, y = 0;
    arc.forEach(([dx, dy]) => { x += dx; y += dy; coords.push([x, y]); });
    const { scale, translate } = topology.transform || { scale: [1, 1], translate: [0, 0] };
    coords = coords.map(([cx, cy]) => [cx * scale[0] + translate[0], cy * scale[1] + translate[1]]);
    if (arcIndex < 0) coords.reverse();
    return coords;
  }
  function ringsToCoords(rings) {
    return rings.map((ring) => ring.reduce((acc, idx) => acc.concat(arcToCoords(idx)), []));
  }
  const features = (object.geometries || []).map((geom) => {
    let coordinates;
    if (geom.type === "Polygon") coordinates = ringsToCoords(geom.arcs);
    else if (geom.type === "MultiPolygon") coordinates = geom.arcs.map(ringsToCoords);
    else coordinates = [];
    return { type: "Feature", properties: geom.properties || {}, geometry: { type: geom.type, coordinates } };
  });
  return { type: "FeatureCollection", features };
}

// ═══════════════════════════════════════════════════════════════
// VIEW: Network Topology (shared for both sites)
// ═══════════════════════════════════════════════════════════════
const NetworkTopologyView = ({ siteName, vlans, devices, links }) => {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showVlans, setShowVlans] = useState(true);

  const deviceMap = {};
  devices.forEach((d) => (deviceMap[d.id] = d));

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ScanlineOverlay />
      {/* VLAN Legend */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "8px 12px" }}>
        <div style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace", marginBottom: 6, letterSpacing: 1 }}>VLANS</div>
        {vlans.map((v) => (
          <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: v.color, boxShadow: `0 0 4px ${v.color}` }} />
            <span style={{ fontSize: 9, color: COLORS.textDim, fontFamily: "JetBrains Mono, monospace" }}>{v.name}</span>
          </div>
        ))}
        <button onClick={() => setShowVlans(!showVlans)} style={{ marginTop: 6, fontSize: 8, color: COLORS.cyan, background: "none", border: `1px solid ${COLORS.cyanDim}`, borderRadius: 3, padding: "2px 6px", cursor: "pointer", fontFamily: "JetBrains Mono, monospace" }}>
          {showVlans ? "HIDE ZONES" : "SHOW ZONES"}
        </button>
      </div>

      <svg viewBox="0 0 820 520" style={{ width: "100%", height: "100%" }}>
        <defs>
          <filter id="devGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid */}
        {Array.from({ length: 18 }, (_, i) => (
          <line key={`tgx${i}`} x1={i * 50} y1={0} x2={i * 50} y2={520} stroke={COLORS.grid} strokeWidth="0.5" />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`tgy${i}`} x1={0} y1={i * 50} x2={820} y2={i * 50} stroke={COLORS.grid} strokeWidth="0.5" />
        ))}

        {/* VLAN Zones */}
        {showVlans && vlans.map((vlan) => {
          const vDevices = devices.filter((d) => d.vlan === vlan.id);
          if (vDevices.length === 0) return null;
          const minX = Math.min(...vDevices.map((d) => d.x)) - 40;
          const minY = Math.min(...vDevices.map((d) => d.y)) - 30;
          const maxX = Math.max(...vDevices.map((d) => d.x)) + 40;
          const maxY = Math.max(...vDevices.map((d) => d.y)) + 30;
          return (
            <g key={vlan.id}>
              <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} rx={8} fill={vlan.color} fillOpacity="0.04" stroke={vlan.color} strokeWidth="0.5" strokeDasharray="6 3" opacity="0.6" />
              <text x={minX + 6} y={minY + 12} fill={vlan.color} fontSize="8" fontFamily="JetBrains Mono, monospace" opacity="0.6">{vlan.name}</text>
            </g>
          );
        })}

        {/* Links */}
        {links.map((link, i) => {
          const from = deviceMap[link.from];
          const to = deviceMap[link.to];
          if (!from || !to) return null;
          const color = link.type === "ha" ? COLORS.red : link.type === "vpc" ? COLORS.purple : link.type === "storage" ? COLORS.amber : COLORS.cyan;
          return <DataFlowLine key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} color={color} speed={link.speed?.includes("100") ? "1.5s" : link.speed?.includes("40") ? "2s" : link.speed?.includes("10G") ? "2.5s" : "3.5s"} />;
        })}

        {/* Devices */}
        {devices.map((dev) => {
          const statusColor = dev.status === "operational" ? COLORS.green : dev.status === "warning" ? COLORS.amber : COLORS.red;
          const isSelected = selectedDevice === dev.id;
          const size = dev.type === "firewall" || dev.type === "switch-core" ? 36 : 28;
          return (
            <g key={dev.id} style={{ cursor: "pointer" }} onClick={() => setSelectedDevice(isSelected ? null : dev.id)}>
              {/* Glow ring */}
              <circle cx={dev.x} cy={dev.y} r={size / 2 + 4} fill="none" stroke={statusColor} strokeWidth={isSelected ? 1.5 : 0.5} opacity={isSelected ? 0.8 : 0.3}>
                {isSelected && <animate attributeName="r" values={`${size / 2 + 4};${size / 2 + 8};${size / 2 + 4}`} dur="2s" repeatCount="indefinite" />}
              </circle>
              <circle cx={dev.x} cy={dev.y} r={size / 2} fill={COLORS.bgCard} stroke={isSelected ? COLORS.borderActive : COLORS.border} strokeWidth={isSelected ? 1.5 : 0.8} />
              <foreignObject x={dev.x - size / 4} y={dev.y - size / 4} width={size / 2} height={size / 2}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                  <DeviceIcon type={dev.type} size={size / 2.5} color={statusColor} />
                </div>
              </foreignObject>
              <text x={dev.x} y={dev.y + size / 2 + 12} textAnchor="middle" fill={COLORS.text} fontSize="8" fontFamily="JetBrains Mono, monospace">{dev.name}</text>
              <text x={dev.x} y={dev.y + size / 2 + 22} textAnchor="middle" fill={COLORS.textMuted} fontSize="7" fontFamily="JetBrains Mono, monospace">{dev.ip}</text>

              {/* Detail popup */}
              {isSelected && (
                <g filter="url(#devGlow)">
                  <rect x={dev.x + size / 2 + 8} y={dev.y - 40} width={160} height={72} rx={4} fill={COLORS.bgCard} stroke={COLORS.borderActive} strokeWidth="0.8" />
                  <text x={dev.x + size / 2 + 16} y={dev.y - 24} fill={COLORS.cyan} fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="bold">{dev.name}</text>
                  <text x={dev.x + size / 2 + 16} y={dev.y - 10} fill={COLORS.textDim} fontSize="8" fontFamily="DM Sans, sans-serif">{dev.model}</text>
                  <text x={dev.x + size / 2 + 16} y={dev.y + 4} fill={COLORS.textDim} fontSize="8" fontFamily="JetBrains Mono, monospace">IP: {dev.ip}</text>
                  <text x={dev.x + size / 2 + 16} y={dev.y + 18} fill={statusColor} fontSize="8" fontFamily="JetBrains Mono, monospace">{dev.status.toUpperCase()}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Title HUD */}
        <text x={20} y={24} fill={COLORS.cyan} fontSize="11" fontFamily="JetBrains Mono, monospace" letterSpacing="3" opacity="0.8">BOSSVIEW :: NETWORK TOPOLOGY</text>
        <text x={20} y={40} fill={COLORS.textMuted} fontSize="9" fontFamily="JetBrains Mono, monospace">{siteName} · {devices.length} DEVICES · {links.length} LINKS</text>
      </svg>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// VIEW: Rack / Floorplan View
// ═══════════════════════════════════════════════════════════════
const RackView = ({ siteName, racks }) => {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const unitH = 14;
  const rackW = 200;

  const typeColor = (type) => {
    const map = { firewall: COLORS.red, "switch-core": COLORS.cyan, switch: COLORS.blue, server: COLORS.green, storage: COLORS.purple, ups: COLORS.amber, patch: COLORS.textMuted, wireless: COLORS.purpleGlow };
    return map[type] || COLORS.textDim;
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "auto" }}>
      <ScanlineOverlay />
      <div style={{ padding: "16px 20px" }}>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: COLORS.cyan, letterSpacing: 3, marginBottom: 4 }}>BOSSVIEW :: RACK VIEW</div>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: COLORS.textMuted, marginBottom: 16 }}>{siteName} · {racks.length} RACKS</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {racks.map((rack) => (
            <div key={rack.id} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 12, width: rackW + 60 }}>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: COLORS.text, marginBottom: 8, textAlign: "center" }}>{rack.name}</div>
              <svg width={rackW + 40} height={rack.units * unitH + 10} viewBox={`0 0 ${rackW + 40} ${rack.units * unitH + 10}`}>
                {/* Rack frame */}
                <rect x={18} y={0} width={rackW + 4} height={rack.units * unitH + 4} rx={2} fill="none" stroke={COLORS.border} strokeWidth="1" />
                {/* U slots */}
                {Array.from({ length: rack.units }, (_, i) => (
                  <g key={i}>
                    <rect x={20} y={i * unitH + 2} width={rackW} height={unitH - 1} rx={1} fill={COLORS.bg} stroke={COLORS.border} strokeWidth="0.3" />
                    <text x={10} y={i * unitH + unitH / 2 + 4} fill={COLORS.textMuted} fontSize="6" fontFamily="JetBrains Mono, monospace" textAnchor="end">{i + 1}</text>
                  </g>
                ))}
                {/* Devices in rack */}
                {rack.devices.map((dev, di) => {
                  const y = (dev.u - 1) * unitH + 2;
                  const h = dev.height * unitH - 1;
                  const col = typeColor(dev.type);
                  const statusCol = dev.status === "operational" ? COLORS.green : dev.status === "warning" ? COLORS.amber : COLORS.red;
                  const isHovered = selectedUnit === `${rack.id}-${di}`;
                  return (
                    <g key={di} style={{ cursor: "pointer" }} onMouseEnter={() => setSelectedUnit(`${rack.id}-${di}`)} onMouseLeave={() => setSelectedUnit(null)}>
                      <rect x={20} y={y} width={rackW} height={h} rx={1} fill={col} fillOpacity={isHovered ? 0.25 : 0.12} stroke={isHovered ? col : COLORS.border} strokeWidth={isHovered ? 1.2 : 0.5} />
                      {/* Status LED */}
                      <circle cx={28} cy={y + h / 2} r={2.5} fill={statusCol}>
                        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <text x={38} y={y + h / 2 + 3} fill={COLORS.text} fontSize="8" fontFamily="JetBrains Mono, monospace">{dev.name}</text>
                      <text x={rackW + 10} y={y + h / 2 + 3} fill={COLORS.textMuted} fontSize="7" fontFamily="JetBrains Mono, monospace" textAnchor="end">{dev.type}</text>
                      {/* Hover glow */}
                      {isHovered && <rect x={20} y={y} width={rackW} height={h} rx={1} fill="none" stroke={col} strokeWidth="1" opacity="0.6">
                        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
                      </rect>}
                    </g>
                  );
                })}
              </svg>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {[
            { type: "firewall", label: "Firewall" }, { type: "switch-core", label: "Core Switch" },
            { type: "switch", label: "Access Switch" }, { type: "server", label: "Server" },
            { type: "storage", label: "Storage" }, { type: "ups", label: "UPS" },
          ].map((item) => (
            <div key={item.type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: typeColor(item.type), opacity: 0.5 }} />
              <span style={{ fontSize: 8, color: COLORS.textDim, fontFamily: "JetBrains Mono, monospace" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const VIEWS = [
  { id: "world", label: "GLOBAL MAP", icon: "◉" },
  { id: "stelzen-topo", label: "STELZENSTR. TOPOLOGY", icon: "⬡" },
  { id: "stelzen-rack", label: "STELZENSTR. RACKS", icon: "▦" },
  { id: "bas-topo", label: "DC BAS TOPOLOGY", icon: "⬡" },
  { id: "bas-rack", label: "DC BAS RACKS", icon: "▦" },
];

export default function InfrastructureMap() {
  const [activeView, setActiveView] = useState("world");
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case "world":
        return <WorldMapView onLocationClick={(loc) => { if (loc.id === "zrh") setActiveView("stelzen-topo"); }} />;
      case "stelzen-topo":
        return <NetworkTopologyView siteName="OFFICE STELZENSTRASSE · ZRH" vlans={STELZEN_VLANS} devices={STELZEN_DEVICES} links={STELZEN_LINKS} />;
      case "stelzen-rack":
        return <RackView siteName="OFFICE STELZENSTRASSE · ZRH" racks={STELZEN_RACKS} />;
      case "bas-topo":
        return <NetworkTopologyView siteName="DATACENTER BAS" vlans={BAS_VLANS} devices={BAS_DEVICES} links={BAS_LINKS} />;
      case "bas-rack":
        return <RackView siteName="DATACENTER BAS" racks={BAS_RACKS} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ width: "100%", height: "100vh", minHeight: 600, background: COLORS.bg, color: COLORS.text, fontFamily: "DM Sans, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── Top Bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgPanel, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.cyan, boxShadow: `0 0 8px ${COLORS.cyan}` }} />
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, fontWeight: 700, color: COLORS.cyan, letterSpacing: 2 }}>BOSSVIEW</span>
          </div>
          <span style={{ color: COLORS.textMuted, fontSize: 10 }}>│</span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1 }}>INFRASTRUCTURE MAP</span>
        </div>

        {/* Clock */}
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: COLORS.textMuted }}>
          {time.toLocaleTimeString("de-CH", { hour12: false })} UTC+1 · {time.toLocaleDateString("de-CH")}
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div style={{ display: "flex", gap: 2, padding: "6px 16px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgPanel, flexShrink: 0, overflowX: "auto" }}>
        {VIEWS.map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
              background: activeView === view.id ? `rgba(6,182,212,0.1)` : "transparent",
              border: `1px solid ${activeView === view.id ? COLORS.borderActive : "transparent"}`,
              borderRadius: 4, cursor: "pointer", transition: "all 0.2s",
              color: activeView === view.id ? COLORS.cyan : COLORS.textDim,
              fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: 1, whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 12 }}>{view.icon}</span>
            {view.label}
          </button>
        ))}
      </div>

      {/* ── Status Bar ── */}
      <div style={{ display: "flex", gap: 16, padding: "6px 16px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgPanel, flexShrink: 0, alignItems: "center" }}>
        <StatusBadge status="operational" />
        <span style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace" }}>
          {LOCATIONS.length} SITES · {LOCATIONS.reduce((s, l) => s + l.assets, 0)} ASSETS · {LOCATIONS.reduce((s, l) => s + l.servers, 0)} SERVERS
        </span>
        <span style={{ marginLeft: "auto", fontSize: 8, color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace" }}>
          {LOCATIONS.filter((l) => l.status === "warning").length > 0 && `⚠ ${LOCATIONS.filter((l) => l.status === "warning").length} WARNING`}
          {LOCATIONS.filter((l) => l.status === "maintenance").length > 0 && ` · 🔧 ${LOCATIONS.filter((l) => l.status === "maintenance").length} MAINT`}
        </span>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {renderView()}
      </div>

      {/* ── Bottom Bar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 16px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.bgPanel, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace" }}>BOSSVIEW v1.0 · LSYFN INFRASTRUCTURE MANAGEMENT</span>
        <span style={{ fontSize: 8, color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace" }}>ISO 27001 · AVIATION COMPLIANT</span>
      </div>
    </div>
  );
}