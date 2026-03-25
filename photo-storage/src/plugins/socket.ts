import { io, Socket } from 'socket.io-client'
import type { App } from 'vue'

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

export function connectSocket(token: string) {
  if (socket?.connected) return

  // In production, connect via same origin (Nginx proxies /socket.io → :4001)
  // In dev, connect to localhost:4001
  const url = import.meta.env.VITE_SOCKET_URL || (
    import.meta.env.PROD ? window.location.origin : 'http://localhost:4001'
  )
  console.log('[Socket] Connecting to', url)

  socket = io(url, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  })

  socket.on('connect', () => {
    console.log('[Socket] Connected, id:', socket?.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message)
  })
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export const socketPlugin = {
  install(_app: App) {
    // Socket is managed manually via connectSocket/disconnectSocket
  },
}
