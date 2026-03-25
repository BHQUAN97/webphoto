import { google, type drive_v3 } from 'googleapis'
import { logger } from './logger.js'
import type { Readable } from 'stream'
import fs from 'fs'

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
        throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON file not found: ${jsonEnv}`)
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
          files.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: parseInt(f.size ?? '0', 10),
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
    logger.error('[GoogleDrive] listFiles error', { folderId, error: e.message, stack: e.stack })
    throw new Error(`Lỗi khi đọc folder Google Drive: ${e.message}`)
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
    logger.error('[GoogleDrive] listSubfolders error', { folderId, error: e.message })
    throw new Error(`Lỗi khi đọc subfolders: ${e.message}`)
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
    logger.error('[GoogleDrive] downloadFile error', { fileId, error: e.message })
    throw new Error(`Lỗi khi tải file từ Google Drive: ${e.message}`)
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
    logger.error('[GoogleDrive] getFileMetadata error', { fileId, error: e.message })
    throw new Error(`Lỗi khi lấy thông tin file: ${e.message}`)
  }
}
