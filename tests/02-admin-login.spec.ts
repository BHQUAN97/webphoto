import { test, expect } from '@playwright/test'
import { API_BASE, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers'

test.describe('TC02 — Dang nhap Admin', () => {

  test('TC02.1 — Login API tra ve accessToken va user info', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.user).toBeDefined()
    expect(body.user.role).toBe('admin')
    expect(body.user.email).toBe(ADMIN_EMAIL)
    expect(body.accessToken).toBeDefined()
  })

  test('TC02.2 — Login UI redirect ve dashboard/admin', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/(admin|dashboard)/, { timeout: 15_000 })
  })

  test('TC02.3 — Login voi email sai', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: 'notexist@test.com', password: ADMIN_PASSWORD }
    })
    expect(res.status()).toBe(401)
  })

  test('TC02.4 — Login voi password sai', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: 'wrongpass' }
    })
    expect(res.status()).toBe(401)
  })

  test('TC02.5 — Login thieu field', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: ADMIN_EMAIL }
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('TC02.6 — Logout endpoint', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    })
    const { accessToken } = await loginRes.json()
    const res = await request.post(`${API_BASE}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    expect(res.status()).toBeLessThan(300)
  })
})
