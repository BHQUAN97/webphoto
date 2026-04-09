import { test, expect } from '@playwright/test'
import { API_BASE } from './helpers'

test.describe('TC06 — Bao mat (Security)', () => {

  test('TC06.1 — Admin APIs block khi khong co token', async ({ request }) => {
    const endpoints = [
      '/api/admin/dashboard/stats',
      '/api/admin/users',
      '/api/admin/albums',
      '/api/admin/payments',
      '/api/admin/plans',
      '/api/admin/settings',
      '/api/admin/logs',
      '/api/admin/vouchers',
      '/api/admin/payment-methods',
    ]
    for (const ep of endpoints) {
      const res = await request.get(`${API_BASE}${ep}`)
      expect(res.status(), `${ep} phai tra 401/403`).toBeGreaterThanOrEqual(401)
    }
  })

  test('TC06.2 — Protected user APIs block khi khong co token', async ({ request }) => {
    const endpoints = ['/api/users/me', '/api/users/me/storage']
    for (const ep of endpoints) {
      const res = await request.get(`${API_BASE}${ep}`)
      expect(res.status(), `${ep} phai tra 401`).toBeGreaterThanOrEqual(401)
    }
  })

  test('TC06.3 — /admin redirect ve login khi chua login', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    const url = page.url()
    const body = await page.locator('body').textContent()
    const blocked = url.includes('/login') || body!.includes('Đăng nhập') || body!.includes('Login')
    expect(blocked).toBeTruthy()
  })

  test('TC06.4 — /dashboard redirect ve login khi chua login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/login')
  })

  test('TC06.5 — Security headers', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/health`)
    const h = res.headers()
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['x-frame-options']).toBeDefined()
  })

  test('TC06.6 — XSS trong login input', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', '<script>alert(1)</script>@test.com')
    await page.fill('input[type="password"]', 'test123')
    let alertFired = false
    page.on('dialog', () => { alertFired = true })
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    expect(alertFired).toBeFalsy()
  })

  test('TC06.7 — SQL injection trong login', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: "admin' OR '1'='1", password: "' OR '1'='1" }
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('TC06.8 — Upload khong cho phep khi chua login', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/images/upload-url`, {
      data: { fileName: 'test.jpg', contentType: 'image/jpeg', albumId: 'test' }
    })
    expect(res.status()).toBeGreaterThanOrEqual(401)
  })

  test('TC06.9 — Cron endpoint can secret', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/cron/expire-images`)
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('TC06.10 — Register voi email da ton tai', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/register`, {
      data: { email: 'admin@photostorage.com', password: 'test123456', displayName: 'Test' }
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})
