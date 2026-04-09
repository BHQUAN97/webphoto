import { test, expect } from '@playwright/test'
import { API_BASE, getAdminToken } from './helpers'

test.describe('TC07 — API CRUD Operations', () => {

  test('TC07.1 — Public albums list', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/albums`)
    expect(res.ok()).toBeTruthy()
  })

  test('TC07.2 — Public images list', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/images`)
    expect(res.ok()).toBeTruthy()
  })

  test('TC07.3 — Create album thanh cong', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/albums`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: `QC Test ${Date.now()}`, isPublic: false }
    })
    expect(res.status()).toBeLessThan(300)
    const body = await res.json()
    // Luu album id de dung test sau
    expect(body).toBeDefined()
  })

  test('TC07.4 — Plans public >= 3 plans', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/plans`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // API tra ve { plans: [...] }
    const plans = body.plans ?? (Array.isArray(body) ? body : (body.data ?? []))
    expect(plans.length).toBeGreaterThanOrEqual(3)
  })

  test('TC07.5 — Payment methods public', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/payment-methods`)
    expect(res.ok()).toBeTruthy()
  })

  test('TC07.6 — Referrals API', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/referrals`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.status()).toBeLessThan(500)
  })

  test('TC07.7 — User albums', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/users/me/albums`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC07.8 — User stats', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/users/me/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.status()).toBeLessThan(500)
  })
})
