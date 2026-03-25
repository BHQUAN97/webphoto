import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UploadFile, UploadFileStatus } from '@/types'

export const useUploadStore = defineStore('upload', () => {
  const files = ref<UploadFile[]>([])

  // Batch summary — computed from files
  const summary = computed(() => {
    const total = files.value.length
    const uploading = files.value.filter(f => f.status === 'uploading').length
    const processing = files.value.filter(f => f.status === 'processing').length
    const ready = files.value.filter(f => f.status === 'ready').length
    const failed = files.value.filter(f => f.status === 'failed').length
    const done = ready + failed
    const active = uploading + processing
    return { total, uploading, processing, ready, failed, done, active }
  })

  function add(file: UploadFile) {
    files.value.push(file)
  }

  function setProgress(id: string, progress: number, speed?: number) {
    const f = files.value.find((f) => f.id === id)
    if (f) {
      f.progress = Math.min(100, Math.round(progress))
      if (speed !== undefined) f.speed = speed
    }
  }

  function setStatus(id: string, status: UploadFileStatus, imageId?: string) {
    const f = files.value.find((f) => f.id === id)
    if (f) {
      f.status = status
      if (imageId) f.imageId = imageId
    }
  }

  function remove(id: string) {
    files.value = files.value.filter((f) => f.id !== id)
  }

  function clear() {
    files.value = files.value.filter((f) => f.status === 'uploading' || f.status === 'processing')
  }

  return { files, summary, add, setProgress, setStatus, remove, clear }
})
