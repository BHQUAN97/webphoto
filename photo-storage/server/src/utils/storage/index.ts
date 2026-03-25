import { getSetting } from '../settings-cache.js'
import type { StorageProvider } from './types.js'
import { R2StorageProvider } from './r2-provider.js'
import { LocalStorageProvider } from './local-provider.js'

let _provider: StorageProvider | null = null
let _backend: string | null = null

export type { StorageProvider, StorageInfo } from './types.js'

export async function initStorage(): Promise<void> {
  await refreshStorage()
}

export async function refreshStorage(): Promise<void> {
  const backend = await getSetting('storage_backend', 'r2')
  if (backend === 'local') {
    const dir = await getSetting('local_storage_dir', './data/storage')
    const local = new LocalStorageProvider(dir)
    await local.init()
    _provider = local
  } else {
    _provider = new R2StorageProvider()
  }
  _backend = backend
}

export function storage(): StorageProvider {
  if (!_provider) {
    // Fallback: create R2 provider synchronously on first call
    _provider = new R2StorageProvider()
    _backend = 'r2'
  }
  return _provider
}

export async function getStorageBackend(): Promise<string> {
  if (!_backend) {
    _backend = await getSetting('storage_backend', 'r2')
  }
  return _backend
}
