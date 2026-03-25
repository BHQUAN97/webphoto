import { Server as SocketServer } from 'socket.io'
import { createClient } from 'redis'
import { createAdapter } from '@socket.io/redis-adapter'
import { jwtUtils } from '../utils/jwt.js'
import type { Server } from 'http'

export async function setupSocketServer(httpServer: Server) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
      credentials: true,
    },
    path: '/socket.io',
  })

  // Redis adapter for multi-instance scaling
  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL })
    const subClient = pubClient.duplicate()
    await Promise.all([pubClient.connect(), subClient.connect()])
    io.adapter(createAdapter(pubClient, subClient))

    // Listen for events published by workers/API
    const subscriber = createClient({ url: process.env.REDIS_URL })
    await subscriber.connect()
    await subscriber.subscribe('socket:notify', (message) => {
      const data = JSON.parse(message)
      if (data.room === 'admin') {
        io.to('admin').emit(data.event.type, data.event)
      } else if (data.userId) {
        io.to(`user:${data.userId}`).emit(data.event.type, data.event)
      }
    })
  }

  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
      ?? socket.handshake.headers?.authorization?.replace('Bearer ', '')
    if (!token) return next(new Error('Chưa đăng nhập'))

    const payload = await jwtUtils.verify(token)
    if (!payload) return next(new Error('Token không hợp lệ'))

    socket.data.user = payload
    next()
  })

  io.on('connection', (socket) => {
    const user = socket.data.user
    socket.join(`user:${user.sub}`)

    if (user.role === 'admin') {
      socket.join('admin')
    }

    socket.on('disconnect', () => {
      // cleanup if needed
    })
  })

  return io
}
