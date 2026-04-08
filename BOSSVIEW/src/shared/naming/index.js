/**
 * BOSSVIEW Naming Convention — Public API
 *
 * Usage:
 *   import { parseDeviceName, resolveLocation, validateName } from '@shared/naming';
 */
export {
  // Konstanten
  COMPANY_PREFIX,
  LOCATIONS,
  WORKSTATION_LOCATION_MAP,
  DEVICE_TYPES,
  VLAN_BLOCKS,
  VLAN_FUNCTIONS,
  IP_OCTETS,
  PATTERNS,

  // Parser
  parseDeviceName,
  parseMultiple,

  // Resolver
  resolveLocation,
  resolveLocationDetails,
  resolveVlan,

  // Validator
  validateName,

  // Generator
  generateName,

  // VLAN / IP
  getVlanNumber,
  getSubnet,

  // Bulk
  groupByLocation,
  groupByCategory,
} from './namingConvention.js';
