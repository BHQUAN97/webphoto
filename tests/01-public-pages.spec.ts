import { test, expect } from '@playwright/test'
import { API_BASE } from './helpers'

test.describe('TC01 — Trang cong khai (Public Pages)', () => {

  test('TC01.1 — Trang chu load thanh cong', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('TC01.2 — Trang login hien form', async ({ page }) => {
    await page.goto('/login')
    // 10s timeout: Vite lazy chunk + auth.refresh() await trong router guard
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10_000 })
  })

  test('TC01.3 — Trang register hien form', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
    // Password co the la type="password" hoac input co placeholder password
    const pwField = page.locator('input[type="password"]').or(page.locator('input[placeholder*="••"]'))
    await expect(pwField.first()).toBeVisible({ timeout: 10_000 })
  })

  test('TC01.4 — Trang 404 hien thi dung', async ({ page }) => {
    await page.goto('/khong-ton-tai-xyz')
    // 10s timeout: Vue app cold-mount cham, lazy chunk
    await expect(page.locator('body')).toContainText(/404|Không tìm thấy|tồn tại|Not Found/i, { timeout: 10_000 })
  })

  test('TC01.5 — Login sai password hien thong bao loi', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'wrong@email.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    // Doi thong bao loi
    await page.waitForTimeout(3000)
    const body = await page.locator('body').textContent()
    const hasError = body!.includes('không đúng') || body!.includes('Invalid') || body!.includes('Lỗi') || body!.includes('Error')
    expect(hasError).toBeTruthy()
  })

  test('TC01.6 — Health check API', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('TC01.7 — API plans public', async ({ request }) => {
    // Plans lan dau co the slow do Redis cache miss + quota fetch N plans
    const res = await request.get(`${API_BASE}/api/plans`, { timeout: 30_000 })
    expect(res.ok()).toBeTruthy()
  })
})
