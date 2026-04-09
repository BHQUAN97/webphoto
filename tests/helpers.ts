import { Page, APIRequestContext } from '@playwright/test'

export const API_BASE = 'http://127.0.0.1:4100'
export const ADMIN_EMAIL = 'admin@photostorage.com'
export const ADMIN_PASSWORD = 'admin123'

// Login qua API va tra ve accessToken
export async function getAdminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  })
  const body = await res.json()
  return body.accessToken
}

// Login admin tren UI
export async function loginAdminUI(page: Page) {
  // Login qua API de lay cookie
  const res = await page.request.post(`${API_BASE}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  })
  const body = await res.json()
  const token = body.accessToken

  // Set token vao localStorage/cookie truoc khi navigate
  await page.goto('http://localhost:3000/login')
  await page.evaluate((tk: string) => {
    localStorage.setItem('access_token', tk)
    document.cookie = `access_token=${tk}; path=/`
  }, token)
}
