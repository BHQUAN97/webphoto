import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../database/schema.js'

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL!,
  connectionLimit: 20,
  maxIdle: 10,
  idleTimeout: 60000,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
})
export const db = drizzle(pool, { schema, mode: 'default' })
export type DB = typeof db
export { pool }
