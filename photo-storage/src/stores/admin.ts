import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AdminAlert } from '@/types'

export const useAdminStore = defineStore('admin', () => {
  const alerts = ref<AdminAlert[]>([])

  function addAlert(alert: AdminAlert) {
    if (alerts.value.some((a) => a.id === alert.id)) return
    alerts.value.unshift(alert)
  }

  function dismiss(id: string) {
    const a = alerts.value.find((a) => a.id === id)
    if (a) a.dismissedAt = new Date().toISOString()
  }

  function clear() {
    alerts.value = []
  }

  return { alerts, addAlert, dismiss, clear }
})
