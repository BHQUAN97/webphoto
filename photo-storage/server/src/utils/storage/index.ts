import { getSetting } from '../settings-cache.js'
import { logger } from '../logger.js'
import type { StorageProvider } from './types.js'
import { R2StorageProvider } from './r2-provider.js'
import { LocalStorageProvider } from './local-provider.js'

/** Current default backend (used for new uploads). */
let _currentBackend: 'r2' | 'local' = 'r2'

/** Provider instances — both may be alive simultaneously so that
 *  images uploaded to one backend can still be served after switching. */
let _r2: StorageProvider | null = null
let _local: StorageProvider | null = null

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
      _local = local
      _currentBackend = 'local'
      logger.info(`Storage: local filesystem (${dir})`)
    } catch (err) {
      logger.error('Failed to init local storage, falling back to R2', {
        dir,
        error: (err as Error).message,
      })
      _currentBackend = 'r2'
    }
  } else {
    _currentBackend = 'r2'
    logger.info('Storage: Cloudflare R2')
  }

  // Always try to init R2 if env vars are present (needed for serving old R2 images)
  if (!_r2) {
    const hasR2Env = process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY && process.env.R2_SECRET_KEY
    if (hasR2Env) {
      try {
        _r2 = new R2StorageProvider()
      } catch (err) {
        logger.warn('R2 provider not available', { error: (err as Error).message })
      }
    }
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

/** Return the current default storage provider (for new uploads). */
export function storage(): StorageProvider {
  return storageFor(_currentBackend)
}

/** Return the provider for a specific backend.
 *  Use this when serving / deleting images that store their own storageBackend. */
export function storageFor(backend: string): StorageProvider {
  if (backend === 'local') {
    if (_local) return _local
    // Local not initialized — fall through to R2
    logger.warn('Local storage requested but not initialized, falling back to R2')
  }
  if (!_r2) {
    _r2 = new R2StorageProvider()
  }
  return _r2
}

/** Return the current default backend name. */
export async function getStorageBackend(): Promise<string> {
  return _currentBackend
}

/** Return the current default backend name (sync). */
export function getStorageBackendSync(): 'r2' | 'local' {
  return _currentBackend
}

/** Return the local public directory if a local provider is initialized, else null. */
export function getLocalPublicDir(): string | null {
  return _local?.getPublicDir?.() ?? null
}
