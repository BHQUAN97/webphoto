import { useUploadStore } from '@/stores/upload'
import { useToast } from '@/composables/useToast'
import api from '@/utils/api'

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB — must match backend max_upload_size_mb setting

interface UploadUrlResponse {
  imageId: string
  uploadId: string
  key: string
  mode: 'direct'
  totalParts: number
  chunkSize: number
}

export function useUpload() {
  const store = useUploadStore()
  const toast = useToast()

  async function uploadFiles(files: File[], albumId: string) {
    for (const file of files) {
      // Safety-net validation (primary validation is in ImageUploader)
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" vượt quá giới hạn 200MB`)
        continue
      }
      if (file.size === 0) {
        toast.error(`"${file.name}" — file rỗng`)
        continue
      }

      const localId = crypto.randomUUID()
      store.add({ id: localId, name: file.name, progress: 0, status: 'uploading' })

      try {
        console.log(`[Upload] Starting: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB, type=${file.type})`)
        const { data } = await api.post<UploadUrlResponse>('/images/upload-url', {
          filename: file.name,
          size: file.size,
          albumId,
          mimeType: file.type || 'application/octet-stream',
        })
        console.log(`[Upload] Got upload URL:`, { imageId: data.imageId, totalParts: data.totalParts })

        const completedParts: { ETag: string; PartNumber: number }[] = []
        let uploadedBytes = 0

        // All uploads go through server — no presigned URLs exposed to client
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

        console.log(`[Upload] All chunks uploaded, completing...`)
        store.setStatus(localId, 'processing')
        await api.post('/images/complete', {
          imageId: data.imageId,
          uploadId: data.uploadId,
          key: data.key,
          parts: completedParts,
        })

        console.log(`[Upload] Complete! imageId=${data.imageId}, waiting for processing...`)
        store.setStatus(localId, 'processing', data.imageId)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const resp = (err as { response?: { status?: number; data?: unknown } })?.response
        console.error(`[Upload] Failed: ${file.name}`, { error: msg, status: resp?.status, data: resp?.data })
        store.setStatus(localId, 'failed')
      }
    }
  }

  return { uploadFiles }
}
