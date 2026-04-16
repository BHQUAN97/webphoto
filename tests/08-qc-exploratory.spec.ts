import { test, expect } from '@playwright/test'
import { API_BASE, ADMIN_EMAIL, ADMIN_PASSWORD, getAdminToken } from './helpers'

/**
 * TC08 — QC Exploratory Testing
 * Flow moi chua co trong 01-07:
 *  - Register validation (email/password/displayName edge cases)
 *  - Voucher activate flows
 *  - Referrals /me
 *  - Payments create/confirm/cancel
 *  - Share token flows (public view, permission)
 *  - Album CRUD edge (empty title, Unicode, invalid ULID)
 *  - Images list filter validation (bad ULID, bad status, bad date)
 *  - Auth /refresh
 *  - Rate limit + permission (user vs admin)
 */

test.describe('TC08 — QC Exploratory: Auth edge cases', () => {

  test('TC08.1 — Register thieu displayName → 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/register`, {
      data: { email: `qc_${Date.now()}@test.com`, password: 'Passw0rd!' },
    })
    expect(res.status()).toBe(400)
  })

  test('TC08.2 — Register email format sai → 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/register`, {
      data: { email: 'not-an-email', password: 'Passw0rd!', displayName: 'QC' },
    })
    expect(res.status()).toBe(400)
  })

  test('TC08.3 — Register password yeu → 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/register`, {
      data: { email: `qc_${Date.now()}@test.com`, password: '123', displayName: 'QC' },
    })
    expect(res.status()).toBe(400)
  })

  test('TC08.4 — Register displayName vuot 100 ky tu → 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: `qc_${Date.now()}@test.com`,
        password: 'Passw0rd!',
        displayName: 'x'.repeat(200),
      },
    })
    expect(res.status()).toBe(400)
  })

  test('TC08.5 — Login voi email chua Unicode khong crash', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: 'nguoidung@tèst.com', password: 'abc123' },
    })
    // Khong 500
    expect(res.status()).toBeLessThan(500)
  })

  test('TC08.6 — Refresh khong co cookie → 401', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/refresh`, {
      data: {},
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })
})

test.describe('TC08 — QC Exploratory: Album edge cases', () => {

  test('TC08.7 — Create album khong co title → 400', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/albums`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { isPublic: false },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('TC08.8 — Create album voi Unicode tieng Viet', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/albums`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Album ảnh cưới 💍 Đà Lạt', description: 'Mô tả tiếng Việt', isPublic: false },
    })
    expect(res.status()).toBeLessThan(300)
    const body = await res.json()
    const id = body.album?.id ?? body.id ?? body.data?.id
    expect(id).toBeDefined()
    // Cleanup
    if (id) {
      await request.delete(`${API_BASE}/api/albums/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  })

  test('TC08.9 — GET album voi invalid ULID → 400/404', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/albums/not-a-valid-ulid`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('TC08.10 — DELETE album khong ton tai → 404', async ({ request }) => {
    const token = await getAdminToken(request)
    // ULID hop le nhung khong ton tai
    const res = await request.delete(`${API_BASE}/api/albums/01AAAAAAAAAAAAAAAAAAAAAAAA`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect([400, 403, 404]).toContain(res.status())
  })
})

test.describe('TC08 — QC Exploratory: Images list validation', () => {

  test('TC08.11 — Images list voi albumId sai format → 400', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/images?albumId=not-ulid`)
    expect(res.status()).toBe(400)
  })

  test('TC08.12 — Images list voi status sai → 400', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/images?status=bogus_status`)
    expect(res.status()).toBe(400)
  })

  test('TC08.13 — Images list voi dateFrom sai → 400', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/images?dateFrom=not-a-date`)
    expect(res.status()).toBe(400)
  })

  test('TC08.14 — Images list voi cursor sai ULID → 400', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/images?cursor=abc`)
    expect(res.status()).toBe(400)
  })

  test('TC08.15 — Images search voi SQL wildcards duoc escape', async ({ request }) => {
    // Khong duoc crash hay bi inject
    const res = await request.get(`${API_BASE}/api/images?search=%25%5F%27`)
    expect(res.status()).toBeLessThan(500)
  })
})

test.describe('TC08 — QC Exploratory: Voucher + Referral + Payment', () => {

  test('TC08.16 — Voucher activate khong token → 401', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/vouchers/activate`, {
      data: { code: 'TEST' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(401)
    expect(res.status()).toBeLessThan(500)
  })

  test('TC08.17 — Voucher activate code rong → 400/422', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/vouchers/activate`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { code: '' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('TC08.18 — Voucher code khong ton tai → loi business', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/vouchers/activate`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { code: 'NONEXIST_VOUCHER_QC_XYZ' },
    })
    // 400 hoac 200 { ok: false } tuy asyncHandler
    expect(res.status()).toBeLessThan(500)
  })

  test('TC08.19 — Referrals /me tra ve referralCode + stats', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/referrals/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.referralCode).toBeDefined()
    expect(body.stats).toBeDefined()
  })

  test('TC08.20 — Payment create voi planCode khong ton tai → 400', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/payments/create`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { planCode: 'nonexistent_plan_qc' },
    })
    expect(res.status()).toBe(400)
  })

  test('TC08.21 — Payment cancel khong ton tai → 404', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/payments/01AAAAAAAAAAAAAAAAAAAAAAAA/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect([400, 404]).toContain(res.status())
  })
})

test.describe('TC08 — QC Exploratory: Share token flow', () => {

  test('TC08.22 — Share token khong ton tai → 404', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/share/notexisttoken123`)
    expect(res.status()).toBe(404)
  })

  test('TC08.23 — Share comment khong co guestName → 400/403', async ({ request }) => {
    // Token khong ton tai van phai tra 404 truoc
    const res = await request.post(
      `${API_BASE}/api/share/sometoken/images/01AAAAAAAAAAAAAAAAAAAAAAAA/comments`,
      { data: { content: 'hi' } },
    )
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  test('TC08.24 — Share route FE /share/:token load khong crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/share/invalidtoken')
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent()
    expect(body!.length).toBeGreaterThan(10)
    // Khong co loi runtime nghiem trong
    expect(errors.join('\n')).not.toContain('TypeError')
  })
})

test.describe('TC08 — QC Exploratory: Permission & misc', () => {

  test('TC08.25 — User thuong khong truy cap admin endpoint → 403', async ({ request }) => {
    // Tao user moi, dung token user de goi admin API
    const email = `qc_perm_${Date.now()}@test.com`
    const regRes = await request.post(`${API_BASE}/api/auth/register`, {
      data: { email, password: 'Passw0rd!', displayName: 'QC Perm' },
    })
    // Neu registration bi disable thi skip
    if (regRes.status() >= 400) {
      test.skip(true, 'Registration closed hoac failed, bo qua permission test')
      return
    }
    const body = await regRes.json()
    const token = body.accessToken
    expect(token).toBeDefined()

    const res = await request.get(`${API_BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('TC08.26 — Login rate limit / brute-force khong crash', async ({ request }) => {
    // Goi 6 lan lien tiep voi password sai — chi can khong 500
    const results: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = await request.post(`${API_BASE}/api/auth/login`, {
        data: { email: ADMIN_EMAIL, password: 'wrong_' + i },
      })
      results.push(r.status())
    }
    // Tat ca phai < 500 (co the 401 hoac 429)
    for (const s of results) expect(s).toBeLessThan(500)
  })
})
