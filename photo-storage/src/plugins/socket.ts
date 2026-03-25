import { io, Socket } from 'socket.io-client'
import type { App } from 'vue'

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

export function connectSocket(token: string) {
  if (socket?.connected) return

  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4001', {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  })

  socket.on('connect', () => {
    if (import.meta.env.DEV) console.log('[Socket] Connected')
  })

  socket.on('disconnect', (reason) => {
    if (import.meta.env.DEV) console.log('[Socket] Disconnected:', reason)
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
