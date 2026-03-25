import { getSetting } from '../settings-cache.js'
import { logger } from '../logger.js'
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
    try {
      const local = new LocalStorageProvider(dir)
      await local.init()
      _provider = local
      _backend = 'local'
      logger.info(`Storage: local filesystem (${dir})`)
    } catch (err) {
      logger.error('Failed to init local storage, falling back to R2', {
        dir,
        error: (err as Error).message,
      })
      _provider = new R2StorageProvider()
      _backend = 'r2'
    }
  } else {
    _provider = new R2StorageProvider()
    _backend = 'r2'
    logger.info('Storage: Cloudflare R2')
  }
}

/** Validate that a storage backend can be activated. Returns error message or null. */
export async function validateBackend(backend: string, localDir?: string): Promise<string | null> {
  if (backend === 'r2') {
    // Check required env vars
    const missing = ['R2_ENDPOINT', 'R2_ACCESS_KEY', 'R2_SECRET_KEY', 'R2_PRIVATE_BUCKET', 'R2_PUBLIC_BUCKET', 'CDN_URL']
      .filter(k => !process.env[k])
    if (missing.length > 0) {
      return `Thiếu biến môi trường R2: ${missing.join(', ')}`
    }
    // Test R2 connectivity
    try {
      const r2 = new R2StorageProvider()
      await r2.getStorageInfo()
      return null
    } catch (err) {
      return `Không kết nối được R2: ${(err as Error).message}`
    }
  }

  if (backend === 'local') {
    const dir = localDir || './data/storage'
    try {
      const { default: fs } = await import('fs/promises')
      const { default: path } = await import('path')
      const resolved = path.resolve(dir)
      await fs.mkdir(resolved, { recursive: true })
      // Test write
      const testFile = path.join(resolved, '.write-test')
      await fs.writeFile(testFile, 'ok')
      await fs.rm(testFile)
      return null
    } catch (err) {
      return `Không thể ghi vào thư mục "${dir}": ${(err as Error).message}`
    }
  }

  return `Backend "${backend}" không được hỗ trợ. Chỉ hỗ trợ: r2, local`
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
