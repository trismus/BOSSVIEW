import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { InfraLocation, WanLink } from '../../types'

// ─── Dark Trace Color Palette ────────────────────────────────
const COLORS = {
  bg: '#0a0e17',
  bgCard: '#0f1420',
  border: '#1e293b',
  borderActive: '#0ea5e9',
  cyan: '#06b6d4',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#64748b',
  grid: 'rgba(6, 182, 212, 0.04)',
}

interface WorldMapViewProps {
  locations: InfraLocation[]
  wanLinks: WanLink[]
  onLocationClick: (location: InfraLocation) => void
}

// ─── Timezone definitions (based on PROTrack 7 Zeitzonen data) ─
interface TimezoneConfig {
  offset: number       // UTC offset in hours
  label: string        // Display label
  iana: string         // IANA timezone name
  primary?: boolean    // Highlight main zone
}

const TIMEZONES: TimezoneConfig[] = [
  { offset: -5, label: 'UTC-5', iana: 'America/New_York' },
  { offset: 1, label: 'UTC+1', iana: 'Europe/Berlin', primary: true },
  { offset: 2, label: 'UTC+2', iana: 'Europe/Istanbul' },
  { offset: 3, label: 'UTC+3', iana: 'Asia/Riyadh' },
  { offset: 5.5, label: 'UTC+5:30', iana: 'Asia/Kolkata' },
  { offset: 7, label: 'UTC+7', iana: 'Asia/Bangkok' },
  { offset: 8, label: 'UTC+8', iana: 'Asia/Hong_Kong' },
]

// ─── Mercator projection matching PROTrack viewBox 0 0 960 440 ─
function projectLatLon(lat: number, lon: number): [number, number] {
  // Map longitude [-180, 180] → [0, 960]
  const x = ((lon + 180) / 360) * 960
  // Mercator Y with clamping
  const latRad = (lat * Math.PI) / 180
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
  // Scale mercator to viewport: center ~y=220 at equator, range 0-440
  const y = 220 - mercN * 70
  return [Math.max(10, Math.min(950, x)), Math.max(10, Math.min(430, y))]
}

// ─── Longitude to SVG x in viewBox 0 0 960 440 ─────────────
function lonToX(lon: number): number {
  return ((lon + 180) / 360) * 960
}

// ─── Format time for a given IANA timezone ──────────────────
function formatTimeForTimezone(iana: string): string {
  try {
    return new Date().toLocaleTimeString('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: iana,
      hour12: false,
    })
  } catch {
    return '--:--'
  }
}

// ─── GeoJSON-derived world map paths from PROTrack Asset Dashboard ─
// Extracted from docs/data/PROTrack_Asset_Dashboard_LSYFN.html SVG viewBox="0 0 960 440"
const WORLD_MAP_PATHS = [
  // India / South Asia
  'M643.2,177.0L645.9,177.9L648.0,177.6L648.5,176.6L650.6,176.2L652.1,175.5L652.7,173.7L654.9,173.2L655.3,172.4L656.6,173.0L657.4,173.1L658.9,173.1L660.9,173.6L661.7,173.9L663.6,173.2L664.5,173.6L665.4,172.5L667.0,172.6L667.4,172.2L667.7,171.3L668.8,170.5L670.3,171.0L670.0,171.7L670.8,171.9L670.5,173.8L671.6,174.6L672.5,174.1L673.7,173.8L675.4,172.8L677.2,173.0L679.9,173.0L680.4,173.6L678.9,173.9L677.5,174.3L674.5,174.6L671.6,175.1L670.0,176.1L670.7,177.0L671.0,178.1L669.6,179.1L669.8,179.9L669.0,180.7L666.5,180.7L667.5,182.1L665.8,182.7L664.7,184.0L664.8,185.3L663.8,185.9L662.8,185.7L660.8,186.0L660.5,186.6L658.5,186.6L657.0,187.8L656.9,189.6L653.5,190.5L651.6,190.3L651.1,190.8L649.5,190.5L646.8,190.8L642.3,189.8L644.7,187.8L644.5,186.4L642.5,186.1L642.3,184.7L641.4,183.0L642.6,181.8L641.4,181.4L642.1,179.8L643.2,177.0Z',
  // East Africa / Madagascar region
  'M523.5,258.1L524.2,259.4L525.0,260.6L525.6,261.2L526.6,262.1L528.4,262.0L529.2,261.7L530.7,262.0L531.1,261.5L531.8,260.4L533.4,260.4L533.6,260.0L534.9,260.0L534.7,260.7L537.9,260.7L538.0,261.8L538.5,262.6L538.1,263.7L538.3,264.8L539.2,265.5L539.1,267.7L539.7,267.6L540.9,267.6L542.6,267.3L543.8,267.4L544.0,268.0L543.7,268.9L544.2,269.8L543.8,270.5L544.0,271.2L538.5,271.2L538.4,277.2L540.2,278.8L541.9,280.0L537.0,280.8L530.5,280.5L528.7,279.6L517.9,279.6L517.5,279.8L515.9,278.9L514.2,278.8L512.6,279.2L511.3,279.5L511.0,278.3L511.4,276.6L512.3,274.9L512.5,274.1L513.3,272.4L514.0,271.6L515.5,270.4L516.4,269.5L516.6,268.1L516.5,267.1L515.7,266.4L515.0,265.3L514.3,264.2L514.5,263.8L515.3,263.0L514.5,261.2L513.9,260.0L512.6,258.8L512.9,258.5L514.0,258.2L514.7,258.3L515.7,258.0L523.5,258.1Z',
  // Sri Lanka
  'M513.2,257.7L512.5,257.9L511.8,256.5L512.8,255.7L513.7,255.4L514.7,256.0L513.7,256.4L513.2,256.9L513.2,257.7Z',
  // Korea peninsula
  'M534.9,162.4L534.6,163.2L534.9,164.3L536.1,164.9L536.0,165.5L535.1,165.9L535.0,166.6L533.7,167.8L533.3,167.6L533.2,167.1L531.7,166.3L531.5,165.1L531.7,163.5L532.1,162.7L531.7,162.3L531.5,161.5L532.6,160.3L532.8,160.8L533.5,160.6L534.1,161.2L534.7,161.5L534.9,162.4Z',
  // Southeast Asian islands
  'M617.5,201.3L618.0,201.2L618.1,201.7L620.2,201.4L622.4,201.5L624.0,201.5L625.8,200.2L627.8,198.9L629.5,197.6L630.0,198.3L630.4,199.9L629.0,199.9L628.8,201.2L629.3,201.5L628.1,201.9L628.1,202.7L627.3,203.6L627.2,204.4L626.7,204.8L618.7,203.8L617.6,201.8L617.5,201.3Z',
  // Tierra del Fuego / Patagonia
  'M305.3,369.4L302.8,369.6L301.4,368.5L299.8,368.4L297.0,368.4L297.0,361.4L298.0,362.8L299.3,365.2L302.8,367.0L306.5,367.8L305.3,369.4Z',
  // South America
  'M306.8,288.9L308.3,290.3L309.4,288.7L312.4,288.8L312.8,289.2L317.7,292.5L319.9,292.8L323.2,294.3L325.9,295.1L326.3,296.0L323.7,299.1L326.4,299.6L329.4,299.9L331.5,299.6L333.9,298.0L334.3,296.2L335.7,295.8L337.0,297.0L336.9,298.7L334.7,299.8L332.9,300.6L329.9,302.7L326.3,305.6L325.7,307.3L325.0,309.5L325.0,311.6L324.4,312.1L324.2,313.6L324.0,314.7L327.4,316.6L327.0,318.2L328.7,319.2L328.6,320.3L326.0,323.3L322.0,324.5L316.7,325.0L313.8,324.8L314.3,326.2L313.8,328.0L314.3,329.2L312.7,330.1L309.9,330.4L307.4,329.5L306.4,330.2L306.7,332.6L308.5,333.3L310.0,332.6L310.8,333.9L308.3,334.6L306.2,336.2L305.8,338.8L305.2,340.2L302.6,340.2L300.5,341.5L299.8,343.5L302.4,345.4L305.0,346.0L304.0,348.4L300.9,350.0L299.2,353.3L296.7,354.4L295.6,355.8L296.5,358.8L298.3,360.6L297.1,360.4L294.7,359.9L288.2,359.5L287.1,357.8L287.2,355.6L285.4,355.8L284.5,354.8L284.2,351.7L286.3,350.5L287.1,348.7L286.8,347.4L288.2,345.0L289.2,341.5L288.9,340.0L290.1,339.5L289.8,338.5L288.6,338.0L289.4,336.9L288.2,336.0L287.6,333.1L288.7,332.6L288.2,329.6L288.9,327.1L289.6,325.0L291.2,324.1L290.4,321.9L290.3,319.8L292.4,318.3L292.3,316.4L293.8,314.2L293.8,312.2L293.1,311.8L291.9,308.0L293.5,305.8L293.3,303.8L294.3,301.8L296.0,299.9L297.9,298.6L297.1,297.8L297.6,297.1L297.6,293.8L300.5,292.8L301.4,290.7L301.0,290.2L303.3,288.4L306.8,288.9Z',
  // Japan main islands
  'M596.2,164.3L599.9,163.9L600.5,164.5L601.5,164.9L601.0,165.5L602.4,166.4L601.6,167.1L602.8,167.8L604.0,168.2L604.0,169.8L603.0,169.9L602.0,168.5L602.0,168.2L600.8,168.2L600.0,167.5L599.5,167.6L598.4,166.9L596.4,166.3L596.7,165.1L596.2,164.3Z',
  // Antarctica (base line paths)
  'M321.1,430.0L320.4,430.0L319.6,430.0L314.0,430.0L308.0,430.0L304.7,430.0L303.2,430.0L309.2,430.0L315.0,430.0L317.0,430.0L318.4,430.0L321.1,430.0Z',
  // Antarctica coastline / main mass
  'M323.7,402.3L314.3,411.2L309.4,424.3L317.3,430.0L300.8,430.0L278.9,430.0L275.6,430.0L320.8,430.0L360.5,430.0L403.9,430.0L385.8,430.0L416.2,430.0L436.1,430.0L455.7,430.0L475.2,430.0L499.0,430.0L519.3,430.0L540.2,430.0L565.3,428.2L583.1,428.8L604.0,417.8L623.0,409.9L641.6,418.2L663.7,419.4L662.5,430.0L675.6,430.0L693.6,420.1L713.3,414.4L731.1,415.5L750.9,411.7L774.0,413.5L793.0,414.5L816.3,412.9L839.4,411.3L853.1,414.4L873.9,420.4L898.2,426.7L923.0,430.0L932.7,430.0L916.2,430.0L916.4,430.0L916.5,430.0L955.4,430.0L15.0,430.0L58.5,430.0L77.6,430.0L68.2,430.0L75.8,430.0L65.8,430.0L89.3,430.0L116.2,430.0L145.6,430.0L176.1,430.0L200.3,430.0L204.5,430.0L226.5,430.0L252.8,430.0L276.7,430.0L301.0,430.0L299.8,422.4L308.9,406.6L325.8,398.6L323.7,402.3Z',
  // Tasmania
  'M663.8,349.8L665.5,350.7L668.1,351.0L668.2,351.6L667.4,352.9L663.3,353.0L663.3,351.5L663.6,350.4L663.8,349.8Z',
  // New Zealand South
  'M867.7,329.5L870.3,330.3L871.8,330.0L873.8,329.5L875.4,329.7L875.6,332.6L874.7,333.5L874.4,335.5L873.5,334.8L871.7,336.6L871.1,336.4L869.5,336.3L867.8,334.2L867.5,332.5L865.9,330.4L866.0,329.3L867.7,329.5Z',
  // Australia
  'M862.8,272.8L866.4,274.4L868.0,277.6L869.8,280.4L873.3,283.8L876.6,286.0L880.2,289.0L882.4,291.6L887.6,295.3L888.2,299.4L888.9,303.9L887.7,308.6L883.6,313.4L880.9,317.5L880.0,321.5L873.0,323.4L868.0,324.2L865.3,323.1L859.1,323.7L853.3,321.5L850.9,317.6L848.6,314.6L846.3,315.3L847.5,311.3L842.6,315.7L839.0,312.0L834.6,309.4L825.4,308.5L816.4,309.8L810.7,312.6L805.8,313.8L799.7,313.7L796.0,315.4L791.0,316.0L786.8,312.9L788.5,311.3L787.1,306.4L785.7,302.6L784.1,299.5L783.4,297.9L784.6,297.4L783.0,294.1L783.2,291.8L784.4,288.2L787.9,287.7L792.4,286.0L796.9,285.3L799.5,284.7L804.4,282.3L806.2,279.4L810.3,279.1L811.4,277.7L813.8,274.5L816.3,273.9L818.8,272.9L824.0,274.9L826.4,272.5L828.3,270.5L833.5,269.7L833.0,267.8L838.4,269.5L842.4,269.4L845.2,270.1L842.6,272.0L841.1,274.6L845.5,276.8L849.6,278.6L853.9,280.3L856.7,277.8L857.5,274.3L857.7,271.2L858.5,269.2L860.0,267.0L861.6,269.3L862.9,272.1L862.8,272.8Z',
  // Europe (Scandinavia / Baltic)
  'M525.3,146.1L525.1,147.2L523.6,147.2L524.1,147.8L523.2,149.5L522.7,150.0L520.4,150.0L519.0,150.7L516.8,150.4L513.0,149.8L512.4,148.8L509.8,149.3L509.5,149.8L507.8,149.4L506.5,149.3L505.3,148.9L505.7,148.2L505.6,147.7L506.4,147.6L507.7,148.3L508.1,147.6L510.5,147.7L512.4,147.2L513.7,147.3L514.5,147.9L514.7,147.4L514.4,145.6L515.3,145.3L516.3,144.0L518.2,144.9L519.7,143.7L520.7,143.5L522.7,144.4L524.0,144.2L525.2,144.8L525.0,145.1L525.3,146.1Z',
  // Japan additional
  'M600.0,167.5L600.8,168.2L602.0,168.2L602.0,168.5L603.0,169.9L601.2,169.6L599.9,168.5L599.5,167.6L600.0,167.5Z',
  // Japan (Hokkaido/Honshu extended)
  'M606.3,163.9L607.5,164.1L608.0,163.5L609.6,162.5L611.0,163.8L612.3,165.5L613.6,165.6L614.4,166.3L612.2,166.5L611.7,168.3L611.3,169.2L610.3,169.7L610.4,170.9L609.7,171.0L608.0,169.8L608.9,168.6L608.2,167.9L607.2,168.1L604.0,169.8L604.0,168.2L602.8,167.8L601.6,167.1L602.4,166.4L601.0,165.5L601.5,164.9L600.5,164.5L599.9,163.9L600.6,163.5L602.6,164.2L604.0,164.3L604.4,164.0L603.1,162.7L603.7,162.4L604.5,162.5L606.3,163.9Z',
  // Island (Indian Ocean region)
  'M558.2,255.5L558.1,253.3L557.4,252.5L559.0,252.6L559.8,251.6L561.3,251.7L561.4,252.4L562.0,252.8L562.0,253.4L561.3,253.8L560.3,254.8L559.3,255.4L558.2,255.5Z',
  // UK / Ireland
  'M488.8,136.9L490.8,137.1L493.3,136.5L495.0,137.8L496.4,138.5L496.1,140.4L495.4,140.5L495.1,142.1L492.8,140.8L491.4,141.1L489.6,139.7L488.3,138.6L487.1,138.5L486.7,137.5L488.8,136.9Z',
  // Central/West Africa
  'M487.2,235.7L485.0,235.9L484.3,234.7L484.4,230.4L483.9,230.0L483.8,229.1L482.9,228.4L482.1,227.9L482.4,226.9L483.3,226.7L483.9,225.9L485.2,225.7L485.7,225.1L486.6,224.6L487.6,224.6L489.6,225.7L489.5,226.3L490.1,227.4L489.6,228.1L489.9,228.7L488.6,229.8L487.8,230.4L487.3,231.5L487.3,232.7L487.2,235.7Z',
  // North/West Africa
  'M472.5,229.4L470.6,229.0L469.4,229.0L468.5,229.5L467.3,229.1L466.8,228.5L465.6,228.1L465.4,227.0L466.1,226.2L466.1,225.6L468.2,224.0L468.6,222.7L469.3,222.2L470.6,222.5L471.7,222.1L472.1,221.6L474.2,220.8L474.7,220.2L477.2,219.4L478.6,219.1L479.3,219.5L481.0,219.5L480.8,220.4L481.1,221.3L482.6,222.5L482.7,223.4L485.8,223.8L485.7,225.1L485.2,225.7L483.9,225.9L483.3,226.7L482.4,226.9L480.1,226.9L478.8,226.7L478.0,227.0L476.8,226.9L472.2,227.0L472.1,228.0L472.5,229.4Z',
  // Philippines / Pacific islands
  'M727.1,205.7L727.1,207.1L726.1,206.8L726.3,208.4L725.6,207.4L725.4,206.4L724.9,205.4L723.8,204.3L721.3,204.2L721.6,205.0L720.7,206.1L719.6,205.7L719.2,206.1L718.5,205.8L717.4,205.7L717.0,204.0L716.1,202.5L716.5,201.3L714.9,200.8L715.5,200.0L717.2,199.3L715.2,198.2L716.2,196.8L718.3,197.7L719.6,197.8L719.8,199.2L722.3,199.5L724.8,199.5L726.3,199.8L725.1,201.5L723.9,201.6L723.1,202.8L724.6,203.8L725.0,202.5L725.7,202.5L727.1,205.7Z',
  // Southeast Asia mainland
  'M540.4,156.4L541.2,157.5L542.2,157.3L544.3,157.7L548.2,157.8L549.5,157.1L552.6,156.6L554.6,157.5L556.2,157.7L554.8,158.8L553.8,160.6L554.7,162.0L552.4,161.7L549.6,162.5L549.6,163.7L547.2,163.9L545.3,163.1L543.2,163.7L541.2,163.7L541.0,162.0L539.7,161.2L540.1,160.9L539.8,160.6L540.3,159.8L541.3,159.0L540.0,157.9L539.8,157.0L540.4,156.4Z',
  // Caribbean islands
  'M273.2,202.3L272.6,202.4L271.9,201.2L270.9,200.6L271.5,199.3L272.3,199.4L273.2,201.1L273.2,202.3Z',
  // Caribbean islands 2
  'M272.5,196.5L269.6,196.9L269.4,196.1L270.6,195.9L272.4,196.0L272.5,196.5Z',
  // Africa main
  'M567.4,264.3L568.6,265.1L569.3,266.7L568.8,267.2L568.3,268.7L568.8,270.3L568.0,270.9L567.2,272.7L568.6,273.2L560.5,274.7L560.7,276.1L558.7,276.4L557.2,277.1L556.9,277.8L555.9,277.9L553.6,279.5L552.1,280.8L551.2,280.8L550.4,280.6L547.4,280.4L546.9,280.2L546.9,280.1L545.8,279.6L544.1,279.5L541.9,280.0L540.2,278.8L538.4,277.2L538.5,271.2L544.0,271.2L543.8,270.5L544.2,269.8L543.7,268.9L544.0,268.0L543.8,267.4L544.7,267.5L544.8,268.1L546.1,268.0L547.8,268.2L548.7,269.1L550.8,269.3L552.4,268.7L553.0,269.7L555.1,270.0L556.1,270.8L557.2,271.8L559.2,271.8L559.0,269.8L558.2,270.1L556.4,269.4L555.7,269.1L556.0,267.2L556.5,265.0L555.9,264.2L556.6,263.0L557.3,262.8L560.9,262.4L562.0,262.6L563.1,263.1L564.2,263.4L565.8,263.7L567.4,264.3Z',
  // Southeast Africa
  'M563.2,289.2L561.8,289.0L560.9,289.3L559.6,288.9L558.5,288.9L556.8,288.0L554.7,287.7L553.9,286.4L553.9,285.8L552.8,285.5L549.8,283.4L548.9,282.3L548.4,281.9L547.4,280.4L550.4,280.6L551.2,280.8L552.1,280.8L553.6,279.5L555.9,277.9L556.9,277.8L557.2,277.1L558.7,276.4L560.7,276.1L560.9,276.8L563.1,276.8L564.4,277.2L564.9,277.7L566.2,277.8L567.6,278.4L567.6,280.8L567.1,282.2L567.0,283.6L567.4,284.2L567.1,285.4L566.7,285.5L566.0,287.0L563.2,289.2Z',
  // NW Africa / Mediterranean
  'M557.3,302.9L556.1,302.2L554.9,302.7L553.4,303.5L552.0,304.8L554.0,306.5L555.0,306.3L555.4,305.6L556.9,305.2L557.4,304.5L558.2,303.5L557.3,302.9Z',
  // North America + massive continental path (approximate — Greenland, Canada, USA, Mexico, Central America)
  // Using a simplified outline since the PROTrack data focuses on southern hemisphere detail
  'M130,120 L150,105 L175,95 L200,85 L225,80 L245,82 L260,90 L270,105 L280,120 L285,135 L280,150 L275,165 L260,178 L250,185 L240,195 L235,200 L238,205 L245,210 L250,215 L255,218 L258,225 L255,230 L248,232 L242,228 L238,222 L235,215 L228,210 L220,208 L215,200 L210,195 L205,190 L200,188 L195,185 L180,180 L170,175 L160,172 L150,170 L140,165 L130,158 L120,150 L115,140 L118,130 L125,122 Z',
  // Eurasia main body (simplified to complement the detailed PROTrack paths)
  'M470,130 L480,125 L490,120 L500,115 L510,110 L520,108 L530,110 L540,112 L550,115 L560,120 L570,125 L580,130 L590,135 L600,140 L610,142 L620,145 L630,148 L640,152 L650,158 L660,160 L670,158 L680,155 L690,150 L700,148 L710,150 L720,155 L730,158 L735,162 L738,170 L735,178 L728,182 L720,185 L710,188 L700,190 L690,192 L680,190 L670,188 L660,185 L650,182 L640,178 L630,175 L620,172 L610,170 L600,168 L590,165 L580,162 L570,158 L560,155 L550,152 L540,150 L530,148 L520,150 L510,148 L500,145 L490,142 L480,140 L470,138 L465,135 Z',
  // Africa body
  'M475,195 L485,190 L495,188 L505,190 L515,195 L525,200 L535,210 L540,220 L542,230 L540,240 L538,248 L535,255 L530,260 L525,265 L520,270 L515,275 L510,278 L505,280 L498,278 L492,275 L488,270 L485,262 L483,252 L482,242 L480,232 L478,222 L475,212 L472,205 L470,200 L472,196 Z',
  // Middle East
  'M545,168 L555,165 L565,162 L575,160 L585,162 L590,168 L592,175 L590,182 L585,188 L578,192 L570,195 L562,192 L555,188 L550,182 L547,175 Z',
  // Indonesia archipelago (simplified)
  'M680,215 L690,212 L700,210 L710,212 L720,215 L730,218 L740,222 L745,228 L740,232 L730,235 L720,238 L710,240 L700,238 L690,235 L682,230 L678,225 L678,220 Z',
]

// ─── Animated Pulse Dot ──────────────────────────────────────
function PulseDot({ cx, cy, color, size = 4 }: { cx: number; cy: number; color: string; size?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={size} fill={color} opacity="0.8">
        <animate attributeName="r" values={`${size};${size * 3};${size}`} dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0;0.8" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={size * 0.7} fill={color} />
    </g>
  )
}

// ─── Animated Data Flow Line ─────────────────────────────────
function DataFlowLine({
  x1, y1, x2, y2, color, speed = '2s', dashed = false,
}: {
  x1: number; y1: number; x2: number; y2: number
  color: string; speed?: string; dashed?: boolean
}) {
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth="1" opacity="0.2"
        strokeDasharray={dashed ? '6 4' : 'none'}
      />
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth="1.5" opacity="0.6"
        strokeDasharray="4 12" strokeDashoffset="0"
      >
        <animate attributeName="stroke-dashoffset" values="0;-16" dur={speed} repeatCount="indefinite" />
      </line>
      <circle r="2" fill={color} opacity="0.9">
        <animateMotion dur={speed} repeatCount="indefinite" path={`M${x1},${y1} L${x2},${y2}`} />
      </circle>
    </g>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'operational': return COLORS.green
    case 'warning': return COLORS.amber
    case 'critical': return COLORS.red
    case 'maintenance': return COLORS.blue
    default: return COLORS.textMuted
  }
}

function getLinkColor(linkType: string): string {
  switch (linkType) {
    case 'primary': return COLORS.cyan
    case 'secondary': return COLORS.blue
    default: return COLORS.textMuted
  }
}

function getLocationTypeLabel(locationType: string): string {
  switch (locationType) {
    case 'headquarters': return 'HQ'
    case 'datacenter': return 'Datacenter'
    case 'office': return 'Office'
    case 'branch': return 'Branch'
    default: return locationType
  }
}

// ─── KPI Sidebar Component ──────────────────────────────────
function KpiSidebar({
  locations,
  wanLinks,
  onLocationClick,
}: {
  locations: InfraLocation[]
  wanLinks: WanLink[]
  onLocationClick: (loc: InfraLocation) => void
}) {
  const totalDevices = locations.reduce((sum, l) => sum + (l.device_count ?? 0), 0)
  const totalAssets = locations.reduce((sum, l) => sum + (l.asset_count ?? 0), 0)
  const activeWanLinks = wanLinks.length

  const statusCounts = useMemo(() => {
    const counts = { operational: 0, warning: 0, critical: 0, maintenance: 0, offline: 0 }
    for (const loc of locations) {
      const key = loc.status as keyof typeof counts
      if (key in counts) counts[key]++
    }
    return counts
  }, [locations])

  const kpiItemStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: `1px solid ${COLORS.border}`,
  }

  const kpiLabel: React.CSSProperties = {
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  }

  const kpiValue: React.CSSProperties = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 20,
    fontWeight: 700,
    color: COLORS.text,
    lineHeight: 1.2,
  }

  return (
    <div
      className="flex flex-col h-full shrink-0 overflow-hidden"
      style={{
        width: 240,
        background: COLORS.bgCard,
        borderLeft: `1px solid ${COLORS.border}`,
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            color: COLORS.cyan,
            letterSpacing: 2,
          }}
        >
          SYSTEM KPIs
        </div>
      </div>

      {/* KPI Cards */}
      <div className="shrink-0">
        {/* Total Locations */}
        <div style={kpiItemStyle}>
          <div style={kpiLabel}>Total Locations</div>
          <div className="flex items-center gap-3">
            <span style={kpiValue}>{locations.length}</span>
            <div className="flex items-center gap-1.5 ml-auto">
              {statusCounts.operational > 0 && (
                <span className="flex items-center gap-0.5">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS.green }} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: COLORS.textDim }}>
                    {statusCounts.operational}
                  </span>
                </span>
              )}
              {statusCounts.warning > 0 && (
                <span className="flex items-center gap-0.5">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS.amber }} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: COLORS.textDim }}>
                    {statusCounts.warning}
                  </span>
                </span>
              )}
              {statusCounts.critical > 0 && (
                <span className="flex items-center gap-0.5">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS.red }} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: COLORS.textDim }}>
                    {statusCounts.critical}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Total Devices */}
        <div style={kpiItemStyle}>
          <div style={kpiLabel}>Total Devices</div>
          <div style={kpiValue}>{totalDevices}</div>
        </div>

        {/* Total Assets */}
        <div style={kpiItemStyle}>
          <div style={kpiLabel}>Total Assets</div>
          <div style={kpiValue}>{totalAssets}</div>
        </div>

        {/* Uptime */}
        <div style={kpiItemStyle}>
          <div style={kpiLabel}>Uptime (30d)</div>
          <div style={{ ...kpiValue, color: COLORS.green }}>99.97%</div>
        </div>

        {/* Active WAN Links */}
        <div style={kpiItemStyle}>
          <div style={kpiLabel}>Active WAN Links</div>
          <div style={kpiValue}>{activeWanLinks}</div>
        </div>
      </div>

      {/* Location List */}
      <div
        className="px-3 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            color: COLORS.cyan,
            letterSpacing: 2,
          }}
        >
          LOCATIONS
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {locations.map(loc => {
          const statusColor = getStatusColor(loc.status)
          return (
            <button
              key={loc.id}
              onClick={() => onLocationClick(loc)}
              className="w-full text-left px-3 py-2 cursor-pointer transition-colors"
              style={{
                borderBottom: `1px solid ${COLORS.border}`,
                background: 'transparent',
                border: 'none',
                borderBottomWidth: 1,
                borderBottomStyle: 'solid',
                borderBottomColor: COLORS.border,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(6,182,212,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ background: statusColor, boxShadow: `0 0 4px ${statusColor}` }}
                />
                <span
                  className="truncate"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    fontWeight: 600,
                    color: COLORS.text,
                  }}
                >
                  {loc.code}
                </span>
                <span
                  className="ml-auto shrink-0"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    color: COLORS.textMuted,
                  }}
                >
                  {loc.device_count ?? 0}d
                </span>
              </div>
              <div
                className="mt-0.5 truncate"
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 9,
                  color: COLORS.textMuted,
                  paddingLeft: 16,
                }}
              >
                {loc.city}, {loc.country}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── HTML Tooltip Overlay ───────────────────────────────────
function LocationTooltip({
  location,
  svgRef,
  svgX,
  svgY,
}: {
  location: InfraLocation
  svgRef: React.RefObject<SVGSVGElement | null>
  svgX: number
  svgY: number
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const viewBox = svg.viewBox.baseVal
    if (!viewBox || viewBox.width === 0) return

    const scaleX = rect.width / viewBox.width
    const scaleY = rect.height / viewBox.height
    const scale = Math.min(scaleX, scaleY)

    // Center the viewBox in the SVG element
    const offsetX = (rect.width - viewBox.width * scale) / 2
    const offsetY = (rect.height - viewBox.height * scale) / 2

    const x = offsetX + (svgX - viewBox.x) * scale
    const y = offsetY + (svgY - viewBox.y) * scale

    setPos({ x, y })
  }, [svgRef, svgX, svgY])

  if (!pos) return null

  const statusColor = getStatusColor(location.status)
  const deviceCount = location.device_count ?? 0
  const assetCount = location.asset_count ?? 0
  const localTime = location.timezone ? formatTimeForTimezone(location.timezone) : '--:--'

  // Position tooltip above the dot, flip if too close to top
  const tooltipAbove = pos.y > 180
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: pos.x,
    ...(tooltipAbove ? { bottom: `calc(100% - ${pos.y}px + 16px)` } : { top: pos.y + 16 }),
    transform: 'translateX(-50%)',
    zIndex: 100,
    pointerEvents: 'none',
    minWidth: 200,
  }

  return (
    <div style={tooltipStyle}>
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.borderActive}`,
          boxShadow: `0 0 20px rgba(6,182,212,0.15), 0 4px 12px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Header */}
        <div
          className="px-3 py-2 flex items-center gap-2"
          style={{ borderBottom: `1px solid ${COLORS.border}` }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
          />
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.cyan,
            }}
          >
            {location.code}
          </span>
          <span
            className="ml-auto px-1.5 py-0.5 rounded"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 8,
              color: statusColor,
              background: `${statusColor}15`,
              border: `1px solid ${statusColor}30`,
              textTransform: 'uppercase' as const,
            }}
          >
            {location.status}
          </span>
        </div>

        {/* Body */}
        <div className="px-3 py-2">
          <div
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 11,
              color: COLORS.text,
              marginBottom: 2,
            }}
          >
            {location.name}
          </div>
          <div
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 10,
              color: COLORS.textMuted,
              marginBottom: 8,
            }}
          >
            {location.city}, {location.country} · {getLocationTypeLabel(location.location_type)}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: COLORS.textMuted }}>
                Devices
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: COLORS.text }}>
                {deviceCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: COLORS.textMuted }}>
                Assets
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: COLORS.text }}>
                {assetCount}
              </span>
            </div>
          </div>

          {/* Timezone */}
          {location.timezone && (
            <div
              className="mt-2 pt-2 flex items-center justify-between"
              style={{ borderTop: `1px solid ${COLORS.border}` }}
            >
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: COLORS.textMuted }}>
                {location.timezone}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: COLORS.cyan }}>
                {localTime}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-3 py-1.5 text-center"
          style={{
            background: 'rgba(6,182,212,0.05)',
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 8,
              color: COLORS.textDim,
              letterSpacing: 1,
            }}
          >
            CLICK TO EXPLORE
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main WorldMapView Component ────────────────────────────
export function WorldMapView({ locations, wanLinks, onLocationClick }: WorldMapViewProps) {
  const [hoveredLoc, setHoveredLoc] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Update time every 30 seconds for timezone labels
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Suppress unused var warning — currentTime triggers re-renders for timezone display
  void currentTime

  // Project locations to SVG coordinates
  const locPoints = useMemo(() =>
    locations.map(loc => {
      const [x, y] = projectLatLon(loc.latitude, loc.longitude)
      return { ...loc, x, y }
    }),
    [locations]
  )

  const hoveredLocation = useMemo(
    () => locPoints.find(l => l.id === hoveredLoc) ?? null,
    [locPoints, hoveredLoc]
  )

  // Precompute summary stats
  const totalAssets = useMemo(() =>
    locations.reduce((sum, l) => sum + (l.asset_count ?? 0), 0),
    [locations]
  )

  const totalDevices = useMemo(() =>
    locations.reduce((sum, l) => sum + (l.device_count ?? 0), 0),
    [locations]
  )

  const handleMouseEnter = useCallback((id: string) => setHoveredLoc(id), [])
  const handleMouseLeave = useCallback(() => setHoveredLoc(null), [])

  // Compute timezone band positions
  const timezoneBands = useMemo(() => {
    return TIMEZONES.map((tz) => {
      // Each timezone offset roughly corresponds to 15 degrees of longitude
      const centerLon = tz.offset * 15
      const bandWidth = 15 // 15 degrees per timezone hour
      const leftLon = centerLon - bandWidth / 2
      const rightLon = centerLon + bandWidth / 2

      const x1 = lonToX(leftLon)
      const x2 = lonToX(rightLon)

      return {
        ...tz,
        x1,
        x2,
        width: x2 - x1,
        centerX: (x1 + x2) / 2,
      }
    })
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex"
      style={{ background: COLORS.bg }}
    >
      {/* Map area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.012) 2px, rgba(6,182,212,0.012) 4px)',
          }}
        />

        {/* HTML Tooltip overlay */}
        {hoveredLocation && (
          <LocationTooltip
            location={hoveredLocation}
            svgRef={svgRef}
            svgX={hoveredLocation.x}
            svgY={hoveredLocation.y}
          />
        )}

        <svg
          ref={svgRef}
          viewBox="0 0 960 440"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="globeGlow">
              <stop offset="0%" stopColor={COLORS.cyan} stopOpacity="0.08" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowSoft">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Subtle grid lines */}
          {Array.from({ length: 25 }, (_, i) => (
            <line
              key={`gx${i}`}
              x1={i * 40} y1={0} x2={i * 40} y2={440}
              stroke={COLORS.grid} strokeWidth="0.3"
            />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <line
              key={`gy${i}`}
              x1={0} y1={i * 40} x2={960} y2={i * 40}
              stroke={COLORS.grid} strokeWidth="0.3"
            />
          ))}

          {/* Equator line */}
          <line
            x1={0} y1={220} x2={960} y2={220}
            stroke="rgba(6,182,212,0.06)" strokeWidth="0.5"
            strokeDasharray="8,4"
          />

          {/* Prime meridian */}
          <line
            x1={480} y1={0} x2={480} y2={440}
            stroke="rgba(6,182,212,0.06)" strokeWidth="0.5"
            strokeDasharray="8,4"
          />

          {/* Timezone bands */}
          {timezoneBands.map((tz, i) => (
            <g key={`tz-${i}`}>
              <rect
                x={tz.x1}
                y={0}
                width={tz.width}
                height={440}
                fill={tz.primary ? 'rgba(6,182,212,0.04)' : 'rgba(6,182,212,0.015)'}
                stroke={tz.primary ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.03)'}
                strokeWidth={tz.primary ? 0.8 : 0.3}
              />
              {/* Timezone label at bottom */}
              <text
                x={tz.centerX}
                y={432}
                textAnchor="middle"
                fill={tz.primary ? COLORS.cyan : COLORS.textMuted}
                fontSize={tz.primary ? '8' : '7'}
                fontFamily="JetBrains Mono, monospace"
                opacity={tz.primary ? 0.9 : 0.5}
                fontWeight={tz.primary ? 700 : 400}
              >
                {tz.label}
              </text>
              {/* Current local time */}
              <text
                x={tz.centerX}
                y={420}
                textAnchor="middle"
                fill={tz.primary ? COLORS.cyan : COLORS.textDim}
                fontSize="7"
                fontFamily="JetBrains Mono, monospace"
                opacity={tz.primary ? 0.8 : 0.4}
              >
                {formatTimeForTimezone(tz.iana)}
              </text>
            </g>
          ))}

          {/* Continent outlines — real GeoJSON-derived paths from PROTrack */}
          <g>
            {WORLD_MAP_PATHS.map((d, i) => (
              <path
                key={`map-${i}`}
                d={d}
                fill="rgba(6,182,212,0.05)"
                stroke="rgba(6,182,212,0.15)"
                strokeWidth="0.4"
              />
            ))}
          </g>

          {/* WAN link lines */}
          {wanLinks.map((link, i) => {
            const from = locPoints.find(l => l.id === link.from_location)
            const to = locPoints.find(l => l.id === link.to_location)
            if (!from || !to) return null
            const lineColor = getLinkColor(link.link_type)
            return (
              <DataFlowLine
                key={`wan-${i}`}
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                color={lineColor}
                speed={link.link_type === 'primary' ? '3s' : '5s'}
                dashed={link.link_type === 'backup'}
              />
            )
          })}

          {/* Location dots */}
          {locPoints.map(loc => {
            const statusColor = getStatusColor(loc.status)
            const isHQ = loc.location_type === 'headquarters'
            const isHovered = hoveredLoc === loc.id
            return (
              <g
                key={loc.id}
                className="cursor-pointer"
                onClick={() => onLocationClick(loc)}
                onMouseEnter={() => handleMouseEnter(loc.id)}
                onMouseLeave={handleMouseLeave}
              >
                {/* Hover highlight ring */}
                {isHovered && (
                  <circle
                    cx={loc.x} cy={loc.y}
                    r={isHQ ? 14 : 10}
                    fill="none"
                    stroke={statusColor}
                    strokeWidth="0.5"
                    opacity="0.4"
                  />
                )}

                <PulseDot
                  cx={loc.x} cy={loc.y}
                  color={statusColor}
                  size={isHQ ? 5 : 3.5}
                />

                {/* Location code label */}
                <text
                  x={loc.x} y={loc.y - (isHQ ? 14 : 10)}
                  textAnchor="middle"
                  fill={isHovered ? COLORS.cyan : COLORS.text}
                  fontSize={isHQ ? '9' : '8'}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={isHQ ? 700 : 500}
                  opacity={isHovered ? 1 : 0.75}
                  filter={isHovered ? 'url(#glowSoft)' : undefined}
                >
                  {loc.code}
                </text>
              </g>
            )
          })}

          {/* Title HUD */}
          <text
            x={16} y={20}
            fill={COLORS.cyan} fontSize="10"
            fontFamily="JetBrains Mono, monospace"
            letterSpacing="3" opacity="0.8"
          >
            BOSSVIEW :: GLOBAL INFRASTRUCTURE
          </text>
          <text
            x={16} y={34}
            fill={COLORS.textMuted} fontSize="8"
            fontFamily="JetBrains Mono, monospace"
          >
            LSYFN · {locations.length} LOCATIONS · {totalAssets} ASSETS · {totalDevices} DEVICES · 7 TIMEZONES
          </text>

          {/* Legend */}
          <g transform="translate(800, 16)">
            {[
              { label: 'Primary', color: COLORS.cyan, dashed: false },
              { label: 'Secondary', color: COLORS.blue, dashed: false },
              { label: 'Backup', color: COLORS.textMuted, dashed: true },
            ].map((item, i) => (
              <g key={item.label} transform={`translate(0, ${i * 14})`}>
                <line
                  x1={0} y1={0} x2={16} y2={0}
                  stroke={item.color} strokeWidth="1.5"
                  strokeDasharray={item.dashed ? '4 3' : 'none'}
                />
                <text
                  x={22} y={3}
                  fill={COLORS.textDim} fontSize="7"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {item.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* KPI Sidebar */}
      <KpiSidebar
        locations={locations}
        wanLinks={wanLinks}
        onLocationClick={onLocationClick}
      />
    </div>
  )
}
