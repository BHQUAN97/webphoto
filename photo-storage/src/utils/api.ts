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

api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
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
        auth.logout()
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)

export default api
