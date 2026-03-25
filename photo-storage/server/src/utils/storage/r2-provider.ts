import {
  S3Client, GetObjectCommand, DeleteObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Readable } from 'stream'
import type { StorageProvider, StorageInfo } from './types.js'

export class R2StorageProvider implements StorageProvider {
  private r2Private: S3Client
  private r2Public: S3Client
  private privateBucket: string
  private publicBucket: string
  private cdnUrl: string

  constructor() {
    const cfg = {
      region: 'auto' as const,
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY!,
        secretAccessKey: process.env.R2_SECRET_KEY!,
      },
    }
    this.r2Private = new S3Client(cfg)
    this.r2Public = new S3Client(cfg)
    this.privateBucket = process.env.R2_PRIVATE_BUCKET!
    this.publicBucket = process.env.R2_PUBLIC_BUCKET!
    this.cdnUrl = process.env.CDN_URL!
  }

  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const res = await this.r2Private.send(new CreateMultipartUploadCommand({
      Bucket: this.privateBucket, Key: key, ContentType: contentType,
    }))
    return res.UploadId!
  }

  async presignPart(key: string, uploadId: string, partNumber: number, expiresIn = 3600): Promise<string> {
    return getSignedUrl(this.r2Private, new UploadPartCommand({
      Bucket: this.privateBucket, Key: key,
      UploadId: uploadId, PartNumber: partNumber,
    }), { expiresIn })
  }

  async uploadPart(key: string, uploadId: string, partNumber: number, data: Buffer): Promise<string> {
    const res = await this.r2Private.send(new UploadPartCommand({
      Bucket: this.privateBucket, Key: key,
      UploadId: uploadId, PartNumber: partNumber,
      Body: data,
    }))
    return res.ETag ?? ''
  }

  async completeMultipart(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[]): Promise<void> {
    await this.r2Private.send(new CompleteMultipartUploadCommand({
      Bucket: this.privateBucket, Key: key, UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }))
  }

  async abortMultipart(key: string, uploadId: string): Promise<void> {
    await this.r2Private.send(new AbortMultipartUploadCommand({
      Bucket: this.privateBucket, Key: key, UploadId: uploadId,
    }))
  }

  async downloadUrl(key: string, filename: string, expiresIn = 900): Promise<string> {
    return getSignedUrl(this.r2Private,
      new GetObjectCommand({
        Bucket: this.privateBucket, Key: key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
      }), { expiresIn })
  }

  async getStream(key: string): Promise<Readable> {
    const res = await this.r2Private.send(new GetObjectCommand({
      Bucket: this.privateBucket, Key: key,
    }))
    return res.Body as Readable
  }

  async presignUpload(key: string, contentType: string, expiresIn = 600): Promise<string> {
    return getSignedUrl(this.r2Public, new PutObjectCommand({
      Bucket: this.publicBucket, Key: key,
      ContentType: contentType, CacheControl: 'public, max-age=2592000',
    }), { expiresIn })
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.r2Public.send(new PutObjectCommand({
      Bucket: this.publicBucket, Key: key, Body: buffer,
      ContentType: contentType, CacheControl: 'public, max-age=2592000',
    }))
  }

  async deletePrivate(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k =>
      this.r2Private.send(new DeleteObjectCommand({ Bucket: this.privateBucket, Key: k }))
    ))
  }

  async deletePublic(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k =>
      this.r2Public.send(new DeleteObjectCommand({ Bucket: this.publicBucket, Key: k }))
    ))
  }

  publicUrl(key: string): string {
    return `${this.cdnUrl}/${key}`
  }

  async getStorageInfo(): Promise<StorageInfo> {
    return { backend: 'r2' }
  }
}
