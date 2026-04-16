import { createHash } from 'crypto'

// Refresh token luu dang SHA-256 hex cua raw token (ULID high-entropy 128 bit).
// Tranh bcrypt O(N) scan truoc day — gio lookup unique index O(1).
export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}
