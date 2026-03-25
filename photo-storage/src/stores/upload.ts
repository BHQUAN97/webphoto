import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UploadFile, UploadFileStatus } from '@/types'

const MAX_VISIBLE = 5

export const useUploadStore = defineStore('upload', () => {
  const files = ref<UploadFile[]>([])

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

  // Hard limit: max 5 items. Priority: most recent active first, then recent done
  const visibleFiles = computed(() => {
    const active = files.value.filter(f => f.status === 'uploading' || f.status === 'processing')
    const done = files.value.filter(f => f.status === 'ready' || f.status === 'failed')

    // Take most recent active (up to MAX_VISIBLE)
    const shownActive = active.slice(-MAX_VISIBLE)
    // Fill remaining with most recent done
    const remaining = Math.max(0, MAX_VISIBLE - shownActive.length)
    const shownDone = remaining > 0 ? done.slice(-remaining) : []

    return [...shownActive, ...shownDone]
  })

  // How many files are hidden (not shown in visibleFiles)
  const hiddenCount = computed(() => Math.max(0, files.value.length - visibleFiles.value.length))

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

  return { files, visibleFiles, hiddenCount, summary, add, setProgress, setStatus, remove, clear }
})
