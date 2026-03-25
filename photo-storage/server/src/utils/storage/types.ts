import type { Readable } from 'stream'

export interface StorageProvider {
  // ── Private bucket (originals) ──
  createMultipartUpload(key: string, contentType: string): Promise<string>
  presignPart(key: string, uploadId: string, partNumber: number, expiresIn?: number): Promise<string>
  completeMultipart(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[]): Promise<void>
  abortMultipart(key: string, uploadId: string): Promise<void>
  downloadUrl(key: string, filename: string, expiresIn?: number): Promise<string>
  getStream(key: string): Promise<Readable>
  deletePrivate(keys: string[]): Promise<void>

  // ── Public bucket (thumbs/previews/avatars/QR) ──
  presignUpload(key: string, contentType: string, expiresIn?: number): Promise<string>
  uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void>
  deletePublic(keys: string[]): Promise<void>
  publicUrl(key: string): string

  // ── Server-side chunk upload (local & R2) ──
  uploadPart(key: string, uploadId: string, partNumber: number, data: Buffer): Promise<string>

  // ── Local-only: legacy ──
  writeChunk?(key: string, uploadId: string, partNumber: number, data: Buffer): Promise<string>
  assembleChunks?(key: string, uploadId: string, totalParts: number): Promise<void>

  // ── Info ──
  getStorageInfo(): Promise<StorageInfo>
}

export interface StorageInfo {
  backend: 'r2' | 'local'
  directory?: string
  usedBytesPrivate?: number
  usedBytesPublic?: number
}
