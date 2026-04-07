/**
 * BOSSVIEW Connector Registry — Manages available connector adapters.
 */

import type { ConnectorAdapter } from './types'
import { CsvImportAdapter } from './adapters/csv-import'
import { JiraAdapter } from './adapters/jira'
import { QuestKaceAdapter } from './adapters/quest-kace'

const adapters = new Map<string, ConnectorAdapter>()

function registerAdapter(adapter: ConnectorAdapter): void {
  if (adapters.has(adapter.id)) {
    console.warn(`Connector adapter '${adapter.id}' is already registered, skipping`)
    return
  }
  adapters.set(adapter.id, adapter)
  console.warn(`Registered connector adapter: ${adapter.id} (${adapter.name} v${adapter.version})`)
}

export function getAdapter(adapterId: string): ConnectorAdapter | undefined {
  return adapters.get(adapterId)
}

export function getAllAdapters(): ConnectorAdapter[] {
  return Array.from(adapters.values())
}

export function getAdapterIds(): string[] {
  return Array.from(adapters.keys())
}

// Register all built-in adapters
export function initializeRegistry(): void {
  registerAdapter(new CsvImportAdapter())
  registerAdapter(new JiraAdapter())
  registerAdapter(new QuestKaceAdapter())
  console.warn(`Connector registry initialized with ${adapters.size} adapter(s)`)
}
