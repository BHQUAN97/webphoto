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

    socket.on('notification', (payload: { type: UserEventType | AdminEventType; data: Record<string, unknown>; message: string }) => {
      notifStore.add({
        id: crypto.randomUUID(),
        type: payload.type,
        message: payload.message,
        data: payload.data,
        read: false,
        createdAt: new Date().toISOString(),
      })

      if (payload.type === 'image:ready' && payload.data?.imageId) {
        const file = uploadStore.files.find((f) => f.imageId === payload.data.imageId)
        if (file) uploadStore.setStatus(file.id, 'ready')
      }

      if (payload.type === 'image:failed' && payload.data?.imageId) {
        const file = uploadStore.files.find((f) => f.imageId === payload.data.imageId)
        if (file) uploadStore.setStatus(file.id, 'failed')
      }

      if ((payload.type as string).startsWith('admin:')) {
        adminStore.addAlert({
          id: crypto.randomUUID(),
          level: payload.type === 'admin:storage:alert' || payload.type === 'admin:image:error:spike' ? 'error' : 'warning',
          message: payload.message,
          type: payload.type as AdminEventType,
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
