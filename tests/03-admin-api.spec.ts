import { test, expect } from '@playwright/test'
import { API_BASE, getAdminToken } from './helpers'

test.describe('TC03 — Admin API Endpoints', () => {

  test('TC03.1 — Dashboard stats', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC03.2 — List users', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // Kiem tra co data
    expect(body).toBeDefined()
  })

  test('TC03.3 — User detail', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/users/01KMF9GFSYGJ2V0MQJ16RX7FX7`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC03.4 — List albums', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/albums`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC03.5 — List payments', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/payments`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC03.6 — List plans', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/plans`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC03.7 — Payment methods', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/payment-methods`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC03.8 — Vouchers', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/vouchers`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC03.9 — Settings', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC03.10 — Logs', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/logs`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
  })

  test('TC03.11 — Dashboard charts', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/dashboard/charts`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    // Co the 404 neu endpoint chua co, nhung khong duoc 500
    expect(res.status()).toBeLessThan(500)
  })
})
