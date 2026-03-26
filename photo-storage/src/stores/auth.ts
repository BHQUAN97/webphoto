import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import api from '@/utils/api'
import type { UserProfile } from '@/types'

const STORAGE_KEY_USER = 'auth_user'
const STORAGE_KEY_TOKEN = 'auth_token'

function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveToStorage(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch { /* quota exceeded or private mode */ }
}

export const useAuthStore = defineStore('auth', () => {
  // Restore from localStorage on creation (supports reload + new tab)
  const user = ref<UserProfile | null>(loadFromStorage<UserProfile>(STORAGE_KEY_USER))
  const accessToken = ref<string | null>(loadFromStorage<string>(STORAGE_KEY_TOKEN))
  const loading = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const planCode = computed(() => user.value?.planCode ?? 'free')
  const canDownload = computed(() => ['basic', 'pro'].includes(planCode.value) || isAdmin.value)
  const canFilter = computed(() => ['basic', 'pro'].includes(planCode.value) || isAdmin.value)
  const canEditPhoto = computed(() => planCode.value === 'pro' || isAdmin.value)

  // Persist auth state to localStorage whenever it changes
  watch(user, (v) => saveToStorage(STORAGE_KEY_USER, v), { deep: true })
  watch(accessToken, (v) => saveToStorage(STORAGE_KEY_TOKEN, v))

  // Cross-tab sync: listen for storage changes from other tabs
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY_USER) {
        user.value = e.newValue ? JSON.parse(e.newValue) : null
      }
      if (e.key === STORAGE_KEY_TOKEN) {
        accessToken.value = e.newValue ? JSON.parse(e.newValue) : null
      }
    })
  }

  async function register(data: { email: string; password: string; displayName: string }) {
    loading.value = true
    try {
      const res = await api.post('/auth/register', data)
      accessToken.value = res.data.accessToken
      user.value = res.data.user
    } finally {
      loading.value = false
    }
  }

  async function login(data: { email: string; password: string }) {
    loading.value = true
    try {
      const res = await api.post('/auth/login', data)
      accessToken.value = res.data.accessToken
      user.value = res.data.user
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    const res = await api.post('/auth/refresh')
    accessToken.value = res.data.accessToken
    user.value = res.data.user
  }

  async function fetchMe() {
    try {
      const res = await api.get('/users/me')
      user.value = res.data
    } catch {
      user.value = null
      accessToken.value = null
    }
  }

  async function updateProfile(data: Partial<{ displayName: string; bio: string; avatar: File }>) {
    const res = await api.patch('/users/me', data)
    if (user.value) {
      Object.assign(user.value, res.data)
    }
  }

  async function changePassword(data: { currentPassword: string; newPassword: string }) {
    await api.patch('/users/me', data)
  }

  function logout() {
    api.post('/auth/logout').catch(() => {})
    user.value = null
    accessToken.value = null
  }

  return {
    user, accessToken, loading,
    isAuthenticated, isAdmin, planCode,
    canDownload, canFilter, canEditPhoto,
    register, login, refresh, fetchMe,
    updateProfile, changePassword, logout,
  }
})
