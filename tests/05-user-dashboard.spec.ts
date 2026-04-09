import { test, expect, Page } from '@playwright/test'
import { API_BASE, ADMIN_EMAIL, ADMIN_PASSWORD, getAdminToken } from './helpers'

async function loginAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/(admin|dashboard)/, { timeout: 15_000 })
}

test.describe('TC05 — User Dashboard (admin account)', () => {

  test('TC05.1 — Tat ca trang user dashboard load', async ({ page }) => {
    await loginAdmin(page)
    const pages = [
      '/dashboard',
      '/dashboard/albums',
      '/dashboard/favorites',
      '/dashboard/profile',
      '/dashboard/settings',
      '/dashboard/referral',
    ]
    for (const path of pages) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const body = await page.locator('body').textContent()
      expect(body!.length, `${path}`).toBeGreaterThan(10)
    }
  })

  test('TC05.2 — Profile hien email admin', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/dashboard/profile')
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent()
    const hasAdmin = body!.includes('admin') || body!.includes('Admin') || body!.includes(ADMIN_EMAIL)
    expect(hasAdmin).toBeTruthy()
  })

  test('TC05.3 — API /users/me', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC05.4 — API /users/me/storage', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/users/me/storage`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC05.5 — Upgrade page hien plans', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/upgrade')
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent()
    expect(body!.length).toBeGreaterThan(50)
  })
})
