import { useUploadStore } from '@/stores/upload'
import { useToast } from '@/composables/useToast'
import api from '@/utils/api'

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB — must match backend max_upload_size_mb setting
const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB — smaller chunks = smoother progress
const MAX_CONCURRENT_CHUNKS = 3 // parallel chunk uploads per file
const MAX_CONCURRENT_FILES = 2 // parallel file uploads

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

      // Track progress per chunk for smooth updates
      const chunkProgress = new Array(totalParts).fill(0)
      const startTime = Date.now()

      function updateProgress() {
        const totalLoaded = chunkProgress.reduce((a, b) => a + b, 0)
        const percent = (totalLoaded / file.size) * 100
        const elapsed = (Date.now() - startTime) / 1000
        const speed = elapsed > 0 ? totalLoaded / elapsed : 0
        store.setProgress(localId, percent, speed)
      }

      // Upload chunks with concurrency limit
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

      // Launch concurrent chunk uploaders
      const workers = Array.from(
        { length: Math.min(MAX_CONCURRENT_CHUNKS, totalParts) },
        () => uploadNextChunk(),
      )
      await Promise.all(workers)

      // Sort parts by number (parallel upload may complete out of order)
      completedParts.sort((a, b) => a.PartNumber - b.PartNumber)

      store.setStatus(localId, 'processing')
      await api.post('/images/complete', {
        imageId: data.imageId,
        uploadId: data.uploadId,
        key: data.key,
        parts: completedParts,
      })

      store.setStatus(localId, 'processing', data.imageId)
      toast.success(`"${file.name}" — upload thành công, đang xử lý ảnh...`)
      return true
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response
      const errMsg = resp?.data?.message || (err instanceof Error ? err.message : 'Lỗi upload')
      console.error(`[Upload] Failed: ${file.name}`, { error: errMsg, status: resp?.status })
      store.setStatus(localId, 'failed')
      toast.error(`"${file.name}" — ${errMsg}`)
      return false
    }
  }

  async function uploadFiles(files: File[], albumId: string): Promise<number> {
    // Validate all files first
    const validFiles = files.filter(f => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`"${f.name}" vượt quá giới hạn 200MB`)
        return false
      }
      if (f.size === 0) {
        toast.error(`"${f.name}" — file rỗng`)
        return false
      }
      return true
    })
    if (!validFiles.length) return 0

    // Upload files with concurrency limit
    let nextFile = 0
    let successCount = 0

    async function uploadNextFile(): Promise<void> {
      while (nextFile < validFiles.length) {
        const file = validFiles[nextFile++]
        const ok = await uploadSingleFile(file, albumId)
        if (ok) successCount++
      }
    }

    const fileWorkers = Array.from(
      { length: Math.min(MAX_CONCURRENT_FILES, validFiles.length) },
      () => uploadNextFile(),
    )
    await Promise.all(fileWorkers)

    if (validFiles.length > 1) {
      toast.info(`Upload hoàn tất: ${successCount}/${validFiles.length} ảnh thành công`)
    }
    return successCount
  }

  return { uploadFiles }
}
