import { useState, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// BOSSVIEW — Naming Convention Manager
// Interaktive Seite zum Verwalten, Testen und Editieren
// ═══════════════════════════════════════════════════════════════

const COLORS = {
  bg: "#0a0e17", bgCard: "#0f1420", bgPanel: "#111827", bgInput: "#1a2035",
  border: "#1e293b", borderActive: "#0ea5e9", borderHover: "#334155",
  cyan: "#06b6d4", cyanGlow: "#22d3ee", cyanDim: "#0e7490",
  blue: "#3b82f6", green: "#10b981", greenGlow: "#34d399",
  amber: "#f59e0b", red: "#ef4444", purple: "#8b5cf6",
  text: "#e2e8f0", textDim: "#94a3b8", textMuted: "#64748b",
};

// ─── Default Data ────────────────────────────────────────────
const DEFAULT_LOCATIONS = [
  { id: "zrh", code: "ZRH", name: "Region Zürich", fullName: "Zürich", city: "Zürich", type: "region", description: "Übergeordnet für alle Zürcher Standorte" },
  { id: "sts", code: "STS", name: "Stelzenstrasse", fullName: "Stelzenstrasse", city: "Zürich", type: "office", description: "Office / HQ" },
  { id: "bas", code: "BAS", name: "Baslerstrasse", fullName: "Baslerstrasse", city: "Zürich", type: "datacenter", description: "Datacenter" },
  { id: "pct", code: "PCT", name: "Princeton", fullName: "Princeton", city: "Princeton, NJ", type: "office", description: "US Office" },
];

const DEFAULT_DEVICE_TYPES = [
  { id: "ws-l", family: "workstation", code: "l", name: "Laptop", caseRule: "lower", seqLength: 3, description: "Windows/Linux Laptop" },
  { id: "ws-a", family: "workstation", code: "a", name: "Desktop", caseRule: "lower", seqLength: 3, description: "Desktop-PC" },
  { id: "ws-m", family: "workstation", code: "m", name: "Mac", caseRule: "lower", seqLength: 3, description: "MacBook / iMac" },
  { id: "srv-v", family: "server", code: "V", name: "Virtual Server", caseRule: "upper", seqLength: 3, description: "Virtuelle Maschine (VM)" },
  { id: "srv-s", family: "server", code: "S", name: "Physical Server", caseRule: "upper", seqLength: 2, description: "Physischer Server" },
];

const DEFAULT_NAMING_FAMILIES = [
  {
    id: "family-lido",
    name: "LIDO-Prefix",
    prefix: "LIDO",
    scope: "Endgeräte & Server",
    description: "Alles was im CMDB als Asset verwaltet wird (Workstations, Server).",
    pattern: "lido{standort}{typ}{sequenz} / LIDO{STANDORT}{TYP}{SEQUENZ}",
    examples: ["lidozrhl001", "lidopctm003", "LIDOZRHV001", "LIDOBASS01"],
  },
  {
    id: "family-location",
    name: "Standort-Prefix",
    prefix: "{REGION}{STANDORT}",
    scope: "Netzwerk & Infrastruktur",
    description: "Alles was über Netzwerk-Funktion und Standort identifiziert wird.",
    pattern: "{REGION}{STANDORT}{SEQUENZ}",
    examples: ["ZRHSTS001", "ZRHBAS01"],
  },
];

const DEFAULT_VLAN_BLOCKS = [
  { id: "vb-sts", locationCode: "STS", rangeStart: 10, rangeEnd: 99 },
  { id: "vb-bas", locationCode: "BAS", rangeStart: 100, rangeEnd: 199 },
  { id: "vb-pct", locationCode: "PCT", rangeStart: 200, rangeEnd: 299 },
];

const DEFAULT_VLAN_FUNCTIONS = [
  { id: "vf-mgmt", offset: 0, name: "Management", suffix: "x0" },
  { id: "vf-prod", offset: 20, name: "Production", suffix: "x20" },
  { id: "vf-dmz", offset: 30, name: "DMZ", suffix: "x30" },
  { id: "vf-guest", offset: 40, name: "Guest/IoT", suffix: "x40" },
  { id: "vf-voip", offset: 50, name: "VoIP/UC", suffix: "x50" },
  { id: "vf-backup", offset: 60, name: "Backup", suffix: "x60" },
  { id: "vf-storage", offset: 70, name: "Storage/IPMI", suffix: "x70" },
  { id: "vf-mon", offset: 80, name: "Monitoring", suffix: "x80" },
];

const DEFAULT_IP_OCTETS = [
  { locationCode: "STS", octet: 1 },
  { locationCode: "BAS", octet: 2 },
  { locationCode: "PCT", octet: 3 },
];

// ─── Name Parser ─────────────────────────────────────────────
function parseDeviceName(name, locations, deviceTypes) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Workstation: lido{standort}{typ}{seq}
  const wsMatch = trimmed.match(/^lido(zrh|pct|bas|sts)([lamw])(\d{3})$/i);
  if (wsMatch) {
    const [, locCode, typeCode, seq] = wsMatch;
    const loc = locations.find(l => l.code.toLowerCase() === locCode.toLowerCase());
    const dt = deviceTypes.find(d => d.family === "workstation" && d.code === typeCode.toLowerCase());
    const resolvedLoc = locCode.toLowerCase() === "zrh"
      ? locations.find(l => l.code === "STS")
      : loc;
    return {
      valid: true, family: "LIDO-Prefix", category: "Workstation",
      prefix: "lido", locationCode: locCode.toUpperCase(),
      resolvedLocation: resolvedLoc?.fullName || locCode,
      city: resolvedLoc?.city || "?",
      locationType: resolvedLoc?.type || "?",
      deviceType: dt?.name || typeCode, typeCode,
      sequence: seq, fullName: trimmed,
    };
  }

  // Server: LIDO{STANDORT}{TYP}{SEQ}
  const srvMatch = trimmed.match(/^LIDO(ZRH|BAS|PCT|STS)([VS])(\d{2,3})$/);
  if (srvMatch) {
    const [, locCode, typeCode, seq] = srvMatch;
    const loc = locations.find(l => l.code === locCode);
    const dt = deviceTypes.find(d => d.family === "server" && d.code === typeCode);
    return {
      valid: true, family: "LIDO-Prefix", category: "Server",
      prefix: "LIDO", locationCode: locCode,
      resolvedLocation: loc?.fullName || locCode,
      city: loc?.city || "?",
      locationType: loc?.type || "?",
      deviceType: dt?.name || typeCode, typeCode,
      sequence: seq, fullName: trimmed,
    };
  }

  // Network: {REGION}{STANDORT}{SEQ}
  const netMatch = trimmed.match(/^(ZRH)(STS|BAS)(\d{2,3})$/);
  if (netMatch) {
    const [, region, siteCode, seq] = netMatch;
    const loc = locations.find(l => l.code === siteCode);
    return {
      valid: true, family: "Standort-Prefix", category: "Netzwerk-Gerät",
      prefix: region + siteCode, locationCode: siteCode,
      resolvedLocation: loc?.fullName || siteCode,
      city: loc?.city || "?",
      locationType: loc?.type || "?",
      deviceType: "Netzwerk", typeCode: "NET",
      sequence: seq, fullName: trimmed,
    };
  }

  return { valid: false, fullName: trimmed, error: "Name entspricht keinem bekannten Schema." };
}

// ─── Reusable UI Components ──────────────────────────────────
const inputStyle = {
  background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, borderRadius: 4,
  color: COLORS.text, padding: "6px 10px", fontSize: 13, fontFamily: "JetBrains Mono, monospace",
  outline: "none", width: "100%", boxSizing: "border-box",
};
const btnStyle = (color = COLORS.cyan) => ({
  background: "transparent", border: `1px solid ${color}`, borderRadius: 4,
  color, padding: "5px 12px", fontSize: 11, cursor: "pointer",
  fontFamily: "JetBrains Mono, monospace", letterSpacing: 0.5, transition: "all 0.15s",
});
const btnDangerStyle = btnStyle(COLORS.red);
const labelStyle = { fontSize: 10, color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace", letterSpacing: 0.5, marginBottom: 3, display: "block" };
const sectionTitle = (text) => (
  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: COLORS.cyan, letterSpacing: 2, marginBottom: 12, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
    {text}
  </div>
);
const Badge = ({ children, color = COLORS.cyan }) => (
  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 10, fontFamily: "JetBrains Mono, monospace", background: `${color}15`, color, border: `1px solid ${color}30` }}>
    {children}
  </span>
);

// ─── Edit Modal ──────────────────────────────────────────────
const EditModal = ({ title, fields, data, onSave, onCancel }) => {
  const [formData, setFormData] = useState({ ...data });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.borderActive}`, borderRadius: 8, padding: 24, width: 420, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: COLORS.cyan, marginBottom: 16 }}>{title}</div>
        {fields.map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{f.label}</label>
            {f.type === "select" ? (
              <select value={formData[f.key] || ""} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type={f.type || "text"} value={formData[f.key] || ""} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} style={inputStyle} placeholder={f.placeholder || ""} />
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onCancel} style={btnStyle(COLORS.textMuted)}>ABBRECHEN</button>
          <button onClick={() => onSave(formData)} style={btnStyle(COLORS.green)}>SPEICHERN</button>
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Locations ──────────────────────────────────────────
const LocationsTab = ({ locations, setLocations }) => {
  const [editing, setEditing] = useState(null);
  const fields = [
    { key: "code", label: "CODE (3 Buchstaben)", placeholder: "ZRH" },
    { key: "name", label: "KURZNAME", placeholder: "Stelzenstrasse" },
    { key: "fullName", label: "VOLLSTÄNDIGER NAME", placeholder: "Stelzenstrasse" },
    { key: "city", label: "STADT", placeholder: "Zürich" },
    { key: "type", label: "TYP", type: "select", options: [
      { value: "region", label: "Region" }, { value: "office", label: "Office" },
      { value: "datacenter", label: "Datacenter" }, { value: "branch", label: "Branch" },
    ]},
    { key: "description", label: "BESCHREIBUNG", placeholder: "Office / HQ" },
  ];
  const addNew = () => setEditing({ id: `loc-${Date.now()}`, code: "", name: "", fullName: "", city: "", type: "office", description: "", _isNew: true });
  const save = (data) => {
    const clean = { ...data, code: data.code.toUpperCase() };
    delete clean._isNew;
    if (data._isNew) setLocations([...locations, clean]);
    else setLocations(locations.map(l => l.id === clean.id ? clean : l));
    setEditing(null);
  };
  const remove = (id) => { if (confirm("Standort wirklich löschen?")) setLocations(locations.filter(l => l.id !== id)); };

  return (
    <div>
      {sectionTitle("STANDORTE")}
      <p style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 16 }}>Standort-Codes bilden die Basis für alle Gerätenamen. Änderungen hier wirken sich auf das gesamte Naming-Schema aus.</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            {["Code", "Name", "Stadt", "Typ", "Beschreibung", ""].map(h => (
              <th key={h} style={{ padding: "8px 6px", textAlign: "left", color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: 1 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {locations.map(loc => (
            <tr key={loc.id} style={{ borderBottom: `1px solid ${COLORS.border}08` }}>
              <td style={{ padding: "8px 6px" }}><Badge>{loc.code}</Badge></td>
              <td style={{ padding: "8px 6px", color: COLORS.text }}>{loc.fullName}</td>
              <td style={{ padding: "8px 6px", color: COLORS.textDim }}>{loc.city}</td>
              <td style={{ padding: "8px 6px" }}><Badge color={loc.type === "datacenter" ? COLORS.purple : loc.type === "region" ? COLORS.amber : COLORS.green}>{loc.type}</Badge></td>
              <td style={{ padding: "8px 6px", color: COLORS.textMuted, fontSize: 11 }}>{loc.description}</td>
              <td style={{ padding: "8px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                <button onClick={() => setEditing(loc)} style={{ ...btnStyle(), padding: "3px 8px", marginRight: 4 }}>EDIT</button>
                <button onClick={() => remove(loc.id)} style={{ ...btnDangerStyle, padding: "3px 8px" }}>DEL</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={addNew} style={{ ...btnStyle(COLORS.green), marginTop: 12 }}>+ STANDORT HINZUFÜGEN</button>
      {editing && <EditModal title={editing._isNew ? "NEUER STANDORT" : `EDIT: ${editing.code}`} fields={fields} data={editing} onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  );
};

// ─── Tab: Device Types ───────────────────────────────────────
const DeviceTypesTab = ({ deviceTypes, setDeviceTypes }) => {
  const [editing, setEditing] = useState(null);
  const fields = [
    { key: "family", label: "FAMILIE", type: "select", options: [
      { value: "workstation", label: "Workstation" }, { value: "server", label: "Server" }, { value: "network", label: "Netzwerk" },
    ]},
    { key: "code", label: "TYP-BUCHSTABE", placeholder: "l" },
    { key: "name", label: "NAME", placeholder: "Laptop" },
    { key: "caseRule", label: "GROSS/KLEIN", type: "select", options: [
      { value: "lower", label: "Kleinbuchstabe" }, { value: "upper", label: "Grossbuchstabe" },
    ]},
    { key: "seqLength", label: "SEQUENZ-LÄNGE", type: "number", placeholder: "3" },
    { key: "description", label: "BESCHREIBUNG", placeholder: "Windows/Linux Laptop" },
  ];
  const addNew = () => setEditing({ id: `dt-${Date.now()}`, family: "workstation", code: "", name: "", caseRule: "lower", seqLength: 3, description: "", _isNew: true });
  const save = (data) => {
    const clean = { ...data, seqLength: parseInt(data.seqLength) || 3 };
    delete clean._isNew;
    if (data._isNew) setDeviceTypes([...deviceTypes, clean]);
    else setDeviceTypes(deviceTypes.map(d => d.id === clean.id ? clean : d));
    setEditing(null);
  };
  const remove = (id) => { if (confirm("Gerätetyp wirklich löschen?")) setDeviceTypes(deviceTypes.filter(d => d.id !== id)); };
  const grouped = { workstation: deviceTypes.filter(d => d.family === "workstation"), server: deviceTypes.filter(d => d.family === "server"), network: deviceTypes.filter(d => d.family === "network") };

  return (
    <div>
      {sectionTitle("GERÄTETYPEN")}
      <p style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 16 }}>Typ-Buchstaben bestimmen, welche Art von Gerät im Namen codiert ist. Workstations nutzen Kleinbuchstaben, Server Grossbuchstaben.</p>
      {Object.entries(grouped).map(([family, types]) => types.length > 0 && (
        <div key={family} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: COLORS.amber, fontFamily: "JetBrains Mono, monospace", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{family === "workstation" ? "Workstations (lido-Prefix)" : family === "server" ? "Server (LIDO-Prefix)" : "Netzwerk"}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 8 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {["Code", "Name", "Case", "Seq", "Beschreibung", "Beispiel", ""].map(h => (
                  <th key={h} style={{ padding: "6px", textAlign: "left", color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map(dt => (
                <tr key={dt.id} style={{ borderBottom: `1px solid ${COLORS.border}08` }}>
                  <td style={{ padding: "6px" }}><span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 16, color: COLORS.cyan, fontWeight: 700 }}>{dt.code}</span></td>
                  <td style={{ padding: "6px", color: COLORS.text }}>{dt.name}</td>
                  <td style={{ padding: "6px" }}><Badge color={dt.caseRule === "upper" ? COLORS.amber : COLORS.blue}>{dt.caseRule}</Badge></td>
                  <td style={{ padding: "6px", color: COLORS.textDim, fontFamily: "JetBrains Mono, monospace" }}>{dt.seqLength}-stellig</td>
                  <td style={{ padding: "6px", color: COLORS.textMuted, fontSize: 11 }}>{dt.description}</td>
                  <td style={{ padding: "6px", fontFamily: "JetBrains Mono, monospace", color: COLORS.greenGlow, fontSize: 11 }}>
                    {family === "workstation" ? `lidozrh${dt.code}${"0".repeat(dt.seqLength - 1)}1` : family === "server" ? `LIDOZRH${dt.code}${"0".repeat(dt.seqLength - 1)}1` : `ZRHSTS${"0".repeat(dt.seqLength - 1)}1`}
                  </td>
                  <td style={{ padding: "6px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => setEditing(dt)} style={{ ...btnStyle(), padding: "3px 8px", marginRight: 4 }}>EDIT</button>
                    <button onClick={() => remove(dt.id)} style={{ ...btnDangerStyle, padding: "3px 8px" }}>DEL</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <button onClick={addNew} style={{ ...btnStyle(COLORS.green), marginTop: 4 }}>+ GERÄTETYP HINZUFÜGEN</button>
      {editing && <EditModal title={editing._isNew ? "NEUER GERÄTETYP" : `EDIT: ${editing.name}`} fields={fields} data={editing} onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  );
};

// ─── Tab: VLAN Schema ────────────────────────────────────────
const VlanTab = ({ vlanBlocks, setVlanBlocks, vlanFunctions, setVlanFunctions, locations }) => {
  const [editingBlock, setEditingBlock] = useState(null);
  const [editingFunc, setEditingFunc] = useState(null);

  const blockFields = [
    { key: "locationCode", label: "STANDORT", type: "select", options: locations.filter(l => l.type !== "region").map(l => ({ value: l.code, label: `${l.code} — ${l.fullName}` })) },
    { key: "rangeStart", label: "VLAN START", type: "number" },
    { key: "rangeEnd", label: "VLAN END", type: "number" },
  ];
  const funcFields = [
    { key: "offset", label: "OFFSET (Einerstelle)", type: "number", placeholder: "20" },
    { key: "name", label: "FUNKTION", placeholder: "Production" },
  ];

  return (
    <div>
      {sectionTitle("VLAN-SCHEMA")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.amber, fontFamily: "JetBrains Mono, monospace", marginBottom: 8, letterSpacing: 1 }}>STANDORT-BLÖCKE</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {["Standort", "Bereich", ""].map(h => <th key={h} style={{ padding: "6px", textAlign: "left", color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {vlanBlocks.map(b => (
                <tr key={b.id}>
                  <td style={{ padding: "6px" }}><Badge>{b.locationCode}</Badge></td>
                  <td style={{ padding: "6px", fontFamily: "JetBrains Mono, monospace", color: COLORS.text }}>{b.rangeStart}–{b.rangeEnd}</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>
                    <button onClick={() => setEditingBlock(b)} style={{ ...btnStyle(), padding: "3px 8px", marginRight: 4 }}>EDIT</button>
                    <button onClick={() => setVlanBlocks(vlanBlocks.filter(x => x.id !== b.id))} style={{ ...btnDangerStyle, padding: "3px 8px" }}>DEL</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setEditingBlock({ id: `vb-${Date.now()}`, locationCode: "", rangeStart: 0, rangeEnd: 99, _isNew: true })} style={{ ...btnStyle(COLORS.green), marginTop: 8 }}>+ BLOCK</button>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.amber, fontFamily: "JetBrains Mono, monospace", marginBottom: 8, letterSpacing: 1 }}>FUNKTIONS-ZUORDNUNG</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {["Offset", "Funktion", ""].map(h => <th key={h} style={{ padding: "6px", textAlign: "left", color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {vlanFunctions.map(f => (
                <tr key={f.id}>
                  <td style={{ padding: "6px", fontFamily: "JetBrains Mono, monospace", color: COLORS.cyan }}>{f.suffix}</td>
                  <td style={{ padding: "6px", color: COLORS.text }}>{f.name}</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>
                    <button onClick={() => setEditingFunc(f)} style={{ ...btnStyle(), padding: "3px 8px", marginRight: 4 }}>EDIT</button>
                    <button onClick={() => setVlanFunctions(vlanFunctions.filter(x => x.id !== f.id))} style={{ ...btnDangerStyle, padding: "3px 8px" }}>DEL</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setEditingFunc({ id: `vf-${Date.now()}`, offset: 0, name: "", suffix: "x0", _isNew: true })} style={{ ...btnStyle(COLORS.green), marginTop: 8 }}>+ FUNKTION</button>
        </div>
      </div>

      {/* VLAN Matrix Preview */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, color: COLORS.amber, fontFamily: "JetBrains Mono, monospace", marginBottom: 8, letterSpacing: 1 }}>VORSCHAU: VLAN MATRIX</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr>
              <th style={{ padding: "4px 8px", color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 9 }}></th>
              {vlanFunctions.map(f => <th key={f.id} style={{ padding: "4px 8px", color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 9 }}>{f.name}</th>)}
            </tr></thead>
            <tbody>
              {vlanBlocks.map(b => (
                <tr key={b.id}>
                  <td style={{ padding: "4px 8px", fontFamily: "JetBrains Mono, monospace", color: COLORS.cyan }}>{b.locationCode}</td>
                  {vlanFunctions.map(f => {
                    const vlanNum = b.rangeStart + f.offset;
                    const inRange = vlanNum >= b.rangeStart && vlanNum <= b.rangeEnd;
                    return <td key={f.id} style={{ padding: "4px 8px", fontFamily: "JetBrains Mono, monospace", color: inRange ? COLORS.greenGlow : COLORS.textMuted, fontSize: 11, textAlign: "center" }}>{inRange ? vlanNum : "—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingBlock && <EditModal title="VLAN BLOCK" fields={blockFields} data={editingBlock} onSave={(d) => { const c = { ...d, rangeStart: parseInt(d.rangeStart), rangeEnd: parseInt(d.rangeEnd) }; delete c._isNew; if (d._isNew) setVlanBlocks([...vlanBlocks, c]); else setVlanBlocks(vlanBlocks.map(x => x.id === c.id ? c : x)); setEditingBlock(null); }} onCancel={() => setEditingBlock(null)} />}
      {editingFunc && <EditModal title="VLAN FUNKTION" fields={funcFields} data={editingFunc} onSave={(d) => { const c = { ...d, offset: parseInt(d.offset), suffix: `x${d.offset}` }; delete c._isNew; if (d._isNew) setVlanFunctions([...vlanFunctions, c]); else setVlanFunctions(vlanFunctions.map(x => x.id === c.id ? c : x)); setEditingFunc(null); }} onCancel={() => setEditingFunc(null)} />}
    </div>
  );
};

// ─── Tab: Name Parser / Validator ────────────────────────────
const ParserTab = ({ locations, deviceTypes }) => {
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);

  const handleParse = useCallback(() => {
    const names = input.split(/[\n,;]+/).map(n => n.trim()).filter(Boolean);
    setResults(names.map(n => parseDeviceName(n, locations, deviceTypes)));
  }, [input, locations, deviceTypes]);

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleParse(); } };

  return (
    <div>
      {sectionTitle("NAME PARSER / VALIDATOR")}
      <p style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 12 }}>Gerätenamen eingeben (einer pro Zeile oder kommagetrennt). Der Parser löst den Namen auf und zeigt Standort, Typ und Sequenz.</p>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <textarea
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={"lidozrhl001\nLIDOZRHV042\nZRHSTS003\nLIDOBASS01"}
          rows={5}
          style={{ ...inputStyle, resize: "vertical", flex: 1, fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}
        />
        <button onClick={handleParse} style={{ ...btnStyle(COLORS.green), alignSelf: "flex-start", padding: "10px 20px", fontSize: 12 }}>PARSE</button>
      </div>

      {results.length > 0 && (
        <div>
          {results.map((r, i) => (
            <div key={i} style={{
              background: COLORS.bgCard, border: `1px solid ${r.valid ? COLORS.border : COLORS.red}`,
              borderRadius: 6, padding: 12, marginBottom: 8,
              borderLeft: `3px solid ${r.valid ? COLORS.green : COLORS.red}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 15, color: r.valid ? COLORS.cyanGlow : COLORS.red, fontWeight: 700 }}>{r.fullName}</span>
                <Badge color={r.valid ? COLORS.green : COLORS.red}>{r.valid ? "VALID" : "INVALID"}</Badge>
              </div>
              {r.valid ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 11 }}>
                  {[
                    ["Familie", r.family],
                    ["Kategorie", r.category],
                    ["Standort", `${r.resolvedLocation} (${r.city})`],
                    ["Typ", r.deviceType],
                    ["Standort-Code", r.locationCode],
                    ["Location-Typ", r.locationType],
                    ["Sequenz", r.sequence],
                    ["Typ-Code", r.typeCode],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ color: COLORS.textMuted, fontSize: 9, fontFamily: "JetBrains Mono, monospace", letterSpacing: 0.5 }}>{label}</div>
                      <div style={{ color: COLORS.text, fontFamily: "JetBrains Mono, monospace" }}>{value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: COLORS.red, fontSize: 12 }}>{r.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Tab: Naming Families Overview ───────────────────────────
const FamiliesTab = ({ families }) => (
  <div>
    {sectionTitle("NAMING-FAMILIEN ÜBERSICHT")}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {families.map(f => (
        <div key={f.id} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 14, color: COLORS.cyan, marginBottom: 4 }}>{f.name}</div>
          <Badge color={COLORS.amber}>{f.scope}</Badge>
          <p style={{ fontSize: 12, color: COLORS.textDim, margin: "10px 0 8px" }}>{f.description}</p>
          <div style={{ marginBottom: 8 }}>
            <div style={labelStyle}>PATTERN</div>
            <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: COLORS.greenGlow, background: COLORS.bg, padding: "4px 8px", borderRadius: 3, display: "block" }}>{f.pattern}</code>
          </div>
          <div>
            <div style={labelStyle}>BEISPIELE</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {f.examples.map(ex => (
                <code key={ex} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: COLORS.text, background: COLORS.bg, padding: "2px 6px", borderRadius: 3 }}>{ex}</code>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const TABS = [
  { id: "overview", label: "ÜBERSICHT", icon: "◎" },
  { id: "locations", label: "STANDORTE", icon: "◉" },
  { id: "types", label: "GERÄTETYPEN", icon: "⬡" },
  { id: "vlans", label: "VLANs", icon: "▦" },
  { id: "parser", label: "NAME PARSER", icon: "⟐" },
];

export default function NamingConventionManager() {
  const [activeTab, setActiveTab] = useState("overview");
  const [locations, setLocations] = useState(DEFAULT_LOCATIONS);
  const [deviceTypes, setDeviceTypes] = useState(DEFAULT_DEVICE_TYPES);
  const [vlanBlocks, setVlanBlocks] = useState(DEFAULT_VLAN_BLOCKS);
  const [vlanFunctions, setVlanFunctions] = useState(DEFAULT_VLAN_FUNCTIONS);

  const stats = useMemo(() => ({
    locations: locations.length,
    deviceTypes: deviceTypes.length,
    vlanBlocks: vlanBlocks.length,
    families: DEFAULT_NAMING_FAMILIES.length,
  }), [locations, deviceTypes, vlanBlocks]);

  return (
    <div style={{ width: "100%", height: "100vh", minHeight: 600, background: COLORS.bg, color: COLORS.text, fontFamily: "DM Sans, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgPanel, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.cyan, boxShadow: `0 0 8px ${COLORS.cyan}` }} />
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, fontWeight: 700, color: COLORS.cyan, letterSpacing: 2 }}>BOSSVIEW</span>
          </div>
          <span style={{ color: COLORS.textMuted, fontSize: 10 }}>│</span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1 }}>NAMING CONVENTION MANAGER</span>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: COLORS.textMuted }}>
          <span>{stats.locations} Standorte</span>
          <span>·</span>
          <span>{stats.deviceTypes} Gerätetypen</span>
          <span>·</span>
          <span>{stats.families} Familien</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 16px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgPanel, flexShrink: 0 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
            background: activeTab === tab.id ? "rgba(6,182,212,0.1)" : "transparent",
            border: `1px solid ${activeTab === tab.id ? COLORS.borderActive : "transparent"}`,
            borderRadius: 4, cursor: "pointer", transition: "all 0.2s",
            color: activeTab === tab.id ? COLORS.cyan : COLORS.textDim,
            fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: 1,
          }}>
            <span style={{ fontSize: 13 }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        {activeTab === "overview" && <FamiliesTab families={DEFAULT_NAMING_FAMILIES} />}
        {activeTab === "locations" && <LocationsTab locations={locations} setLocations={setLocations} />}
        {activeTab === "types" && <DeviceTypesTab deviceTypes={deviceTypes} setDeviceTypes={setDeviceTypes} />}
        {activeTab === "vlans" && <VlanTab vlanBlocks={vlanBlocks} setVlanBlocks={setVlanBlocks} vlanFunctions={vlanFunctions} setVlanFunctions={setVlanFunctions} locations={locations} />}
        {activeTab === "parser" && <ParserTab locations={locations} deviceTypes={deviceTypes} />}
      </div>

      {/* Bottom Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 16px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.bgPanel, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace" }}>BOSSVIEW v1.0 · NAMING CONVENTION v2.1</span>
        <span style={{ fontSize: 8, color: COLORS.textMuted, fontFamily: "JetBrains Mono, monospace" }}>ISO 27001 · AVIATION COMPLIANT</span>
      </div>
    </div>
  );
}