import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ulid } from 'ulid'
import { db } from './db.js'
import { appLogs } from '../database/schema.js'

// ─── Log Levels (NLog-style) ─────────────────────────────────────────────
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO  = 2,
  WARN  = 3,
  ERROR = 4,
  FATAL = 5,
}

const LEVEL_NAMES = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const
export type LogLevelName = (typeof LEVEL_NAMES)[number]

export interface LogMeta {
  requestId?: string
  method?: string
  url?: string
  userId?: string
  statusCode?: number
  durationMs?: number
  stack?: string
  source?: string
  [key: string]: unknown
}

// ─── Config ───────────────────────────────────────────────────────────────
function parseLevel(envVal: string | undefined, fallback: LogLevel): LogLevel {
  if (!envVal) return fallback
  const idx = LEVEL_NAMES.indexOf(envVal.toUpperCase() as LogLevelName)
  return idx >= 0 ? idx : fallback
}

const minFileLevel = parseLevel(process.env.LOG_FILE_LEVEL, LogLevel.DEBUG)
const minDbLevel   = parseLevel(process.env.LOG_DB_LEVEL, LogLevel.WARN)
const isDev        = process.env.NODE_ENV !== 'production'

// ─── File Setup ───────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logsDir   = path.resolve(__dirname, '../../logs')
fs.mkdirSync(logsDir, { recursive: true })

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return path.join(logsDir, `${date}.log`)
}

// ─── Writers ──────────────────────────────────────────────────────────────
function writeToFile(level: LogLevelName, message: string, meta?: LogMeta): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...meta,
  })
  fs.promises.appendFile(getLogFilePath(), line + '\n').catch(() => {})
}

function writeToDB(level: LogLevelName, message: string, meta?: LogMeta): void {
  const { stack, ...rest } = meta ?? {}
  db.insert(appLogs).values({
    id: ulid(),
    level,
    message,
    context: Object.keys(rest).length > 0 ? JSON.stringify(rest) : null,
    stack: stack ?? null,
    createdAt: new Date(),
  }).catch(() => {})
}

function writeToConsole(level: LogLevelName, message: string, meta?: LogMeta): void {
  const prefix = `[${new Date().toISOString()}] [${level}]`
  const extra = meta?.requestId ? ` (${meta.requestId})` : ''
  switch (level) {
    case 'ERROR':
    case 'FATAL':
      console.error(`${prefix}${extra} ${message}`, meta?.stack ?? '')
      break
    case 'WARN':
      console.warn(`${prefix}${extra} ${message}`)
      break
    default:
      console.log(`${prefix}${extra} ${message}`)
  }
}

// ─── Core Log Function ────────────────────────────────────────────────────
function _log(level: LogLevel, message: string, meta?: LogMeta): void {
  const levelName = LEVEL_NAMES[level]

  if (level >= minFileLevel) {
    writeToFile(levelName, message, meta)
  }

  if (level >= minDbLevel) {
    writeToDB(levelName, message, meta)
  }

  if (isDev) {
    writeToConsole(levelName, message, meta)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────
export const logger = {
  trace: (message: string, meta?: LogMeta) => _log(LogLevel.TRACE, message, meta),
  debug: (message: string, meta?: LogMeta) => _log(LogLevel.DEBUG, message, meta),
  info:  (message: string, meta?: LogMeta) => _log(LogLevel.INFO, message, meta),
  warn:  (message: string, meta?: LogMeta) => _log(LogLevel.WARN, message, meta),
  error: (message: string, meta?: LogMeta) => _log(LogLevel.ERROR, message, meta),
  fatal: (message: string, meta?: LogMeta) => _log(LogLevel.FATAL, message, meta),

  /** Direct access to logs directory path (for cron cleanup) */
  logsDir,
}
