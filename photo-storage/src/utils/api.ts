import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

let isRefreshing = false
let failedQueue: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = []

function processQueue(error: unknown) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(undefined)
  })
  failedQueue = []
}

// ── Request interceptor: auth + logging ──
api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`
  }

  // Log all requests
  const isRaw = config.data instanceof Blob || config.data instanceof ArrayBuffer || config.data instanceof Uint8Array
  const bodyInfo = isRaw
    ? `[binary ${config.data.byteLength ?? config.data.size ?? '?'}B]`
    : config.data
      ? JSON.stringify(config.data).slice(0, 200)
      : ''
  console.log(
    `%c[API] ${config.method?.toUpperCase()} ${config.url}`,
    'color:#2563eb',
    config.params ?? '',
    bodyInfo ? `body: ${bodyInfo}` : '',
  )

  // Attach start time for duration calc
  ;(config as any)._startTime = Date.now()

  return config
})

// ── Response interceptor: logging + 401 refresh ──
api.interceptors.response.use(
  (res) => {
    const dur = Date.now() - ((res.config as any)._startTime ?? Date.now())
    const dataPreview = typeof res.data === 'object'
      ? JSON.stringify(res.data).slice(0, 300)
      : String(res.data).slice(0, 300)
    console.log(
      `%c[API] ${res.status} ${res.config.method?.toUpperCase()} ${res.config.url} (${dur}ms)`,
      'color:#16a34a',
      dataPreview,
    )
    return res
  },
  async (error) => {
    const config = error.config
    const dur = Date.now() - ((config as any)?._startTime ?? Date.now())
    const status = error.response?.status ?? 0
    const errData = error.response?.data ?? error.message

    console.error(
      `%c[API] ${status} ${config?.method?.toUpperCase()} ${config?.url} (${dur}ms)`,
      'color:#dc2626',
      errData,
    )

    const originalRequest = error.config
    const isAuthRequest = originalRequest?.url?.includes('/auth/')
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => api(originalRequest))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const auth = useAuthStore()
        await auth.refresh()
        processQueue(null)
        return api(originalRequest)
      } catch (e) {
        processQueue(e)
        const auth = useAuthStore()
        if (auth.isAuthenticated) {
          auth.logout()
        }
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)

export default api
