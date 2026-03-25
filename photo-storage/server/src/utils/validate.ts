// ─── INPUT VALIDATION & SANITIZATION ──────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/

// Allowed file extensions (lowercase, with dot)
const SAFE_EXTENSIONS = new Set([
  '.cr2', '.arw', '.nef', '.dng',
  '.jpg', '.jpeg', '.png', '.tiff', '.tif',
  '.webp',
])

export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && EMAIL_RE.test(email) && email.length <= 255
}

export function isValidPassword(password: string): { ok: boolean; reason?: string } {
  if (typeof password !== 'string') return { ok: false, reason: 'Mật khẩu không hợp lệ' }
  if (password.length < 8) return { ok: false, reason: 'Mật khẩu tối thiểu 8 ký tự' }
  if (password.length > 128) return { ok: false, reason: 'Mật khẩu tối đa 128 ký tự' }
  if (!/[a-z]/.test(password)) return { ok: false, reason: 'Mật khẩu cần có chữ thường' }
  if (!/[A-Z]/.test(password)) return { ok: false, reason: 'Mật khẩu cần có chữ hoa' }
  if (!/[0-9]/.test(password)) return { ok: false, reason: 'Mật khẩu cần có số' }
  return { ok: true }
}

export function isValidUlid(id: string): boolean {
  return typeof id === 'string' && ULID_RE.test(id)
}

export function isValidDisplayName(name: string): boolean {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 100
}

/**
 * Sanitize filename: strip path traversal, control chars, limit length
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') return 'unnamed'
  // Remove path separators and parent directory references
  let safe = filename
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '') // control chars
    .trim()
  // Limit length
  if (safe.length > 200) safe = safe.slice(-200)
  if (!safe) return 'unnamed'
  return safe
}

/**
 * Validate file extension against whitelist
 */
export function isAllowedExtension(filename: string): boolean {
  const ext = filename.lastIndexOf('.') >= 0
    ? filename.slice(filename.lastIndexOf('.')).toLowerCase()
    : ''
  return SAFE_EXTENSIONS.has(ext)
}

/**
 * Sanitize search query: escape SQL LIKE wildcards, strip dangerous chars
 */
export function sanitizeSearch(query: string): string {
  if (typeof query !== 'string') return ''
  return query
    .replace(/[%_\\]/g, '\\$&') // escape LIKE wildcards
    .replace(/[\x00-\x1f\x7f]/g, '') // control chars
    .trim()
    .slice(0, 200) // limit length
}

/**
 * Validate and constrain numeric values
 */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = parseInt(String(value))
  if (isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

/**
 * Sanitize text content (comments, bio, notes): strip HTML tags and control chars
 */
export function sanitizeText(text: string, maxLength = 5000): string {
  if (typeof text !== 'string') return ''
  return text
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // control chars (keep \n \r \t)
    .trim()
    .slice(0, maxLength)
}

/**
 * Validate status enum
 */
const VALID_IMAGE_STATUSES = new Set(['all', 'uploading', 'processing', 'ready', 'failed'])
export function isValidImageStatus(status: string): boolean {
  return VALID_IMAGE_STATUSES.has(status)
}

const VALID_SORT_ORDERS = new Set(['newest', 'oldest', 'most_liked', 'largest'])
export function isValidSortBy(sortBy: string): boolean {
  return VALID_SORT_ORDERS.has(sortBy)
}

/**
 * Validate date string (ISO format)
 */
export function isValidDateString(date: string): boolean {
  if (typeof date !== 'string') return false
  const d = new Date(date)
  return !isNaN(d.getTime())
}

/**
 * Validate positive integer for file size
 */
export function isValidFileSize(size: unknown): boolean {
  const n = Number(size)
  return Number.isInteger(n) && n > 0 && n <= 500 * 1024 * 1024 // max 500MB absolute limit
}
