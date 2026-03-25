import { useUploadStore } from '@/stores/upload'
import api from '@/utils/api'

interface UploadUrlResponse {
  imageId: string
  uploadId: string
  key: string
  mode: 'presigned' | 'direct'
  partUrls?: string[]
  totalParts?: number
  chunkSize?: number
}

export function useUpload() {
  const store = useUploadStore()

  async function uploadFiles(files: File[], albumId: string) {
    for (const file of files) {
      const localId = crypto.randomUUID()
      store.add({ id: localId, name: file.name, progress: 0, status: 'uploading' })

      try {
        const { data } = await api.post<UploadUrlResponse>('/images/upload-url', {
          filename: file.name,
          size: file.size,
          albumId,
          mimeType: file.type || 'application/octet-stream',
        })

        const completedParts: { ETag: string; PartNumber: number }[] = []
        let uploadedBytes = 0

        if (data.mode === 'presigned' && data.partUrls) {
          // R2 mode — PUT chunks directly to presigned URLs
          const CHUNK = 10 * 1024 * 1024
          for (let i = 0; i < data.partUrls.length; i++) {
            const start = i * CHUNK
            const end = Math.min(start + CHUNK, file.size)
            const chunk = file.slice(start, end)

            const res = await fetch(data.partUrls[i], { method: 'PUT', body: chunk })
            const etag = res.headers.get('ETag') ?? ''
            completedParts.push({ ETag: etag, PartNumber: i + 1 })

            uploadedBytes += (end - start)
            store.setProgress(localId, (uploadedBytes / file.size) * 100)
          }
        } else {
          // Local mode — POST chunks to server
          const chunkSize = data.chunkSize || 10 * 1024 * 1024
          const totalParts = data.totalParts || Math.ceil(file.size / chunkSize)

          for (let i = 0; i < totalParts; i++) {
            const start = i * chunkSize
            const end = Math.min(start + chunkSize, file.size)
            const chunk = file.slice(start, end)

            const res = await api.post(
              `/storage/upload-chunk?key=${encodeURIComponent(data.key)}&uploadId=${encodeURIComponent(data.uploadId)}&partNumber=${i + 1}`,
              chunk,
              { headers: { 'Content-Type': 'application/octet-stream' } },
            )
            completedParts.push({ ETag: res.data.ETag, PartNumber: res.data.PartNumber })

            uploadedBytes += (end - start)
            store.setProgress(localId, (uploadedBytes / file.size) * 100)
          }
        }

        store.setStatus(localId, 'processing')
        await api.post('/images/complete', {
          imageId: data.imageId,
          uploadId: data.uploadId,
          key: data.key,
          parts: completedParts,
        })

        store.setStatus(localId, 'processing', data.imageId)
      } catch {
        store.setStatus(localId, 'failed')
      }
    }
  }

  return { uploadFiles }
}
