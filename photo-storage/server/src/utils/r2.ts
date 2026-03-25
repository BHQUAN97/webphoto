import {
  S3Client, GetObjectCommand, DeleteObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Readable } from 'stream'

const cfg = {
  region: 'auto' as const,
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
}

const r2Private = new S3Client(cfg)
const r2Public  = new S3Client(cfg)

export const r2 = {
  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const res = await r2Private.send(new CreateMultipartUploadCommand({
      Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key, ContentType: contentType,
    }))
    return res.UploadId!
  },

  async presignPart(key: string, uploadId: string, partNumber: number, expiresIn = 3600): Promise<string> {
    return getSignedUrl(r2Private, new UploadPartCommand({
      Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key,
      UploadId: uploadId, PartNumber: partNumber,
    }), { expiresIn })
  },

  async completeMultipart(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[]): Promise<void> {
    await r2Private.send(new CompleteMultipartUploadCommand({
      Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key, UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }))
  },

  async abortMultipart(key: string, uploadId: string): Promise<void> {
    await r2Private.send(new AbortMultipartUploadCommand({
      Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key, UploadId: uploadId,
    }))
  },

  async downloadUrl(key: string, filename: string, expiresIn = 900): Promise<string> {
    return getSignedUrl(r2Private,
      new GetObjectCommand({
        Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
      }), { expiresIn })
  },

  async getStream(key: string): Promise<Readable> {
    const res = await r2Private.send(new GetObjectCommand({
      Bucket: process.env.R2_PRIVATE_BUCKET!, Key: key,
    }))
    return res.Body as Readable
  },

  async presignUpload(key: string, contentType: string, expiresIn = 600): Promise<string> {
    return getSignedUrl(r2Public, new PutObjectCommand({
      Bucket: process.env.R2_PUBLIC_BUCKET!, Key: key,
      ContentType: contentType, CacheControl: 'public, max-age=2592000',
    }), { expiresIn })
  },

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await r2Public.send(new PutObjectCommand({
      Bucket: process.env.R2_PUBLIC_BUCKET!, Key: key, Body: buffer,
      ContentType: contentType, CacheControl: 'public, max-age=2592000',
    }))
  },

  async deletePrivate(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k =>
      r2Private.send(new DeleteObjectCommand({ Bucket: process.env.R2_PRIVATE_BUCKET!, Key: k }))
    ))
  },
  async deletePublic(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k =>
      r2Public.send(new DeleteObjectCommand({ Bucket: process.env.R2_PUBLIC_BUCKET!, Key: k }))
    ))
  },

  publicUrl(key: string): string {
    return `${process.env.CDN_URL}/${key}`
  },
}
