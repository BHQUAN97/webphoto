import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../database/schema.js'

// idleTimeout 30s + maxIdle 2: tranh Docker Desktop / NAT giet TCP idle connection
// dan toi ECONNRESET o lan query ke tiep. Pool thay vi giu 10 connection 60s,
// giam xuong 2 connection 30s — recycle thuong xuyen hon, it stale.
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL!,
  connectionLimit: 20,
  maxIdle: 2,
  idleTimeout: 30_000,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
})
export const db = drizzle(pool, { schema, mode: 'default' })
export type DB = typeof db
export { pool }

// Keep-alive ping moi 20s: giu TCP connection song qua NAT / Docker bridge.
// Chay o background khi module load, khong block dau.
let keepAliveStarted = false
function startKeepAlive() {
  if (keepAliveStarted) return
  keepAliveStarted = true
  setInterval(() => {
    pool.query('SELECT 1').catch(() => {
      // Connection co the dead — pool se mo lai o query ke tiep
    })
  }, 20_000).unref()
}
startKeepAlive()
