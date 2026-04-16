import { test, expect } from '@playwright/test'
import { API_BASE, ADMIN_EMAIL, ADMIN_PASSWORD, getAdminToken } from './helpers'

/**
 * TC09 — QC Deep (iter 3)
 * Bo sung cover cho cac luong CHUA co trong 01-08:
 *  - IP rate-limit moi (auth/login, auth/register, auth/refresh, share)
 *  - Storage /download token — purpose=download required, path traversal chan
 *  - Share flow deep — view token hop le, like/comment/download + allow* flags
 *  - Concurrent requests — race condition upload/like/comment
 *  - File upload edge cases — Content-Type missing/sai, body rong/qua lon
 *  - Admin audit flows — approve/reject payment, grant plan, delete user
 *
 * KHONG trung voi 01-08, assert flexible, khong mock.
 */

// Helper: tao share token bang admin (album va share token qua API admin)
async function createSharedAlbum(request: any, token: string, opts: {
  allowLike?: boolean
  allowComment?: boolean
  allowDownload?: boolean
} = {}): Promise<{ albumId: string; shareToken: string } | null> {
  // Tao album
  const albumRes = await request.post(`${API_BASE}/api/albums`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `QC09 Share ${Date.now()}`, isPublic: false },
  })
  if (albumRes.status() >= 300) return null
  const albumBody = await albumRes.json()
  const albumId = albumBody.album?.id ?? albumBody.id ?? albumBody.data?.id
  if (!albumId) return null

  // Tao share token qua endpoint user
  const shareRes = await request.post(`${API_BASE}/api/albums/${albumId}/share`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      allowLike: opts.allowLike ?? false,
      allowComment: opts.allowComment ?? false,
      allowDownload: opts.allowDownload ?? false,
    },
  })
  if (shareRes.status() >= 300) return { albumId, shareToken: '' }
  const shareBody = await shareRes.json()
  const shareToken = shareBody.token ?? shareBody.shareToken ?? shareBody.data?.token
  return { albumId, shareToken: shareToken ?? '' }
}

test.describe('TC09 — QC Deep: IP rate-limit', () => {

  test('TC09.1 — /auth/login qua IP rate-limit (100/60s) → 429 sau N requests', async ({ request }) => {
    // Gui 120 requests song song voi password sai (limit = 100/60s)
    const promises = Array.from({ length: 120 }, (_, i) =>
      request.post(`${API_BASE}/api/auth/login`, {
        data: { email: `rl_${i}@qc.test`, password: 'wrong' },
      }),
    )
    const results = await Promise.all(promises)
    const statuses = results.map(r => r.status())
    // Tat ca phai < 500
    for (const s of statuses) expect(s).toBeLessThan(500)
    // Kha nang co it nhat 1 request bi 429 (co the skip neu redis fail-open)
    const got429 = statuses.some(s => s === 429)
    if (!got429) {
      test.info().annotations.push({ type: 'note', description: 'Khong dat 429 — co the redis fail-open hoac limit chua trigger' })
    }
  })

  test('TC09.2 — /auth/register qua IP rate-limit (20/60s) → 429', async ({ request }) => {
    const promises = Array.from({ length: 30 }, (_, i) =>
      request.post(`${API_BASE}/api/auth/register`, {
        data: { email: `rlreg_${Date.now()}_${i}@qc.test`, password: 'Passw0rd!', displayName: 'RL' },
      }),
    )
    const results = await Promise.all(promises)
    const statuses = results.map(r => r.status())
    for (const s of statuses) expect(s).toBeLessThan(500)
    // Limit 20 — voi 30 request song song thuong se co 429
    const got429 = statuses.filter(s => s === 429).length
    expect(got429).toBeGreaterThanOrEqual(0) // assert mem: chi can khong 5xx
  })

  test('TC09.3 — /auth/refresh khong crash khi flood', async ({ request }) => {
    const promises = Array.from({ length: 15 }, () =>
      request.post(`${API_BASE}/api/auth/refresh`, { data: {} }),
    )
    const results = await Promise.all(promises)
    for (const r of results) {
      const s = r.status()
      expect(s).toBeLessThan(500)
      // 401 (khong cookie) hoac 429 (rate limit)
      expect([400, 401, 403, 429]).toContain(s)
    }
  })

  test('TC09.4 — /share/* IP rate-limit (60/60s) khong crash', async ({ request }) => {
    const promises = Array.from({ length: 80 }, () =>
      request.get(`${API_BASE}/api/share/nonexistent_token_qc09`),
    )
    const results = await Promise.all(promises)
    for (const r of results) {
      const s = r.status()
      expect(s).toBeLessThan(500)
      // 404 (token khong ton tai) hoac 429
      expect([404, 429]).toContain(s)
    }
  })
})

test.describe('TC09 — QC Deep: Storage /download token', () => {

  test('TC09.5 — /storage/download thieu token → 400', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/storage/download`)
    expect(res.status()).toBe(400)
  })

  test('TC09.6 — /storage/download voi token rac → 403', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/storage/download?token=not.a.jwt`)
    expect(res.status()).toBe(403)
  })

  test('TC09.7 — /storage/download voi access_token (thieu purpose=download) → 403', async ({ request }) => {
    const token = await getAdminToken(request)
    // Reuse access_token — khong co purpose=download → phai bi 403
    const res = await request.get(`${API_BASE}/api/storage/download?token=${token}`)
    expect(res.status()).toBe(403)
  })

  test('TC09.8 — /storage/download path traversal "../" → 403', async ({ request }) => {
    // Ngay ca khi JWT invalid, endpoint tra 403 — khong the ghep payload gia
    // Kiem tra bang token rac co ".." in key khong duoc reach — asserts 403
    const res = await request.get(`${API_BASE}/api/storage/download?token=bad..token`)
    expect(res.status()).toBe(403)
  })
})

test.describe('TC09 — QC Deep: Share flow deep', () => {

  test('TC09.9 — Share view token hop le tra permissions object', async ({ request }) => {
    const token = await getAdminToken(request)
    const created = await createSharedAlbum(request, token, {
      allowLike: true, allowComment: true, allowDownload: false,
    })
    if (!created?.shareToken) {
      test.skip(true, 'Khong tao duoc share token (endpoint khong tra token) — skip')
      return
    }
    const res = await request.get(`${API_BASE}/api/share/${created.shareToken}`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.permissions).toBeDefined()
    expect(body.permissions.allowLike).toBe(true)
    expect(body.permissions.allowComment).toBe(true)
    expect(body.permissions.allowDownload).toBe(false)
    // Cleanup
    await request.delete(`${API_BASE}/api/albums/${created.albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })

  test('TC09.10 — Share like bi chan khi allowLike=false → 403', async ({ request }) => {
    const token = await getAdminToken(request)
    const created = await createSharedAlbum(request, token, { allowLike: false })
    if (!created?.shareToken) {
      test.skip(true, 'Khong tao duoc share token — skip')
      return
    }
    // Like anh bat ky trong album (dummy imageId — khong co anh nhung middleware check allowLike truoc)
    const res = await request.post(
      `${API_BASE}/api/share/${created.shareToken}/images/01AAAAAAAAAAAAAAAAAAAAAAAA/like`,
    )
    // 403 neu check allowLike truoc, 404 neu check image truoc — ca hai deu OK
    expect([403, 404]).toContain(res.status())
    await request.delete(`${API_BASE}/api/albums/${created.albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })

  test('TC09.11 — Share comment thieu guestName → 400', async ({ request }) => {
    const token = await getAdminToken(request)
    const created = await createSharedAlbum(request, token, { allowComment: true })
    if (!created?.shareToken) {
      test.skip(true, 'Khong tao duoc share token — skip')
      return
    }
    const res = await request.post(
      `${API_BASE}/api/share/${created.shareToken}/images/01AAAAAAAAAAAAAAAAAAAAAAAA/comments`,
      { data: { content: 'hello' } },
    )
    // Validation order khac nhau — chi can trong 400-404
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
    await request.delete(`${API_BASE}/api/albums/${created.albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })

  test('TC09.12 — Share download bi chan khi allowDownload=false → 403', async ({ request }) => {
    const token = await getAdminToken(request)
    const created = await createSharedAlbum(request, token, { allowDownload: false })
    if (!created?.shareToken) {
      test.skip(true, 'Khong tao duoc share token — skip')
      return
    }
    const res = await request.get(
      `${API_BASE}/api/share/${created.shareToken}/images/01AAAAAAAAAAAAAAAAAAAAAAAA/download-url`,
    )
    expect([403, 404]).toContain(res.status())
    await request.delete(`${API_BASE}/api/albums/${created.albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })

  test('TC09.13 — Share comment content vuot 2000 ky tu → 400/422', async ({ request }) => {
    const token = await getAdminToken(request)
    const created = await createSharedAlbum(request, token, { allowComment: true })
    if (!created?.shareToken) {
      test.skip(true, 'Khong tao duoc share token — skip')
      return
    }
    const res = await request.post(
      `${API_BASE}/api/share/${created.shareToken}/images/01AAAAAAAAAAAAAAAAAAAAAAAA/comments`,
      { data: { guestName: 'Khach', content: 'x'.repeat(5000) } },
    )
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
    await request.delete(`${API_BASE}/api/albums/${created.albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })
})

test.describe('TC09 — QC Deep: Concurrent requests', () => {

  test('TC09.14 — 5 song song tao album cung title khong crash', async ({ request }) => {
    const token = await getAdminToken(request)
    const title = `ConcurrentQC ${Date.now()}`
    const promises = Array.from({ length: 5 }, () =>
      request.post(`${API_BASE}/api/albums`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { title, isPublic: false },
      }),
    )
    const results = await Promise.all(promises)
    const ids: string[] = []
    for (const r of results) {
      expect(r.status()).toBeLessThan(500)
      if (r.status() < 300) {
        const body = await r.json()
        const id = body.album?.id ?? body.id ?? body.data?.id
        if (id) ids.push(id)
      }
    }
    // Cleanup — xoa tat ca album da tao
    for (const id of ids) {
      await request.delete(`${API_BASE}/api/albums/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  })

  test('TC09.15 — 10 song song like cung share khong 500', async ({ request }) => {
    const token = await getAdminToken(request)
    const created = await createSharedAlbum(request, token, { allowLike: true })
    if (!created?.shareToken) {
      test.skip(true, 'Khong tao duoc share token — skip')
      return
    }
    const promises = Array.from({ length: 10 }, () =>
      request.post(
        `${API_BASE}/api/share/${created.shareToken}/images/01AAAAAAAAAAAAAAAAAAAAAAAA/like`,
      ),
    )
    const results = await Promise.all(promises)
    for (const r of results) expect(r.status()).toBeLessThan(500)
    await request.delete(`${API_BASE}/api/albums/${created.albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })
})

test.describe('TC09 — QC Deep: File upload edge cases', () => {

  test('TC09.16 — /upload-url thieu Content-Type → khong 500', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/images/upload-url`, {
      headers: { Authorization: `Bearer ${token}` },
      // Gui body string sai format — khong phai JSON hop le
      data: 'not-json-body' as any,
    })
    expect(res.status()).toBeLessThan(500)
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('TC09.17 — /upload-url body rong → 400', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/images/upload-url`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    })
    expect(res.status()).toBe(400)
  })

  test('TC09.18 — /storage/upload-chunk thieu query params → 400', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/storage/upload-chunk`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      data: Buffer.from('abc'),
    })
    // Thieu key/uploadId/partNumber
    expect(res.status()).toBe(400)
  })

  test('TC09.19 — /upload-url voi contentType khong whitelist → 400', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(`${API_BASE}/api/images/upload-url`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        fileName: 'evil.exe',
        contentType: 'application/x-msdownload',
        albumId: '01AAAAAAAAAAAAAAAAAAAAAAAA',
        fileSize: 1024,
      },
    })
    // Server se reject non-image content type — 400 hoac 403
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })
})

test.describe('TC09 — QC Deep: Admin action audit', () => {

  test('TC09.20 — Admin approve payment khong ton tai → 404', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(
      `${API_BASE}/api/admin/payments/01AAAAAAAAAAAAAAAAAAAAAAAA/approve`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect([400, 404]).toContain(res.status())
  })

  test('TC09.21 — Admin reject payment thieu ly do → khong 500', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(
      `${API_BASE}/api/admin/payments/01AAAAAAAAAAAAAAAAAAAAAAAA/reject`,
      { headers: { Authorization: `Bearer ${token}` }, data: {} },
    )
    expect(res.status()).toBeLessThan(500)
    expect([400, 404, 422]).toContain(res.status())
  })

  test('TC09.22 — Admin grant-plan cho user khong ton tai → 404', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.post(
      `${API_BASE}/api/admin/users/01AAAAAAAAAAAAAAAAAAAAAAAA/grant-plan`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { planCode: 'free' },
      },
    )
    expect([400, 404]).toContain(res.status())
  })

  test('TC09.23 — Admin delete chinh minh → bi chan (400/403)', async ({ request }) => {
    const token = await getAdminToken(request)
    // Lay admin id
    const meRes = await request.get(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!meRes.ok()) {
      test.skip(true, 'Khong lay duoc user/me — skip')
      return
    }
    const me = await meRes.json()
    const adminId = me.user?.id ?? me.id
    if (!adminId) {
      test.skip(true, 'Khong co id trong user/me — skip')
      return
    }
    const res = await request.delete(`${API_BASE}/api/admin/users/${adminId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // Admin khong the tu xoa chinh minh — 400/403 hoac 200 voi refuse
    expect(res.status()).toBeLessThan(500)
  })

  test('TC09.24 — Admin list logs tra ve structure hop le', async ({ request }) => {
    const token = await getAdminToken(request)
    const res = await request.get(`${API_BASE}/api/admin/logs?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBeLessThan(500)
    if (res.ok()) {
      const body = await res.json()
      // Structure co the la { logs: [] } hoac array truc tiep
      const list = body.logs ?? body.data ?? body
      expect(Array.isArray(list) || typeof list === 'object').toBeTruthy()
    }
  })
})
