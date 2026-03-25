import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UploadFile, UploadFileStatus } from '@/types'

const MAX_VISIBLE = 5 // max items shown in progress list

export const useUploadStore = defineStore('upload', () => {
  const files = ref<UploadFile[]>([])

  // Batch summary
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

  // Only show most recent items, prioritize active ones
  const visibleFiles = computed(() => {
    const active = files.value.filter(f => f.status === 'uploading' || f.status === 'processing')
    const done = files.value.filter(f => f.status === 'ready' || f.status === 'failed')
    // Show all active + fill remaining slots with most recent done
    const remaining = Math.max(0, MAX_VISIBLE - active.length)
    return [...active, ...done.slice(-remaining)]
  })

  function add(file: UploadFile) {
    files.value.push(file)
    // Auto-clean: remove old completed items beyond limit
    pruneOld()
  }

  function pruneOld() {
    const done = files.value.filter(f => f.status === 'ready' || f.status === 'failed')
    // Keep most recent MAX_VISIBLE done items, all active items are always kept
    if (done.length > MAX_VISIBLE) {
      const toRemove = new Set(done.slice(0, done.length - MAX_VISIBLE).map(f => f.id))
      files.value = files.value.filter(f => !toRemove.has(f.id))
    }
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
    // Auto-prune when items complete
    if (status === 'ready' || status === 'failed') {
      pruneOld()
    }
  }

  function remove(id: string) {
    files.value = files.value.filter((f) => f.id !== id)
  }

  function clear() {
    files.value = files.value.filter((f) => f.status === 'uploading' || f.status === 'processing')
  }

  return { files, visibleFiles, summary, add, setProgress, setStatus, remove, clear }
})
