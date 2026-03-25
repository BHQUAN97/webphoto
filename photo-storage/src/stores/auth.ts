import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/utils/api'
import type { UserProfile } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const accessToken = ref<string | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const planCode = computed(() => user.value?.planCode ?? 'free')
  const canDownload = computed(() => ['basic', 'pro'].includes(planCode.value) || isAdmin.value)
  const canFilter = computed(() => ['basic', 'pro'].includes(planCode.value) || isAdmin.value)
  const canEditPhoto = computed(() => planCode.value === 'pro' || isAdmin.value)

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
