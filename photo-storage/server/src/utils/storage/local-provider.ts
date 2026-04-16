import fs from 'fs/promises'
import { createReadStream, existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { Readable } from 'stream'
import type { StorageProvider, StorageInfo } from './types.js'

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string
  private privateDir: string
  private publicDir: string
  private tmpDir: string
  private serverUrl: string

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
    this.privateDir = path.join(this.baseDir, 'private')
    this.publicDir = path.join(this.baseDir, 'public')
    this.tmpDir = path.join(this.baseDir, 'tmp')
    this.serverUrl = process.env.APP_URL || 'http://localhost:4000'
  }

  async init() {
    await fs.mkdir(this.privateDir, { recursive: true })
    await fs.mkdir(this.publicDir, { recursive: true })
    await fs.mkdir(this.tmpDir, { recursive: true })
  }

  // ── Private bucket ──

  async createMultipartUpload(_key: string, _contentType: string): Promise<string> {
    const uploadId = crypto.randomUUID()
    await fs.mkdir(path.join(this.tmpDir, uploadId), { recursive: true })
    return uploadId
  }

  async presignPart(_key: string, _uploadId: string, _partNumber: number, _expiresIn?: number): Promise<string> {
    // Not used for local storage — frontend uses /api/storage/upload-chunk instead
    throw new Error('presignPart not supported for local storage')
  }

  async uploadPart(_key: string, uploadId: string, partNumber: number, data: Buffer): Promise<string> {
    return this.writeChunk(_key, uploadId, partNumber, data)
  }

  async writeChunk(_key: string, uploadId: string, partNumber: number, data: Buffer): Promise<string> {
    const chunkPath = path.join(this.tmpDir, uploadId, `part-${partNumber}`)
    await fs.writeFile(chunkPath, data)
    const hash = crypto.createHash('md5').update(data).digest('hex')
    return `"${hash}"`
  }

  async assembleChunks(key: string, uploadId: string, totalParts: number): Promise<void> {
    const filePath = path.join(this.privateDir, key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    const chunks: Buffer[] = []
    for (let i = 1; i <= totalParts; i++) {
      const chunkPath = path.join(this.tmpDir, uploadId, `part-${i}`)
      chunks.push(await fs.readFile(chunkPath))
    }
    await fs.writeFile(filePath, Buffer.concat(chunks))

    // Cleanup tmp
    await fs.rm(path.join(this.tmpDir, uploadId), { recursive: true, force: true })
  }

  async completeMultipart(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[]): Promise<void> {
    await this.assembleChunks(key, uploadId, parts.length)
  }

  async abortMultipart(_key: string, uploadId: string): Promise<void> {
    await fs.rm(path.join(this.tmpDir, uploadId), { recursive: true, force: true })
  }

  async uploadPrivateBuffer(key: string, buffer: Buffer, _contentType: string): Promise<void> {
    const filePath = path.join(this.privateDir, key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  }

  async downloadUrl(key: string, filename: string, expiresIn = 900): Promise<string> {
    // Create a signed token for download
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const token = await new SignJWT({ key, filename, purpose: 'download' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(`${expiresIn}s`)
      .sign(secret)
    return `/api/storage/download?token=${token}`
  }

  async getStream(key: string): Promise<Readable> {
    const filePath = path.join(this.privateDir, key)
    return createReadStream(filePath)
  }

  // ── Public bucket ──

  async presignUpload(key: string, contentType: string, _expiresIn?: number): Promise<string> {
    // Return server URL — frontend PUTs to Express instead of R2
    return `/api/storage/upload-public?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`
  }

  async uploadBuffer(key: string, buffer: Buffer, _contentType: string): Promise<void> {
    const filePath = path.join(this.publicDir, key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  }

  async deletePrivate(keys: string[]): Promise<void> {
    await Promise.all(keys.map(async k => {
      const filePath = path.join(this.privateDir, k)
      await fs.rm(filePath, { force: true })
    }))
  }

  async deletePublic(keys: string[]): Promise<void> {
    await Promise.all(keys.map(async k => {
      const filePath = path.join(this.publicDir, k)
      await fs.rm(filePath, { force: true })
    }))
  }

  publicUrl(key: string): string {
    return `/storage/public/${key}`
  }

  async getStorageInfo(): Promise<StorageInfo> {
    let usedPrivate = 0
    let usedPublic = 0

    try { usedPrivate = await this.getDirSize(this.privateDir) } catch { /* empty */ }
    try { usedPublic = await this.getDirSize(this.publicDir) } catch { /* empty */ }

    return {
      backend: 'local',
      directory: this.baseDir,
      usedBytesPrivate: usedPrivate,
      usedBytesPublic: usedPublic,
    }
  }

  getPublicDir(): string {
    return this.publicDir
  }

  getPrivateDir(): string {
    return this.privateDir
  }

  private async getDirSize(dir: string): Promise<number> {
    if (!existsSync(dir)) return 0
    let total = 0
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        total += await this.getDirSize(full)
      } else {
        const stat = await fs.stat(full)
        total += stat.size
      }
    }
    return total
  }
}
