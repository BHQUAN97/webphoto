import { google, type drive_v3 } from 'googleapis'
import { logger } from './logger.js'
import { getSetting } from './settings-cache.js'
import type { Readable } from 'stream'
import fs from 'fs'

// ─── Default max upload size (200 MB) ──────────────────────────────────────
const DEFAULT_MAX_UPLOAD_SIZE_MB = 200

// ─── Supported image MIME types ────────────────────────────────────────────
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/x-canon-cr2',
  'image/x-sony-arw',
  'image/x-nikon-nef',
  'image/x-adobe-dng',
])

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  thumbnailLink?: string
}

export interface DriveFolder {
  id: string
  name: string
}

// ─── Validate Drive config at startup (non-fatal — Drive is optional) ─────
export function validateDriveConfig(): { ok: boolean; message: string } {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!jsonEnv) {
    return { ok: false, message: 'GOOGLE_SERVICE_ACCOUNT_JSON not set — Google Drive integration disabled' }
  }
  // Validate it's parseable or a valid file path without logging credentials
  try {
    JSON.parse(jsonEnv)
    return { ok: true, message: 'Google Drive credentials configured (inline JSON)' }
  } catch {
    if (fs.existsSync(jsonEnv)) {
      return { ok: true, message: 'Google Drive credentials configured (file path)' }
    }
    return { ok: false, message: 'GOOGLE_SERVICE_ACCOUNT_JSON is neither valid JSON nor a valid file path' }
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────
let _drive: drive_v3.Drive | null = null

function getDrive(): drive_v3.Drive {
  if (_drive) return _drive

  let credentials: Record<string, unknown>

  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (jsonEnv) {
    // Try parsing as JSON string first, then as file path
    try {
      credentials = JSON.parse(jsonEnv)
    } catch {
      // Not valid JSON — treat as file path
      if (!fs.existsSync(jsonEnv)) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON file not found at configured path')
      }
      credentials = JSON.parse(fs.readFileSync(jsonEnv, 'utf-8'))
    }
  } else {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON environment variable (JSON string or file path)')
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })

  _drive = google.drive({ version: 'v3', auth })
  return _drive
}

// ─── Extract folder ID from URL or raw ID ──────────────────────────────────
export function extractFolderId(input: string): string {
  // Match: https://drive.google.com/drive/folders/FOLDER_ID?...
  const urlMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return urlMatch[1]

  // Already a plain ID
  if (/^[a-zA-Z0-9_-]+$/.test(input.trim())) return input.trim()

  throw new Error(`Không thể nhận diện folder ID từ: ${input}`)
}

// ─── List all image files in a folder (with pagination) ────────────────────
export async function listFiles(folderId: string): Promise<DriveFile[]> {
  const drive = getDrive()
  const files: DriveFile[] = []
  let pageToken: string | undefined

  // Get max upload size setting (default 200MB)
  let maxSizeBytes: number
  try {
    const maxMb = parseInt(await getSetting('max_upload_size_mb', String(DEFAULT_MAX_UPLOAD_SIZE_MB)))
    maxSizeBytes = (maxMb > 0 ? maxMb : DEFAULT_MAX_UPLOAD_SIZE_MB) * 1024 * 1024
  } catch {
    maxSizeBytes = DEFAULT_MAX_UPLOAD_SIZE_MB * 1024 * 1024
  }

  // Build mimeType query: mimeType='image/jpeg' or mimeType='image/png' or ...
  const mimeFilter = [...IMAGE_MIME_TYPES].map(m => `mimeType='${m}'`).join(' or ')

  try {
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and (${mimeFilter}) and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, thumbnailLink)',
        pageSize: 1000,
        pageToken,
      })

      for (const f of res.data.files ?? []) {
        if (f.id && f.name && f.mimeType) {
          const fileSize = parseInt(f.size ?? '0', 10)

          // Skip files exceeding max upload size
          if (fileSize > maxSizeBytes) {
            logger.warn(`[GoogleDrive] Skipping large file: ${f.name} (${(fileSize / 1024 / 1024).toFixed(1)}MB > ${maxSizeBytes / 1024 / 1024}MB limit)`, {
              folderId, fileId: f.id, fileName: f.name, fileSize,
            })
            continue
          }

          files.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: fileSize,
            thumbnailLink: f.thumbnailLink ?? undefined,
          })
        }
      }

      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
  } catch (err) {
    const e = err as Error & { code?: number }
    if (e.code === 404 || e.message?.includes('notFound')) {
      throw new Error(`Folder không tồn tại hoặc không có quyền truy cập: ${folderId}`)
    }
    // Redact error message to avoid leaking credentials
    const safeMessage = e.message?.replace(/key[=:]\s*\S+/gi, 'key=[REDACTED]') ?? 'Unknown error'
    logger.error('[GoogleDrive] listFiles error', { folderId, error: safeMessage })
    throw new Error(`Lỗi khi đọc folder Google Drive`)
  }

  return files
}

// ─── List subfolders in a folder ───────────────────────────────────────────
export async function listSubfolders(folderId: string): Promise<DriveFolder[]> {
  const drive = getDrive()
  const folders: DriveFolder[] = []
  let pageToken: string | undefined

  try {
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken,
      })

      for (const f of res.data.files ?? []) {
        if (f.id && f.name) {
          folders.push({ id: f.id, name: f.name })
        }
      }

      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
  } catch (err) {
    const e = err as Error & { code?: number }
    logger.error('[GoogleDrive] listSubfolders error', { folderId, error: e.message?.replace(/key[=:]\s*\S+/gi, 'key=[REDACTED]') })
    throw new Error(`Lỗi khi đọc subfolders`)
  }

  return folders
}

// ─── Download a file as readable stream ────────────────────────────────────
export async function downloadFile(fileId: string): Promise<Readable> {
  const drive = getDrive()

  try {
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' },
    )
    return res.data as unknown as Readable
  } catch (err) {
    const e = err as Error & { code?: number }
    if (e.code === 404) {
      throw new Error(`File không tồn tại trên Google Drive: ${fileId}`)
    }
    logger.error('[GoogleDrive] downloadFile error', { fileId, error: e.message?.replace(/key[=:]\s*\S+/gi, 'key=[REDACTED]') })
    throw new Error(`Lỗi khi tải file từ Google Drive`)
  }
}

// ─── Get single file metadata ──────────────────────────────────────────────
export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const drive = getDrive()

  try {
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, thumbnailLink',
    })

    const f = res.data
    if (!f.id || !f.name || !f.mimeType) {
      throw new Error('Thiếu thông tin metadata')
    }

    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: parseInt(f.size ?? '0', 10),
      thumbnailLink: f.thumbnailLink ?? undefined,
    }
  } catch (err) {
    const e = err as Error & { code?: number }
    if (e.code === 404) {
      throw new Error(`File không tồn tại trên Google Drive: ${fileId}`)
    }
    logger.error('[GoogleDrive] getFileMetadata error', { fileId, error: e.message?.replace(/key[=:]\s*\S+/gi, 'key=[REDACTED]') })
    throw new Error(`Lỗi khi lấy thông tin file`)
  }
}
