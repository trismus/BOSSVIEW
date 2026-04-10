/* eslint-disable @typescript-eslint/no-explicit-any */

// OpenAPI 3.0 spec built programmatically (no JSDoc annotations in route files).
// Types are kept loose (Record<string, any>) to avoid a hard dependency on openapi-types.

type Schema = Record<string, any>
type Param = Record<string, any>
type Resp = Record<string, any>

// ============================================
// Component Schemas
// ============================================

const UserSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    email: { type: 'string', format: 'email', example: 'ops@lsyfn.aero' },
    name: { type: 'string', example: 'Max Muster' },
    role: { type: 'string', enum: ['admin', 'engineer', 'manager', 'auditor', 'readonly'], example: 'engineer' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
}

const AssetSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    external_id: { type: 'string', nullable: true, example: 'KACE-4821' },
    source: { type: 'string', example: 'quest-kace' },
    name: { type: 'string', example: 'lidozrhv193' },
    type: { type: 'string', enum: ['workstation', 'virtual_server', 'physical_server', 'network_device', 'storage', 'software', 'license', 'other'], example: 'virtual_server' },
    status: { type: 'string', enum: ['active', 'inactive', 'maintenance', 'decommissioned'], example: 'active' },
    lifecycle_stage: { type: 'string', enum: ['planning', 'procurement', 'deployment', 'active', 'maintenance', 'decommissioned', 'disposed'], example: 'active' },
    criticality: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'unclassified'], example: 'high' },
    ip_address: { type: 'string', nullable: true, example: '10.80.12.193' },
    os: { type: 'string', nullable: true, example: 'Ubuntu 22.04 LTS' },
    location: { type: 'object', example: { name: 'LSYFN Atlas Edge (Nugolo)', city: 'ZRH', country: 'CH', type: 'edge' } },
    hardware_info: { type: 'object', example: { manufacturer: 'Dell Inc.', model: 'PowerEdge R740' } },
    tags: { type: 'object', example: { fqdn: 'lidozrhv193.lidozrh.ch', company_code: 'LSYFN' } },
    custom_fields: { type: 'object' },
    created_by: { type: 'string', format: 'uuid' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
}

const IncidentSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    external_id: { type: 'string', nullable: true, example: 'INC-20240312-001' },
    source: { type: 'string', example: 'manual' },
    title: { type: 'string', example: 'Core switch ZRHSTSW01 port flapping on ge-0/0/12' },
    description: { type: 'string', nullable: true },
    priority: { type: 'string', enum: ['p1', 'p2', 'p3', 'p4'], example: 'p2' },
    status: { type: 'string', enum: ['open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed'], example: 'open' },
    category: { type: 'string', nullable: true, example: 'network' },
    assigned_to: { type: 'string', format: 'uuid', nullable: true },
    reported_by: { type: 'string', format: 'uuid', nullable: true },
    sla_target: { type: 'string', format: 'date-time', nullable: true },
    opened_at: { type: 'string', format: 'date-time' },
    resolved_at: { type: 'string', format: 'date-time', nullable: true },
    closed_at: { type: 'string', format: 'date-time', nullable: true },
    mttr_minutes: { type: 'integer', nullable: true, example: 45 },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
}

const ChangeSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    external_id: { type: 'string', nullable: true, example: 'CHG-2024-0087' },
    source: { type: 'string', example: 'manual' },
    title: { type: 'string', example: 'Firmware upgrade ZRHSTSW01 to Junos 23.4R2' },
    description: { type: 'string', nullable: true },
    risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], example: 'high' },
    status: { type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected', 'in_progress', 'completed', 'failed', 'cancelled'], example: 'approved' },
    requested_by: { type: 'string', format: 'uuid', nullable: true },
    approved_by: { type: 'string', format: 'uuid', nullable: true },
    scheduled_start: { type: 'string', format: 'date-time', nullable: true },
    scheduled_end: { type: 'string', format: 'date-time', nullable: true },
    actual_start: { type: 'string', format: 'date-time', nullable: true },
    actual_end: { type: 'string', format: 'date-time', nullable: true },
    rollback_plan: { type: 'string', nullable: true },
    success: { type: 'boolean', nullable: true },
    post_review: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
}

const VulnerabilitySchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    external_id: { type: 'string', nullable: true, example: 'QID-90783' },
    source: { type: 'string', example: 'qualys' },
    title: { type: 'string', example: 'Microsoft Windows 10 End of Life (EOL) Detected' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'], example: 'critical' },
    category: { type: 'string', nullable: true, example: 'EOL/Obsolete Software' },
    affected_hosts: { type: 'integer', example: 173 },
    status: { type: 'string', enum: ['open', 'fixed', 'ignored', 'accepted'], example: 'open' },
    first_seen: { type: 'string', format: 'date-time', nullable: true },
    last_seen: { type: 'string', format: 'date-time', nullable: true },
    remediation: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
}

const ConnectorSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Quest KACE PROTrack' },
    adapter_type: { type: 'string', example: 'quest-kace' },
    category: { type: 'string', enum: ['itsm', 'monitoring', 'cmdb', 'security', 'import', 'workflow'], example: 'cmdb' },
    config: { type: 'object', properties: { _redacted: { type: 'boolean', example: true } } },
    config_masked: { type: 'object', example: { base_url: 'https://kace.lsyfn.aero/***', api_key: '***' } },
    enabled: { type: 'boolean', example: true },
    schedule: { type: 'string', nullable: true, example: '0 2 * * *' },
    last_sync_at: { type: 'string', format: 'date-time', nullable: true },
    last_sync_status: { type: 'string', nullable: true, enum: ['success', 'partial', 'failed'] },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
}

const InfraLocationSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    code: { type: 'string', example: 'ZRH-DC1' },
    name: { type: 'string', example: 'LSYFN On premises' },
    city: { type: 'string', example: 'Zurich' },
    country: { type: 'string', example: 'CH' },
    latitude: { type: 'number', example: 47.4502 },
    longitude: { type: 'number', example: 8.5618 },
    location_type: { type: 'string', enum: ['headquarters', 'datacenter', 'office', 'branch'], example: 'datacenter' },
    status: { type: 'string', enum: ['operational', 'warning', 'critical', 'maintenance', 'offline'], example: 'operational' },
    timezone: { type: 'string', nullable: true, example: 'Europe/Zurich' },
    device_count: { type: 'integer', example: 42 },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
}

const InfraDeviceSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    location_id: { type: 'string', format: 'uuid' },
    asset_id: { type: 'string', format: 'uuid', nullable: true },
    name: { type: 'string', example: 'ZRHSTSW01' },
    device_type: { type: 'string', enum: ['firewall', 'switch-core', 'switch', 'router', 'server', 'storage', 'wireless', 'ups', 'patch-panel', 'pdu'], example: 'switch-core' },
    model: { type: 'string', nullable: true, example: 'EX4300-48T' },
    manufacturer: { type: 'string', nullable: true, example: 'Juniper Networks' },
    serial_number: { type: 'string', nullable: true, example: 'PE3721GN0042' },
    ip_address: { type: 'string', nullable: true, example: '10.80.1.1' },
    firmware: { type: 'string', nullable: true, example: 'Junos 23.2R1' },
    status: { type: 'string', enum: ['operational', 'warning', 'critical', 'maintenance', 'offline', 'decommissioned'], example: 'operational' },
    vlan_id: { type: 'string', format: 'uuid', nullable: true },
    rack_id: { type: 'string', format: 'uuid', nullable: true },
    rack_u_start: { type: 'integer', nullable: true, example: 22 },
    rack_u_height: { type: 'integer', example: 1 },
    topo_x: { type: 'number', example: 450 },
    topo_y: { type: 'number', example: 200 },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
}

const ErrorSchema: Schema = {
  type: 'object',
  required: ['error', 'code'],
  properties: {
    error: { type: 'string', example: 'Not found' },
    code: { type: 'string', example: 'NOT_FOUND' },
  },
}

const PaginationParams: Param[] = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 }, description: 'Page number' },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 }, description: 'Items per page' },
]

const IdParam: Param = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
  description: 'Resource UUID',
}

// ============================================
// Helper: paginated response wrapper
// ============================================
function paginatedResponse(itemRef: string, description: string): Resp {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: `#/components/schemas/${itemRef}` } },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
  }
}

function dataResponse(ref: string, description: string): Resp {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            data: { $ref: `#/components/schemas/${ref}` },
          },
        },
      },
    },
  }
}

function dataArrayResponse(ref: string, description: string): Resp {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: `#/components/schemas/${ref}` } },
          },
        },
      },
    },
  }
}

const unauthorized: Resp = {
  description: 'Authentication required',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
}

const forbidden: Resp = {
  description: 'Insufficient permissions',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
}

const notFound: Resp = {
  description: 'Resource not found',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
}

// ============================================
// OpenAPI Spec
// ============================================

export const swaggerSpec: Record<string, any> = {
  openapi: '3.0.3',
  info: {
    title: 'SKYNEX API',
    version: '0.1.0',
    description: 'IT Infrastructure Management Platform for Aviation Industry — REST API.\n\nSKYNEX provides centralized asset management, incident tracking, change management, vulnerability oversight, and infrastructure topology for the LSYFN aviation operations environment.',
    contact: {
      name: 'SKYNEX Team',
    },
  },
  servers: [
    { url: '/api/v1', description: 'API v1' },
  ],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Authentication and session management' },
    { name: 'Assets', description: 'IT asset lifecycle management (CMDB)' },
    { name: 'Incidents', description: 'Incident tracking and MTTR metrics' },
    { name: 'Changes', description: 'Change management with approval workflow' },
    { name: 'Vulnerabilities', description: 'Vulnerability tracking (Qualys integration)' },
    { name: 'Connectors', description: 'External system connectors and sync management' },
    { name: 'Infrastructure', description: 'Network topology, locations, devices, VLANs, and racks' },
    { name: 'Dashboard', description: 'Aggregated KPIs for the operations dashboard' },
    { name: 'Health', description: 'System health checks' },
  ],
  paths: {
    // ============================================
    // Auth
    // ============================================
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate user',
        description: 'Validate email and password, return JWT tokens.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'ops@lsyfn.aero' },
                  password: { type: 'string', minLength: 1, example: 'securePassword123' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
                    refreshToken: { type: 'string', example: 'dGhpcyBpcyBhIHJlZnJl...' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout and revoke refresh token',
        description: 'Revoke the given refresh token, ending the session.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Logged out successfully' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        description: 'Exchange a valid refresh token for a new access/refresh token pair.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tokens refreshed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid or expired refresh token',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile',
        description: 'Return the authenticated user\'s profile information.',
        responses: {
          '200': {
            description: 'Current user profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '401': unauthorized,
        },
      },
    },

    // ============================================
    // Assets
    // ============================================
    '/assets': {
      get: {
        tags: ['Assets'],
        summary: 'List assets (paginated)',
        description: 'Retrieve a paginated list of IT assets with filtering and sorting. Accessible by all authenticated roles.',
        parameters: [
          ...PaginationParams,
          { name: 'sort', in: 'query', schema: { type: 'string', default: 'created_at' }, description: 'Sort column' },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, description: 'Sort direction' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'maintenance', 'decommissioned'] }, description: 'Filter by status' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['workstation', 'virtual_server', 'physical_server', 'network_device', 'storage', 'software', 'license', 'other'] }, description: 'Filter by asset type' },
          { name: 'criticality', in: 'query', schema: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'unclassified'] }, description: 'Filter by criticality' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Full-text search across name, external_id, IP, OS' },
        ],
        responses: {
          '200': paginatedResponse('Asset', 'Paginated asset list'),
          '401': unauthorized,
          '403': forbidden,
        },
      },
      post: {
        tags: ['Assets'],
        summary: 'Create a new asset',
        description: 'Create a new IT asset. Requires admin or engineer role.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                  external_id: { type: 'string' },
                  source: { type: 'string' },
                  name: { type: 'string', minLength: 1, maxLength: 255, example: 'lidozrhv194' },
                  type: { type: 'string', enum: ['workstation', 'virtual_server', 'physical_server', 'network_device', 'storage', 'software', 'license', 'other'] },
                  status: { type: 'string', enum: ['active', 'inactive', 'maintenance', 'decommissioned'], default: 'active' },
                  lifecycle_stage: { type: 'string', enum: ['planning', 'procurement', 'deployment', 'active', 'maintenance', 'decommissioned', 'disposed'], default: 'active' },
                  criticality: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'unclassified'], default: 'unclassified' },
                  ip_address: { type: 'string', nullable: true },
                  os: { type: 'string', nullable: true },
                  location: { type: 'object' },
                  hardware_info: { type: 'object' },
                  tags: { type: 'array', items: {} },
                  custom_fields: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '201': dataResponse('Asset', 'Asset created'),
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/assets/{id}': {
      get: {
        tags: ['Assets'],
        summary: 'Get asset by ID',
        description: 'Retrieve a single asset by its UUID.',
        parameters: [IdParam],
        responses: {
          '200': dataResponse('Asset', 'Single asset'),
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
      put: {
        tags: ['Assets'],
        summary: 'Update an asset',
        description: 'Partially update an existing asset. Requires admin or engineer role. Creates an audit trail entry.',
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  status: { type: 'string' },
                  lifecycle_stage: { type: 'string' },
                  criticality: { type: 'string' },
                  ip_address: { type: 'string', nullable: true },
                  os: { type: 'string', nullable: true },
                  location: { type: 'object' },
                  hardware_info: { type: 'object' },
                  tags: { type: 'array', items: {} },
                  custom_fields: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '200': dataResponse('Asset', 'Asset updated'),
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
      delete: {
        tags: ['Assets'],
        summary: 'Delete an asset',
        description: 'Permanently delete an asset. Requires admin role. Creates an audit trail entry.',
        parameters: [IdParam],
        responses: {
          '200': {
            description: 'Asset deleted',
            content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } },
          },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },
    '/assets/{id}/history': {
      get: {
        tags: ['Assets'],
        summary: 'Get asset audit history',
        description: 'Retrieve the audit log entries for a specific asset. Requires admin, engineer, manager, or auditor role.',
        parameters: [IdParam],
        responses: {
          '200': {
            description: 'Audit log entries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          action: { type: 'string', example: 'UPDATE' },
                          entity_type: { type: 'string', example: 'asset' },
                          entity_id: { type: 'string', format: 'uuid' },
                          old_value: { type: 'object' },
                          new_value: { type: 'object' },
                          user_id: { type: 'string', format: 'uuid' },
                          created_at: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/assets/import': {
      post: {
        tags: ['Assets'],
        summary: 'Bulk import assets from CSV',
        description: 'Upload a CSV file to bulk import assets. Supports both SKYNEX native format and PROTrack (Quest KACE) format. The PROTrack format is auto-detected. Requires admin or engineer role.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'CSV file (max 10 MB)',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Import result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Imported 247 assets' },
                    imported: { type: 'integer', example: 247 },
                    errors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          row: { type: 'integer' },
                          error: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid CSV or missing file',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/assets/{id}/relations': {
      get: {
        tags: ['Assets'],
        summary: 'Get asset relations',
        description: 'List all relations (incoming and outgoing) for a given asset.',
        parameters: [IdParam],
        responses: {
          '200': {
            description: 'Asset relations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          source_id: { type: 'string', format: 'uuid' },
                          target_id: { type: 'string', format: 'uuid' },
                          relation_type: { type: 'string', enum: ['depends_on', 'runs_on', 'connected_to', 'backup_of'] },
                          direction: { type: 'string', enum: ['incoming', 'outgoing'] },
                          related_asset_id: { type: 'string', format: 'uuid' },
                          related_asset_name: { type: 'string' },
                          related_asset_type: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
      post: {
        tags: ['Assets'],
        summary: 'Create asset relation',
        description: 'Create a directed relation between two assets. Requires admin or engineer role.',
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['targetId', 'relationType'],
                properties: {
                  targetId: { type: 'string', format: 'uuid' },
                  relationType: { type: 'string', enum: ['depends_on', 'runs_on', 'connected_to', 'backup_of'] },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Relation created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        source_id: { type: 'string', format: 'uuid' },
                        target_id: { type: 'string', format: 'uuid' },
                        relation_type: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Self-relation not allowed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
          '409': { description: 'Relation already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/assets/{id}/relations/{relationId}': {
      delete: {
        tags: ['Assets'],
        summary: 'Delete asset relation',
        description: 'Remove a relation between two assets. Requires admin or engineer role.',
        parameters: [
          IdParam,
          { name: 'relationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Relation UUID' },
        ],
        responses: {
          '200': {
            description: 'Relation deleted',
            content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } },
          },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },

    // ============================================
    // Incidents
    // ============================================
    '/incidents': {
      get: {
        tags: ['Incidents'],
        summary: 'List incidents (paginated)',
        description: 'Retrieve a paginated list of incidents with filtering by status, priority, and search.',
        parameters: [
          ...PaginationParams,
          { name: 'sort', in: 'query', schema: { type: 'string', default: 'opened_at', enum: ['title', 'priority', 'status', 'opened_at', 'resolved_at', 'created_at', 'updated_at'] } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['p1', 'p2', 'p3', 'p4'] } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in title, external_id, description' },
        ],
        responses: {
          '200': paginatedResponse('Incident', 'Paginated incident list'),
          '401': unauthorized,
          '403': forbidden,
        },
      },
      post: {
        tags: ['Incidents'],
        summary: 'Create a new incident',
        description: 'Create a new incident record. Requires admin, engineer, or manager role. Optionally link assets.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  external_id: { type: 'string', nullable: true },
                  source: { type: 'string', default: 'manual' },
                  title: { type: 'string', minLength: 1, maxLength: 500, example: 'Core switch ZRHSTSW01 unreachable' },
                  description: { type: 'string', nullable: true },
                  priority: { type: 'string', enum: ['p1', 'p2', 'p3', 'p4'], default: 'p3' },
                  status: { type: 'string', enum: ['open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed'], default: 'open' },
                  category: { type: 'string', nullable: true },
                  assigned_to: { type: 'string', format: 'uuid', nullable: true },
                  reported_by: { type: 'string', format: 'uuid', nullable: true },
                  sla_target: { type: 'string', format: 'date-time', nullable: true },
                  asset_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'UUIDs of affected assets' },
                },
              },
            },
          },
        },
        responses: {
          '201': dataResponse('Incident', 'Incident created'),
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/incidents/stats': {
      get: {
        tags: ['Incidents'],
        summary: 'Get incident statistics',
        description: 'Aggregated statistics: total count, breakdown by priority and status, average MTTR.',
        responses: {
          '200': {
            description: 'Incident statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 127 },
                        by_priority: { type: 'object', example: { p1: 3, p2: 12, p3: 67, p4: 45 } },
                        by_status: { type: 'object', example: { open: 18, investigating: 5, resolved: 85, closed: 19 } },
                        avg_mttr: { type: 'integer', nullable: true, description: 'Average MTTR in minutes', example: 42 },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/incidents/{id}': {
      get: {
        tags: ['Incidents'],
        summary: 'Get incident by ID',
        description: 'Retrieve a single incident with linked assets.',
        parameters: [IdParam],
        responses: {
          '200': {
            description: 'Incident with linked assets',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      allOf: [
                        { $ref: '#/components/schemas/Incident' },
                        {
                          type: 'object',
                          properties: {
                            assets: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  asset_id: { type: 'string', format: 'uuid' },
                                  name: { type: 'string' },
                                  type: { type: 'string' },
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
      put: {
        tags: ['Incidents'],
        summary: 'Update an incident',
        description: 'Update incident fields and/or linked assets. Auto-sets resolved_at when status changes to "resolved". Requires admin, engineer, or manager role.',
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  priority: { type: 'string', enum: ['p1', 'p2', 'p3', 'p4'] },
                  status: { type: 'string', enum: ['open', 'investigating', 'identified', 'monitoring', 'resolved', 'closed'] },
                  category: { type: 'string', nullable: true },
                  assigned_to: { type: 'string', format: 'uuid', nullable: true },
                  sla_target: { type: 'string', format: 'date-time', nullable: true },
                  resolved_at: { type: 'string', format: 'date-time', nullable: true },
                  closed_at: { type: 'string', format: 'date-time', nullable: true },
                  mttr_minutes: { type: 'integer', minimum: 0, nullable: true },
                  asset_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
                },
              },
            },
          },
        },
        responses: {
          '200': dataResponse('Incident', 'Incident updated'),
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },

    // ============================================
    // Changes
    // ============================================
    '/changes': {
      get: {
        tags: ['Changes'],
        summary: 'List changes (paginated)',
        description: 'Retrieve a paginated list of change requests with filtering.',
        parameters: [
          ...PaginationParams,
          { name: 'sort', in: 'query', schema: { type: 'string', default: 'created_at', enum: ['title', 'risk_level', 'status', 'scheduled_start', 'created_at', 'updated_at'] } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected', 'in_progress', 'completed', 'failed', 'cancelled'] } },
          { name: 'risk_level', in: 'query', schema: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in title, external_id, description' },
        ],
        responses: {
          '200': paginatedResponse('Change', 'Paginated change list'),
          '401': unauthorized,
          '403': forbidden,
        },
      },
      post: {
        tags: ['Changes'],
        summary: 'Create a new change request',
        description: 'Create a new change request. Requires admin, engineer, or manager role.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  external_id: { type: 'string', nullable: true },
                  source: { type: 'string', default: 'manual' },
                  title: { type: 'string', minLength: 1, maxLength: 500, example: 'Firmware upgrade ZRHSTSW01 to Junos 23.4R2' },
                  description: { type: 'string', nullable: true },
                  risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
                  status: { type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected', 'in_progress', 'completed', 'failed', 'cancelled'], default: 'draft' },
                  requested_by: { type: 'string', format: 'uuid', nullable: true },
                  scheduled_start: { type: 'string', format: 'date-time', nullable: true },
                  scheduled_end: { type: 'string', format: 'date-time', nullable: true },
                  rollback_plan: { type: 'string', nullable: true },
                  asset_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
                },
              },
            },
          },
        },
        responses: {
          '201': dataResponse('Change', 'Change created'),
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/changes/calendar': {
      get: {
        tags: ['Changes'],
        summary: 'Get change calendar',
        description: 'Retrieve upcoming and recent changes grouped by scheduled date. Returns changes from 7 days ago onwards.',
        responses: {
          '200': {
            description: 'Changes grouped by date',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      additionalProperties: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Change' },
                      },
                      example: {
                        '2024-03-15': [{ id: '...', title: 'Firmware upgrade', risk_level: 'high', status: 'approved' }],
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/changes/{id}': {
      get: {
        tags: ['Changes'],
        summary: 'Get change by ID',
        description: 'Retrieve a single change request with linked assets.',
        parameters: [IdParam],
        responses: {
          '200': {
            description: 'Change with linked assets',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      allOf: [
                        { $ref: '#/components/schemas/Change' },
                        {
                          type: 'object',
                          properties: {
                            assets: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  asset_id: { type: 'string', format: 'uuid' },
                                  name: { type: 'string' },
                                  type: { type: 'string' },
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
      put: {
        tags: ['Changes'],
        summary: 'Update a change request',
        description: 'Update change fields, approval status, and/or linked assets. Only managers and admins can approve/reject changes.',
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                  status: { type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected', 'in_progress', 'completed', 'failed', 'cancelled'] },
                  approved_by: { type: 'string', format: 'uuid', nullable: true },
                  scheduled_start: { type: 'string', format: 'date-time', nullable: true },
                  scheduled_end: { type: 'string', format: 'date-time', nullable: true },
                  actual_start: { type: 'string', format: 'date-time', nullable: true },
                  actual_end: { type: 'string', format: 'date-time', nullable: true },
                  rollback_plan: { type: 'string', nullable: true },
                  success: { type: 'boolean', nullable: true },
                  post_review: { type: 'string', nullable: true },
                  asset_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
                },
              },
            },
          },
        },
        responses: {
          '200': dataResponse('Change', 'Change updated'),
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },

    // ============================================
    // Vulnerabilities
    // ============================================
    '/vulnerabilities': {
      get: {
        tags: ['Vulnerabilities'],
        summary: 'List vulnerabilities (paginated)',
        description: 'Retrieve a paginated list of vulnerabilities with filtering by severity, status, category.',
        parameters: [
          ...PaginationParams,
          { name: 'sort', in: 'query', schema: { type: 'string', default: 'affected_hosts', enum: ['title', 'severity', 'affected_hosts', 'status', 'category', 'first_seen', 'last_seen', 'created_at'] } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'fixed', 'ignored', 'accepted'] } },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in title' },
        ],
        responses: {
          '200': paginatedResponse('Vulnerability', 'Paginated vulnerability list'),
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/vulnerabilities/stats': {
      get: {
        tags: ['Vulnerabilities'],
        summary: 'Get vulnerability statistics',
        description: 'Aggregated vulnerability metrics: total open, breakdown by severity/status/category, top 10 by affected hosts, EOL count, and affected host rate.',
        responses: {
          '200': {
            description: 'Vulnerability statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 892 },
                        by_severity: { type: 'object', example: { critical: 47, high: 189, medium: 412, low: 244 } },
                        by_status: { type: 'object', example: { open: 892, fixed: 341, ignored: 12 } },
                        by_category: { type: 'object', example: { 'EOL/Obsolete Software': 58, 'Missing Patches': 312 } },
                        top10: { type: 'array', items: { $ref: '#/components/schemas/Vulnerability' } },
                        affected_host_rate: { type: 'string', example: '70%' },
                        eol_count: { type: 'integer', example: 58 },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/vulnerabilities/{id}': {
      get: {
        tags: ['Vulnerabilities'],
        summary: 'Get vulnerability by ID',
        description: 'Retrieve a single vulnerability with linked assets and detection dates.',
        parameters: [IdParam],
        responses: {
          '200': {
            description: 'Vulnerability with linked assets',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      allOf: [
                        { $ref: '#/components/schemas/Vulnerability' },
                        {
                          type: 'object',
                          properties: {
                            assets: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  asset_id: { type: 'string', format: 'uuid' },
                                  name: { type: 'string' },
                                  type: { type: 'string' },
                                  detected_at: { type: 'string', format: 'date-time' },
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },

    // ============================================
    // Connectors
    // ============================================
    '/connectors': {
      get: {
        tags: ['Connectors'],
        summary: 'List configured connectors',
        description: 'Paginated list of configured connectors with masked credentials.',
        parameters: PaginationParams,
        responses: {
          '200': paginatedResponse('Connector', 'Paginated connector list'),
          '401': unauthorized,
          '403': forbidden,
        },
      },
      post: {
        tags: ['Connectors'],
        summary: 'Create a new connector',
        description: 'Configure a new external system connector. Config is validated against the adapter schema. Requires admin or engineer role.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'adapter_type', 'category'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 255, example: 'Quest KACE PROTrack' },
                  adapter_type: { type: 'string', example: 'quest-kace' },
                  category: { type: 'string', enum: ['itsm', 'monitoring', 'cmdb', 'security', 'import', 'workflow'] },
                  config: { type: 'object', description: 'Adapter-specific configuration (credentials, URLs, etc.)', example: { base_url: 'https://kace.lsyfn.aero', api_key: 'sk-...' } },
                  enabled: { type: 'boolean', default: false },
                  schedule: { type: 'string', nullable: true, description: 'Cron expression for scheduled sync', example: '0 2 * * *' },
                },
              },
            },
          },
        },
        responses: {
          '201': dataResponse('Connector', 'Connector created (credentials masked)'),
          '400': { description: 'Invalid adapter type or configuration', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/connectors/adapters': {
      get: {
        tags: ['Connectors'],
        summary: 'List available adapter types',
        description: 'Get all registered adapter types with their configuration schemas. Requires admin or engineer role.',
        responses: {
          '200': {
            description: 'Available adapters',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', example: 'quest-kace' },
                          name: { type: 'string', example: 'Quest KACE' },
                          version: { type: 'string', example: '1.0.0' },
                          category: { type: 'string' },
                          configSchema: { type: 'object', description: 'JSON Schema for the adapter config' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/connectors/{id}': {
      get: {
        tags: ['Connectors'],
        summary: 'Get connector by ID',
        description: 'Retrieve a single connector with masked config and adapter info.',
        parameters: [IdParam],
        responses: {
          '200': dataResponse('Connector', 'Connector with adapter info (credentials masked)'),
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
      put: {
        tags: ['Connectors'],
        summary: 'Update connector configuration',
        description: 'Update connector name, config, schedule, or enabled flag. Config is re-validated against the adapter schema. Requires admin or engineer role.',
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  config: { type: 'object' },
                  enabled: { type: 'boolean' },
                  schedule: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '200': dataResponse('Connector', 'Connector updated (credentials masked)'),
          '400': { description: 'Invalid config', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },
    '/connectors/{id}/test': {
      post: {
        tags: ['Connectors'],
        summary: 'Test connector connection',
        description: 'Test connectivity to the external system using the stored config. Returns success/failure with a diagnostic message.',
        parameters: [IdParam],
        responses: {
          '200': {
            description: 'Connection test successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Connection successful — 247 assets available' },
                  },
                },
              },
            },
          },
          '422': {
            description: 'Connection test failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Connection refused: ECONNREFUSED' },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/connectors/{id}/sync': {
      post: {
        tags: ['Connectors'],
        summary: 'Trigger manual sync',
        description: 'Trigger an immediate data sync for the connector. Returns a sync log ID for tracking progress.',
        parameters: [IdParam],
        responses: {
          '202': {
            description: 'Sync triggered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Sync started' },
                    logId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
          '500': { description: 'Sync trigger failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/connectors/{id}/logs': {
      get: {
        tags: ['Connectors'],
        summary: 'Get sync logs for a connector',
        description: 'Paginated list of sync execution logs for a specific connector.',
        parameters: [
          IdParam,
          ...PaginationParams,
        ],
        responses: {
          '200': {
            description: 'Paginated sync logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          connector_id: { type: 'string', format: 'uuid' },
                          status: { type: 'string', enum: ['running', 'success', 'partial', 'failed'] },
                          started_at: { type: 'string', format: 'date-time' },
                          finished_at: { type: 'string', format: 'date-time', nullable: true },
                          records_fetched: { type: 'integer' },
                          records_created: { type: 'integer' },
                          records_updated: { type: 'integer' },
                          records_failed: { type: 'integer' },
                          error_message: { type: 'string', nullable: true },
                        },
                      },
                    },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    totalPages: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },

    // ============================================
    // Infrastructure
    // ============================================
    '/infrastructure/locations': {
      get: {
        tags: ['Infrastructure'],
        summary: 'List all locations',
        description: 'Retrieve all infrastructure locations with device status counts.',
        responses: {
          '200': {
            description: 'Locations with device counts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        allOf: [
                          { $ref: '#/components/schemas/InfraLocation' },
                          {
                            type: 'object',
                            properties: {
                              operational_count: { type: 'integer' },
                              warning_count: { type: 'integer' },
                              critical_count: { type: 'integer' },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/infrastructure/locations/{id}': {
      get: {
        tags: ['Infrastructure'],
        summary: 'Get location by ID',
        description: 'Retrieve a single infrastructure location with device count.',
        parameters: [IdParam],
        responses: {
          '200': dataResponse('InfraLocation', 'Single location'),
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
      put: {
        tags: ['Infrastructure'],
        summary: 'Update location',
        description: 'Update location details. Requires admin or engineer role.',
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  city: { type: 'string' },
                  country: { type: 'string' },
                  latitude: { type: 'number', minimum: -90, maximum: 90 },
                  longitude: { type: 'number', minimum: -180, maximum: 180 },
                  location_type: { type: 'string', enum: ['headquarters', 'datacenter', 'office', 'branch'] },
                  status: { type: 'string', enum: ['operational', 'warning', 'critical', 'maintenance', 'offline'] },
                  timezone: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '200': dataResponse('InfraLocation', 'Location updated'),
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },
    '/infrastructure/locations/{id}/topology': {
      get: {
        tags: ['Infrastructure'],
        summary: 'Get full topology for a location',
        description: 'Retrieve the complete network topology including VLANs, devices, device links, and racks for a specific location. Used for the topology map view.',
        parameters: [IdParam],
        responses: {
          '200': {
            description: 'Full topology data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    location: { $ref: '#/components/schemas/InfraLocation' },
                    vlans: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, vlan_id: { type: 'integer', example: 80 }, name: { type: 'string', example: 'Management' }, subnet: { type: 'string', example: '10.80.1.0/24' } } } },
                    devices: { type: 'array', items: { $ref: '#/components/schemas/InfraDevice' } },
                    links: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, from_device: { type: 'string', format: 'uuid' }, to_device: { type: 'string', format: 'uuid' }, from_port: { type: 'string' }, to_port: { type: 'string' }, link_type: { type: 'string' }, bandwidth: { type: 'string' } } } },
                    racks: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, total_units: { type: 'integer' }, devices: { type: 'array', items: { type: 'object' } } } } },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },
    '/infrastructure/wan-links': {
      get: {
        tags: ['Infrastructure'],
        summary: 'Get WAN connections',
        description: 'Retrieve all WAN links between locations with coordinates for map rendering.',
        responses: {
          '200': {
            description: 'WAN links',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          from_location: { type: 'string', format: 'uuid' },
                          to_location: { type: 'string', format: 'uuid' },
                          link_type: { type: 'string', example: 'MPLS' },
                          bandwidth: { type: 'string', example: '1 Gbps' },
                          provider: { type: 'string', example: 'Swisscom' },
                          status: { type: 'string' },
                          from_code: { type: 'string', example: 'ZRH-DC1' },
                          from_name: { type: 'string' },
                          from_latitude: { type: 'number' },
                          from_longitude: { type: 'number' },
                          to_code: { type: 'string' },
                          to_name: { type: 'string' },
                          to_latitude: { type: 'number' },
                          to_longitude: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/infrastructure/devices': {
      get: {
        tags: ['Infrastructure'],
        summary: 'List devices (paginated)',
        description: 'Retrieve a paginated list of infrastructure devices with filtering.',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
          { name: 'location_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Filter by location' },
          { name: 'device_type', in: 'query', schema: { type: 'string', enum: ['firewall', 'switch-core', 'switch', 'router', 'server', 'storage', 'wireless', 'ups', 'patch-panel', 'pdu'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['operational', 'warning', 'critical', 'maintenance', 'offline', 'decommissioned'] } },
          { name: 'vlan_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in name, model, manufacturer, IP address' },
        ],
        responses: {
          '200': {
            description: 'Paginated device list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/InfraDevice' } },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        pages: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/infrastructure/devices/{id}': {
      get: {
        tags: ['Infrastructure'],
        summary: 'Get device by ID',
        description: 'Retrieve a single device with connected links, location info, VLAN, rack, and linked asset.',
        parameters: [IdParam],
        responses: {
          '200': {
            description: 'Device with links',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      allOf: [
                        { $ref: '#/components/schemas/InfraDevice' },
                        {
                          type: 'object',
                          properties: {
                            location_code: { type: 'string' },
                            location_name: { type: 'string' },
                            vlan_number: { type: 'integer' },
                            vlan_name: { type: 'string' },
                            rack_name: { type: 'string' },
                            asset_name: { type: 'string' },
                            asset_type: { type: 'string' },
                            links: { type: 'array', items: { type: 'object' } },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
      put: {
        tags: ['Infrastructure'],
        summary: 'Update device',
        description: 'Update device properties. Requires admin or engineer role.',
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  device_type: { type: 'string', enum: ['firewall', 'switch-core', 'switch', 'router', 'server', 'storage', 'wireless', 'ups', 'patch-panel', 'pdu'] },
                  model: { type: 'string', nullable: true },
                  manufacturer: { type: 'string', nullable: true },
                  serial_number: { type: 'string', nullable: true },
                  ip_address: { type: 'string', nullable: true },
                  firmware: { type: 'string', nullable: true },
                  status: { type: 'string', enum: ['operational', 'warning', 'critical', 'maintenance', 'offline', 'decommissioned'] },
                  vlan_id: { type: 'string', format: 'uuid', nullable: true },
                  rack_id: { type: 'string', format: 'uuid', nullable: true },
                  rack_u_start: { type: 'integer', minimum: 1, maximum: 50, nullable: true },
                  rack_u_height: { type: 'integer', minimum: 1, maximum: 10 },
                },
              },
            },
          },
        },
        responses: {
          '200': dataResponse('InfraDevice', 'Device updated'),
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },
    '/infrastructure/devices/{id}/position': {
      patch: {
        tags: ['Infrastructure'],
        summary: 'Update device topology position',
        description: 'Update the X/Y coordinates of a device on the topology map (drag-and-drop). Requires admin or engineer role.',
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['topo_x', 'topo_y'],
                properties: {
                  topo_x: { type: 'number', minimum: 0, maximum: 9999, example: 450 },
                  topo_y: { type: 'number', minimum: 0, maximum: 9999, example: 200 },
                },
              },
            },
          },
        },
        responses: {
          '200': dataResponse('InfraDevice', 'Position updated'),
          '401': unauthorized,
          '403': forbidden,
          '404': notFound,
        },
      },
    },
    '/infrastructure/vlans': {
      get: {
        tags: ['Infrastructure'],
        summary: 'List VLANs for a location',
        description: 'Retrieve all VLANs at a specific location with device counts.',
        parameters: [
          { name: 'location_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Location UUID (required)' },
        ],
        responses: {
          '200': {
            description: 'VLANs with device counts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          location_id: { type: 'string', format: 'uuid' },
                          vlan_id: { type: 'integer', example: 80 },
                          name: { type: 'string', example: 'Management' },
                          subnet: { type: 'string', example: '10.80.1.0/24' },
                          description: { type: 'string', nullable: true },
                          device_count: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Missing location_id parameter', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/infrastructure/racks': {
      get: {
        tags: ['Infrastructure'],
        summary: 'List racks for a location',
        description: 'Retrieve all server racks at a specific location with mounted device details and used unit count.',
        parameters: [
          { name: 'location_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Location UUID (required)' },
        ],
        responses: {
          '200': {
            description: 'Racks with devices',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          location_id: { type: 'string', format: 'uuid' },
                          name: { type: 'string', example: 'Rack-A1' },
                          total_units: { type: 'integer', example: 42 },
                          used_units: { type: 'integer', example: 28 },
                          devices: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                device_id: { type: 'string', format: 'uuid' },
                                name: { type: 'string' },
                                device_type: { type: 'string' },
                                rack_u_start: { type: 'integer' },
                                rack_u_height: { type: 'integer' },
                                status: { type: 'string' },
                                model: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Missing location_id parameter', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },
    '/infrastructure/health-summary': {
      get: {
        tags: ['Infrastructure'],
        summary: 'Get infrastructure health summary',
        description: 'Aggregated device and location status counts across all infrastructure.',
        responses: {
          '200': {
            description: 'Health summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        devices: {
                          type: 'object',
                          properties: {
                            total: { type: 'integer', example: 87 },
                            operational: { type: 'integer', example: 78 },
                            warning: { type: 'integer', example: 4 },
                            critical: { type: 'integer', example: 1 },
                            maintenance: { type: 'integer', example: 2 },
                            offline: { type: 'integer', example: 0 },
                            decommissioned: { type: 'integer', example: 2 },
                          },
                        },
                        locations: {
                          type: 'object',
                          properties: {
                            total: { type: 'integer', example: 4 },
                            operational: { type: 'integer', example: 3 },
                            warning: { type: 'integer', example: 1 },
                            critical: { type: 'integer', example: 0 },
                            maintenance: { type: 'integer', example: 0 },
                            offline: { type: 'integer', example: 0 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },

    // ============================================
    // Dashboard
    // ============================================
    '/dashboard/kpis': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get all dashboard KPIs',
        description: 'Aggregated KPIs for the operations dashboard: asset counts, open incidents by priority, recent incidents, upcoming changes, vulnerability stats, and change success rate. Results are cached in Redis (60s TTL).',
        responses: {
          '200': {
            description: 'All KPIs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        total_assets: { type: 'integer', example: 247 },
                        by_type: { type: 'object', example: { workstation: 173, virtual_server: 42, physical_server: 12, network_device: 20 } },
                        by_status: { type: 'object', example: { active: 230, decommissioned: 17 } },
                        by_criticality: { type: 'object', example: { critical: 8, high: 32, medium: 89, low: 45, unclassified: 73 } },
                        open_incidents: { type: 'object', example: { p1: 1, p2: 3, p3: 12, p4: 5 } },
                        recent_incidents: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, priority: { type: 'string' }, status: { type: 'string' }, opened_at: { type: 'string' } } } },
                        upcoming_changes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, risk_level: { type: 'string' }, status: { type: 'string' }, scheduled_start: { type: 'string' } } } },
                        change_success_rate: { type: 'integer', nullable: true, example: 94 },
                        vulns_total: { type: 'integer', example: 892 },
                        vulns_critical: { type: 'integer', example: 47 },
                        vulns_high: { type: 'integer', example: 189 },
                        affected_host_rate: { type: 'string', example: '70%' },
                        eol_count: { type: 'integer', example: 58 },
                        top5_vulns: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, severity: { type: 'string' }, affected_hosts: { type: 'integer' } } } },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': unauthorized,
          '403': forbidden,
        },
      },
    },

    // ============================================
    // Health
    // ============================================
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'System health check',
        description: 'Check the health of the API and its dependencies (PostgreSQL, Redis). Returns 200 if all checks pass, 503 if any check fails.',
        security: [],
        responses: {
          '200': {
            description: 'All systems healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded'], example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string', example: '0.1.0' },
                    checks: {
                      type: 'object',
                      properties: {
                        postgres: {
                          type: 'object',
                          properties: {
                            status: { type: 'string', example: 'healthy' },
                            latency: { type: 'integer', description: 'Latency in ms', example: 3 },
                          },
                        },
                        redis: {
                          type: 'object',
                          properties: {
                            status: { type: 'string', example: 'healthy' },
                            latency: { type: 'integer', description: 'Latency in ms', example: 1 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '503': {
            description: 'One or more systems unhealthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'degraded' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string' },
                    checks: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from POST /auth/login',
      },
    },
    schemas: {
      User: UserSchema,
      Asset: AssetSchema,
      Incident: IncidentSchema,
      Change: ChangeSchema,
      Vulnerability: VulnerabilitySchema,
      Connector: ConnectorSchema,
      InfraLocation: InfraLocationSchema,
      InfraDevice: InfraDeviceSchema,
      Error: ErrorSchema,
    },
  },
}
