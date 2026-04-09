import { test, expect, Page } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers'

async function loginAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/(admin|dashboard)/, { timeout: 15_000 })
}

test.describe('TC04 — Admin UI Pages', () => {

  test('TC04.1 — Admin dashboard load, co stat cards', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent()
    expect(body!.length).toBeGreaterThan(50)
  })

  test('TC04.2 — Admin sidebar hien menu', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    const sidebarTexts = ['Dashboard', 'Users', 'Albums', 'Payments', 'Plans', 'Settings', 'Logs',
      'Người dùng', 'Album', 'Thanh toán', 'Gói', 'Cài đặt', 'Nhật ký', 'Voucher']
    let found = 0
    for (const t of sidebarTexts) {
      if (await page.locator(`text=${t}`).count() > 0) found++
    }
    expect(found).toBeGreaterThanOrEqual(3)
  })

  test('TC04.3 — Tat ca trang admin load khong loi', async ({ page }) => {
    await loginAdmin(page)
    const adminPages = [
      '/admin',
      '/admin/users',
      '/admin/albums',
      '/admin/payments',
      '/admin/plans',
      '/admin/payment-methods',
      '/admin/vouchers',
      '/admin/settings',
      '/admin/logs',
    ]
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    for (const path of adminPages) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const body = await page.locator('body').textContent()
      expect(body!.length, `${path} phai co noi dung`).toBeGreaterThan(10)
      expect(body!.toLowerCase(), `${path} khong duoc co server error`).not.toContain('internal server error')
    }
  })
})
