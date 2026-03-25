import type { Request, CookieOptions } from 'express'

/** Domains that are always accessed via HTTPS (e.g. behind Cloudflare Tunnel) */
const SECURE_HOSTS = ['bhquan.site']

/**
 * Auto-detect secure cookie.
 * - If Host matches a known HTTPS-only domain (tunnel), secure = true
 * - Otherwise (localhost dev), secure = false
 */
export function isSecureRequest(req: Request): boolean {
  if (req.protocol === 'https') return true
  const host = (req.hostname || '').split(':')[0]
  return SECURE_HOSTS.some(h => host === h || host.endsWith('.' + h))
}

export function accessTokenCookie(req: Request): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
  }
}

export function refreshTokenCookie(req: Request): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    maxAge: 7 * 86400 * 1000,
    path: '/',
  }
}
