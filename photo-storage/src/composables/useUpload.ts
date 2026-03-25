import { useUploadStore } from '@/stores/upload'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'
import api from '@/utils/api'

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB
const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_CONCURRENT_CHUNKS = 3 // parallel chunks per file
const MAX_CONCURRENT_FILES = 5 // parallel file uploads

interface UploadUrlResponse {
  imageId: string
  uploadId: string
  key: string
  mode: 'direct'
  totalParts: number
  chunkSize: number
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function useUpload() {
  const store = useUploadStore()
  const toast = useToast()
  const { t } = useI18n()

  async function uploadSingleFile(file: File, albumId: string): Promise<boolean> {
    const localId = crypto.randomUUID()
    store.add({ id: localId, name: file.name, progress: 0, status: 'uploading', speed: 0 })

    try {
      const { data } = await api.post<UploadUrlResponse>('/images/upload-url', {
        filename: file.name,
        size: file.size,
        albumId,
        mimeType: file.type || 'application/octet-stream',
      })

      const chunkSize = data.chunkSize || CHUNK_SIZE
      const totalParts = data.totalParts || Math.ceil(file.size / chunkSize)
      const completedParts: { ETag: string; PartNumber: number }[] = []

      const chunkProgress = new Array(totalParts).fill(0)
      const startTime = Date.now()

      function updateProgress() {
        const totalLoaded = chunkProgress.reduce((a, b) => a + b, 0)
        const percent = (totalLoaded / file.size) * 100
        const elapsed = (Date.now() - startTime) / 1000
        const speed = elapsed > 0 ? totalLoaded / elapsed : 0
        store.setProgress(localId, percent, speed)
      }

      let nextPart = 0
      async function uploadNextChunk(): Promise<void> {
        while (nextPart < totalParts) {
          const i = nextPart++
          const start = i * chunkSize
          const end = Math.min(start + chunkSize, file.size)
          const chunk = file.slice(start, end)
          const chunkBytes = end - start

          const res = await api.post(
            `/storage/upload-chunk?key=${encodeURIComponent(data.key)}&uploadId=${encodeURIComponent(data.uploadId)}&partNumber=${i + 1}`,
            chunk,
            {
              headers: { 'Content-Type': 'application/octet-stream' },
              onUploadProgress: (e) => {
                chunkProgress[i] = Math.min(e.loaded ?? 0, chunkBytes)
                updateProgress()
              },
            },
          )
          chunkProgress[i] = chunkBytes
          updateProgress()
          completedParts.push({ ETag: res.data.ETag, PartNumber: res.data.PartNumber })
        }
      }

      const workers = Array.from(
        { length: Math.min(MAX_CONCURRENT_CHUNKS, totalParts) },
        () => uploadNextChunk(),
      )
      await Promise.all(workers)
      completedParts.sort((a, b) => a.PartNumber - b.PartNumber)

      store.setStatus(localId, 'processing')
      await api.post('/images/complete', {
        imageId: data.imageId,
        uploadId: data.uploadId,
        key: data.key,
        parts: completedParts,
      })

      store.setStatus(localId, 'processing', data.imageId)
      return true
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response
      const errMsg = resp?.data?.message || (err instanceof Error ? err.message : 'Lỗi upload')
      console.error(`[Upload] Failed: ${file.name}`, { error: errMsg, status: resp?.status })
      store.setStatus(localId, 'failed')
      return false
    }
  }

  async function uploadFiles(files: File[], albumId: string): Promise<number> {
    const validFiles = files.filter(f => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(t('upload.tooLarge', { name: f.name }))
        return false
      }
      if (f.size === 0) {
        toast.error(t('upload.emptyFile', { name: f.name }))
        return false
      }
      return true
    })
    if (!validFiles.length) return 0

    const totalFiles = validFiles.length
    let nextFile = 0
    let successCount = 0
    let failCount = 0

    async function uploadNextFile(): Promise<void> {
      while (nextFile < validFiles.length) {
        const file = validFiles[nextFile++]
        const ok = await uploadSingleFile(file, albumId)
        if (ok) {
          successCount++
        } else {
          failCount++
        }
      }
    }

    const fileWorkers = Array.from(
      { length: Math.min(MAX_CONCURRENT_FILES, validFiles.length) },
      () => uploadNextFile(),
    )
    await Promise.all(fileWorkers)

    // Summary toast
    if (totalFiles === 1) {
      if (successCount === 1) {
        toast.success(t('upload.singleSuccess', { name: validFiles[0].name, size: formatSize(validFiles[0].size) }))
      } else {
        toast.error(t('upload.singleFailed', { name: validFiles[0].name }))
      }
    } else {
      if (failCount === 0) {
        toast.success(t('upload.batchSuccess', { success: successCount, total: totalFiles }))
      } else if (successCount === 0) {
        toast.error(t('upload.batchAllFailed', { total: totalFiles }))
      } else {
        toast.warning(t('upload.batchPartial', { success: successCount, failed: failCount, total: totalFiles }))
      }
    }

    return successCount
  }

  return { uploadFiles }
}
