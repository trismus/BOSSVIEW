/**
 * Qualys Vulnerability Import Seed Script
 *
 * Extracts vulnerability data (V array) and top-10 user data (U10 array)
 * from the Qualys HTML dashboard and inserts into the vulnerabilities table.
 *
 * Usage: npx tsx src/seeds/qualys-import.ts
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Pool } from 'pg'

// ============================================
// Types
// ============================================

interface QualysVuln {
  title: string
  severity: string
  hosts: number
}

interface QualysUser {
  user: string
  total: number
  critical: number
  high: number
  hosts: string[]
}

// ============================================
// Category classification
// ============================================

function categorize(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('eol/obsolete')) return 'EOL/Obsolete Software'
  if (t.includes('remote code execution') || t.includes('rce')) return 'Remote Code Execution'
  if (t.includes('elevation of privilege')) return 'Privilege Escalation'
  if (t.includes('denial of service') || t.includes('dos')) return 'Denial of Service'
  if (t.includes('buffer overflow') || t.includes('heap')) return 'Memory Corruption'
  if (t.includes('information disclosure')) return 'Information Disclosure'
  if (t.includes('security feature bypass')) return 'Security Feature Bypass'
  if (t.includes('not installed')) return 'Missing Patch'
  return 'Other'
}

// ============================================
// HTML parsing helpers
// ============================================

function extractJsArray<T>(html: string, varName: string): T[] {
  // Match pattern: const V=[...]; or const U10=[...];
  const regex = new RegExp(`const ${varName}=\\[(.+?)\\];`, 's')
  const match = html.match(regex)
  if (!match) {
    throw new Error(`Could not find ${varName} array in HTML`)
  }
  try {
    return JSON.parse(`[${match[1]}]`) as T[]
  } catch (err) {
    throw new Error(`Failed to parse ${varName} JSON: ${err instanceof Error ? err.message : 'unknown error'}`)
  }
}

// ============================================
// Main import logic
// ============================================

async function main() {
  const htmlPath = resolve(__dirname, '../../../docs/data/Qualys_WS_Vulnerability_Dashboard_LSYFN.html')

  console.warn('Reading Qualys HTML dashboard...')
  const html = readFileSync(htmlPath, 'utf-8')

  // Extract data arrays
  const vulns = extractJsArray<QualysVuln>(html, 'V')
  console.warn(`Extracted ${vulns.length} vulnerabilities from V array`)

  let users: QualysUser[] = []
  try {
    users = extractJsArray<QualysUser>(html, 'U10')
    console.warn(`Extracted ${users.length} top users from U10 array`)
  } catch (err) {
    console.warn('Could not extract U10 array (non-critical):', err instanceof Error ? err.message : err)
  }

  // Connect to database
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  })

  try {
    // Verify connection
    await pool.query('SELECT 1')
    console.warn('Database connected')

    // Import vulnerabilities (idempotent — skip existing by title)
    let inserted = 0
    let skipped = 0

    for (const vuln of vulns) {
      const existing = await pool.query(
        'SELECT id FROM vulnerabilities WHERE title = $1',
        [vuln.title]
      )

      if (existing.rows.length > 0) {
        skipped++
        continue
      }

      await pool.query(
        `INSERT INTO vulnerabilities (source, title, severity, category, affected_hosts, status, first_seen, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          'qualys',
          vuln.title,
          vuln.severity,
          categorize(vuln.title),
          vuln.hosts,
          'open',
        ]
      )
      inserted++
    }

    console.warn(`Vulnerabilities: ${inserted} inserted, ${skipped} skipped (already exist)`)

    // Link U10 user hosts to asset_vulnerabilities (best-effort hostname matching)
    if (users.length > 0) {
      let linked = 0
      let notFound = 0

      for (const user of users) {
        for (const hostname of user.hosts) {
          // Find asset by name (hostname) — case-insensitive
          const assetResult = await pool.query<{ id: string }>(
            `SELECT id FROM assets WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [hostname]
          )

          if (assetResult.rows.length === 0) {
            notFound++
            continue
          }

          const assetId = assetResult.rows[0].id

          // Get all vulns for this user's severity counts to create representative links
          // Link to top critical/high vulns for this host
          const vulnRows = await pool.query<{ id: string }>(
            `SELECT id FROM vulnerabilities
             WHERE source = 'qualys' AND status = 'open'
             ORDER BY
               CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
               affected_hosts DESC
             LIMIT $1`,
            [user.total]
          )

          for (const vulnRow of vulnRows.rows) {
            await pool.query(
              `INSERT INTO asset_vulnerabilities (asset_id, vulnerability_id, status)
               VALUES ($1, $2, 'open')
               ON CONFLICT (asset_id, vulnerability_id) DO NOTHING`,
              [assetId, vulnRow.id]
            )
            linked++
          }
        }
      }

      console.warn(`Asset-vulnerability links: ${linked} created, ${notFound} hosts not found in assets`)
    }

    console.warn('Qualys import completed successfully')
  } catch (err) {
    console.error('Import failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
