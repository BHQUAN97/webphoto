import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UploadFile, UploadFileStatus } from '@/types'

export const useUploadStore = defineStore('upload', () => {
  const files = ref<UploadFile[]>([])

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

  return { files, add, setProgress, setStatus, remove, clear }
})
