import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Notification } from '@/types'

export const useNotificationStore = defineStore('notification', () => {
  const items = ref<Notification[]>([])
  const unreadCount = computed(() => items.value.filter((n) => !n.read).length)

  function add(notification: Notification) {
    items.value.unshift(notification)
    if (items.value.length > 50) {
      items.value = items.value.slice(0, 50)
    }
  }

  function markRead(id: string) {
    const item = items.value.find((n) => n.id === id)
    if (item) item.read = true
  }

  function markAllRead() {
    items.value.forEach((n) => (n.read = true))
  }

  function clear() {
    items.value = []
  }

  return { items, unreadCount, add, markRead, markAllRead, clear }
})
