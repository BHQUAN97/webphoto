import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import { useUploadStore } from '@/stores/upload'
import { useAdminStore } from '@/stores/admin'
import { getSocket, connectSocket, disconnectSocket } from '@/plugins/socket'
import type { UserEventType, AdminEventType } from '@/types'

export function useNotify() {
  const auth = useAuthStore()
  const notifStore = useNotificationStore()
  const uploadStore = useUploadStore()
  const adminStore = useAdminStore()

  function setupListeners() {
    const socket = getSocket()
    if (!socket) return

    // Remove previous listener to prevent leak on reconnect
    socket.off('notification')

    socket.on('notification', (payload: Record<string, unknown>) => {
      // Server emits flat objects: { type, imageId, message, ... }
      // Extract nested data or use flat payload as data
      const eventType = payload.type as UserEventType | AdminEventType
      const eventData = (payload.data as Record<string, unknown>) ?? payload
      const imageId = (eventData.imageId ?? payload.imageId) as string | undefined

      notifStore.add({
        id: crypto.randomUUID(),
        type: eventType,
        message: (payload.message as string) || '',
        data: eventData,
        read: false,
        createdAt: new Date().toISOString(),
      })

      if (eventType === 'image:ready' && imageId) {
        const file = uploadStore.files.find((f) => f.imageId === imageId)
        if (file) uploadStore.setStatus(file.id, 'ready')
      }

      if (eventType === 'image:failed' && imageId) {
        const file = uploadStore.files.find((f) => f.imageId === imageId)
        if (file) uploadStore.setStatus(file.id, 'failed')
      }

      if ((eventType as string).startsWith('admin:')) {
        adminStore.addAlert({
          id: crypto.randomUUID(),
          level: eventType === 'admin:storage:alert' || eventType === 'admin:image:error:spike' ? 'error' : 'warning',
          message: String(payload.message || ''),
          type: eventType as AdminEventType,
        })
      }
    })
  }

  watch(
    () => auth.isAuthenticated,
    (val) => {
      if (val && auth.accessToken) {
        connectSocket(auth.accessToken)
        setupListeners()
      } else {
        disconnectSocket()
      }
    },
    { immediate: true },
  )
}
