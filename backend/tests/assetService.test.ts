import { describe, it, expect, vi, beforeEach } from 'vitest'
import { query, getClient } from '../src/db/pool'
import {
  listAssets,
  getAssetById,
  createAsset,
  deleteAsset,
  bulkImportAssets,
} from '../src/services/assetService'

// Cast mocked functions for type safety
const mockQuery = vi.mocked(query)
const mockGetClient = vi.mocked(getClient)

beforeEach(() => {
  vi.clearAllMocks()
})

const SAMPLE_ASSET = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  external_id: 'KACE-001',
  source: 'quest-kace',
  name: 'lidozrhw001',
  type: 'workstation',
  status: 'active',
  lifecycle_stage: 'active',
  criticality: 'medium',
  ip_address: '10.0.1.50',
  os: 'Windows 11 Enterprise',
  location: {},
  hardware_info: {},
  tags: [],
  custom_fields: {},
  created_by: 'user-123',
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
}

describe('assetService', () => {
  describe('listAssets', () => {
    it('should return paginated result structure', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '42' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [SAMPLE_ASSET], rowCount: 1 } as never)

      const result = await listAssets({
        page: 1,
        limit: 25,
        sort: 'created_at',
        order: 'desc',
      })

      expect(result.total).toBe(42)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(25)
      expect(result.totalPages).toBe(2)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('lidozrhw001')
    })

    it('should apply status filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)

      await listAssets({
        page: 1,
        limit: 25,
        sort: 'created_at',
        order: 'desc',
        status: 'active',
      })

      // First call = count query with WHERE status = $1
      const countCall = mockQuery.mock.calls[0]
      expect(countCall[0]).toContain('WHERE')
      expect(countCall[0]).toContain('status = $1')
      expect(countCall[1]).toContain('active')
    })

    it('should apply search filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)

      await listAssets({
        page: 1,
        limit: 25,
        sort: 'created_at',
        order: 'desc',
        search: 'lidozrh',
      })

      const countCall = mockQuery.mock.calls[0]
      expect(countCall[0]).toContain('ILIKE')
      expect(countCall[1]).toContain('%lidozrh%')
    })

    it('should fallback to created_at for unknown sort column', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)

      await listAssets({
        page: 1,
        limit: 25,
        sort: 'malicious_column; DROP TABLE assets;--',
        order: 'desc',
      })

      const dataCall = mockQuery.mock.calls[1]
      expect(dataCall[0]).toContain('ORDER BY created_at DESC')
    })
  })

  describe('getAssetById', () => {
    it('should return an asset when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ASSET], rowCount: 1 } as never)

      const result = await getAssetById(SAMPLE_ASSET.id)
      expect(result).not.toBeNull()
      expect(result!.id).toBe(SAMPLE_ASSET.id)
      expect(result!.name).toBe('lidozrhw001')
    })

    it('should return null when asset not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)

      const result = await getAssetById('nonexistent-id')
      expect(result).toBeNull()
    })
  })

  describe('createAsset', () => {
    it('should call INSERT with correct parameters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ASSET], rowCount: 1 } as never)

      const data = {
        external_id: 'KACE-001',
        source: 'quest-kace',
        name: 'lidozrhw001',
        type: 'workstation',
        status: 'active',
        lifecycle_stage: 'active',
        criticality: 'medium',
        ip_address: '10.0.1.50',
        os: 'Windows 11 Enterprise',
        location: {},
        hardware_info: {},
        tags: [] as unknown[],
        custom_fields: {},
        created_by: 'user-123',
      }

      const result = await createAsset(data, 'user-123')

      expect(mockQuery).toHaveBeenCalledOnce()
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('INSERT INTO assets')
      expect(sql).toContain('RETURNING *')
      expect(params).toContain('lidozrhw001')
      expect(params).toContain('workstation')
      expect(result.id).toBe(SAMPLE_ASSET.id)
    })
  })

  describe('deleteAsset', () => {
    it('should return true when asset is deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never)

      const result = await deleteAsset(SAMPLE_ASSET.id)
      expect(result).toBe(true)

      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('DELETE FROM assets')
      expect(params).toContain(SAMPLE_ASSET.id)
    })

    it('should return false when asset does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)

      const result = await deleteAsset('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('bulkImportAssets', () => {
    it('should import multiple assets in a transaction', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rows: [{ ...SAMPLE_ASSET, name: 'asset-1' }] }) // INSERT 1
          .mockResolvedValueOnce({ rows: [{ ...SAMPLE_ASSET, name: 'asset-2' }] }) // INSERT 2
          .mockResolvedValueOnce({}), // COMMIT
        release: vi.fn(),
      }
      mockGetClient.mockResolvedValueOnce(mockClient as never)

      const assets = [
        { ...SAMPLE_ASSET, name: 'asset-1' },
        { ...SAMPLE_ASSET, name: 'asset-2' },
      ]

      const result = await bulkImportAssets(assets, 'user-123')

      expect(result.imported).toBe(2)
      expect(result.errors).toHaveLength(0)
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('should handle per-row errors gracefully', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rows: [SAMPLE_ASSET] }) // INSERT 1 succeeds
          .mockRejectedValueOnce(new Error('duplicate key violation')) // INSERT 2 fails
          .mockResolvedValueOnce({}), // COMMIT (partial success)
        release: vi.fn(),
      }
      mockGetClient.mockResolvedValueOnce(mockClient as never)

      const assets = [
        { ...SAMPLE_ASSET, name: 'asset-ok' },
        { ...SAMPLE_ASSET, name: 'asset-duplicate' },
      ]

      const result = await bulkImportAssets(assets, 'user-123')

      expect(result.imported).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].row).toBe(2)
      expect(result.errors[0].error).toContain('duplicate key')
    })
  })
})
