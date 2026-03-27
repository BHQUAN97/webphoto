<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from '@/plugins/i18n'
import { useUploadStore } from '@/stores/upload'
import { useToast } from '@/composables/useToast'
// BaseButton removed — using native buttons for compact upload UI

const { t } = useI18n()
const props = defineProps<{ albumId: string }>()
const emit = defineEmits<{ uploaded: [] }>()

const store = useUploadStore()
const toast = useToast()
const fileInput = ref<HTMLInputElement>()
const dragging = ref(false)
const collapsed = ref(false)

const ACCEPTED = '.cr2,.arw,.nef,.dng,.jpg,.jpeg,.png,.tiff,.tif'
const ALLOWED_EXTENSIONS = new Set(['.cr2', '.arw', '.nef', '.dng', '.jpg', '.jpeg', '.png', '.tiff', '.tif'])

function openPicker() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    handleFiles(Array.from(input.files))
    input.value = ''
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) handleFiles(files)
}

const ZIP_THRESHOLD = 50 // Auto-ZIP when selecting more than this many files
const ZIP_BATCH_MAX_SIZE = 400 * 1024 * 1024 // 400MB per ZIP batch

async function handleFiles(files: File[]) {
  const validFiles = files.filter(f => {
    const ext = f.name.lastIndexOf('.') >= 0 ? f.name.slice(f.name.lastIndexOf('.')).toLowerCase() : ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      toast.error(t('upload.unsupported', { name: f.name }))
      return false
    }
    return true
  })
  if (!validFiles.length) return

  collapsed.value = false

  // For large batches, use ZIP upload for better performance
  if (validFiles.length >= ZIP_THRESHOLD) {
    await handleZipBatchUpload(validFiles)
    return
  }

  const { useUpload } = await import('@/composables/useUpload')
  const { uploadFiles } = useUpload()
  const successCount = await uploadFiles(validFiles, props.albumId)
  if (successCount > 0) emit('uploaded')
}

// ZIP batch state for UI
const zipBatchInfo = ref({
  totalFiles: 0,
  totalBatches: 0,
  compressingBatch: 0,
  compressPercent: 0,
  uploadingBatch: 0,
  uploadPercent: 0,
  successCount: 0,
  failedCount: 0,
  skippedCount: 0,
})

async function handleZipBatchUpload(files: File[]) {
  const { default: JSZip } = await import('jszip')
  const { default: api } = await import('@/utils/api')

  zipUploading.value = true
  const totalFiles = files.length
  const info = zipBatchInfo.value
  info.totalFiles = totalFiles
  info.successCount = 0
  info.failedCount = 0
  info.skippedCount = 0

  // Split files into ZIP batches by size
  const batches: File[][] = []
  let currentBatch: File[] = []
  let currentSize = 0
  for (const f of files) {
    if (currentSize + f.size > ZIP_BATCH_MAX_SIZE && currentBatch.length > 0) {
      batches.push(currentBatch)
      currentBatch = []
      currentSize = 0
    }
    currentBatch.push(f)
    currentSize += f.size
  }
  if (currentBatch.length > 0) batches.push(currentBatch)
  info.totalBatches = batches.length

  // Parallel pipeline: compress continuously, upload up to 2 concurrently
  const MAX_CONCURRENT_UPLOADS = 2
  const activeUploads: Promise<void>[] = []

  async function compressBatch(batch: File[], idx: number): Promise<Blob> {
    info.compressingBatch = idx + 1
    info.compressPercent = 0
    const zip = new JSZip()
    for (const f of batch) zip.file(f.name, f)
    return zip.generateAsync(
      { type: 'blob', compression: 'STORE' },
      (meta) => { info.compressPercent = Math.round(meta.percent) },
    )
  }

  async function uploadBatch(blob: Blob, idx: number, fileCount: number): Promise<void> {
    info.uploadingBatch = Math.max(info.uploadingBatch, idx + 1)
    try {
      const res = await api.post(`/images/upload-zip?albumId=${props.albumId}`, blob, {
        headers: { 'Content-Type': 'application/zip' },
        timeout: 600000,
        onUploadProgress: (e) => {
          if (e.total) info.uploadPercent = Math.round((e.loaded / e.total) * 100)
        },
      })
      const d = res.data?.data ?? res.data
      info.successCount += d.success ?? 0
      info.skippedCount += d.skipped ?? 0
      info.failedCount += d.failed ?? 0
    } catch (err: any) {
      info.failedCount += fileCount
      toast.error(`Batch ${idx + 1} lỗi: ${err.response?.data?.message || 'Upload thất bại'}`)
    }
  }

  for (let i = 0; i < batches.length; i++) {
    // Compress batch (runs while uploads happen in parallel)
    const blob = await compressBatch(batches[i], i)
    // If max concurrent uploads reached, wait for one to finish
    if (activeUploads.length >= MAX_CONCURRENT_UPLOADS) {
      await Promise.race(activeUploads)
    }
    // Start upload, track it
    const uploadPromise = uploadBatch(blob, i, batches[i].length).then(() => {
      const idx = activeUploads.indexOf(uploadPromise)
      if (idx >= 0) activeUploads.splice(idx, 1)
    })
    activeUploads.push(uploadPromise)
  }
  // Wait for all remaining uploads
  await Promise.all(activeUploads)

  zipUploading.value = false
  toast.success(`Hoàn tất: ${info.successCount}/${totalFiles} ảnh (bỏ qua: ${info.skippedCount}, lỗi: ${info.failedCount})`)
  if (info.successCount > 0) emit('uploaded')
}

// ZIP upload
const zipInput = ref<HTMLInputElement>()
const zipUploading = ref(false)
const zipProgress = ref('')

function openZipPicker() {
  zipInput.value?.click()
}

async function onZipChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.zip')) {
    toast.error('Chỉ chấp nhận file .zip')
    return
  }
  if (file.size > 500 * 1024 * 1024) {
    toast.error('File ZIP tối đa 500MB')
    return
  }

  zipUploading.value = true
  zipProgress.value = 'Đang upload ZIP...'
  try {
    const { default: api } = await import('@/utils/api')
    const res = await api.post(`/images/upload-zip?albumId=${props.albumId}`, file, {
      headers: { 'Content-Type': 'application/zip' },
      timeout: 600000,
      onUploadProgress: (e) => {
        if (e.total) {
          const pct = Math.round((e.loaded / e.total) * 100)
          zipProgress.value = `Đang upload ZIP... ${pct}%`
        }
      },
    })
    const d = res.data?.data ?? res.data
    toast.success(`Đã xử lý ${d.success} ảnh từ ZIP (bỏ qua: ${d.skipped}, lỗi: ${d.failed})`)
    emit('uploaded')
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Upload ZIP thất bại')
  } finally {
    zipUploading.value = false
    zipProgress.value = ''
  }
}

// Status helpers
const statusColor: Record<string, string> = {
  uploading: 'bg-orange-500',
  processing: 'bg-blue-500',
  ready: 'bg-green-500',
  failed: 'bg-red-500',
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
  return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
}

function fileStatusText(f: { progress: number; speed?: number; status: string }): string {
  switch (f.status) {
    case 'uploading': {
      const pct = `${f.progress}%`
      return f.speed && f.speed > 1024 ? `${pct} · ${formatSpeed(f.speed)}` : pct
    }
    case 'processing': return t('upload.processing')
    case 'ready': return t('upload.done')
    case 'failed': return t('upload.failed')
    default: return f.status
  }
}

const hasFiles = computed(() => store.files.length > 0)
const allDone = computed(() => hasFiles.value && store.summary.active === 0)
const progressPercent = computed(() => {
  const s = store.summary
  return s.total > 0 ? Math.round((s.done / s.total) * 100) : 0
})

// Auto-clear completed files 5s after all done
watch(allDone, (done) => {
  if (done && store.summary.total > 0) {
    setTimeout(() => {
      // Only auto-clear if still all done (user might have started new upload)
      if (store.summary.active === 0 && store.files.length > 0) {
        store.clearAll()
      }
    }, 8000)
  }
})
</script>

<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      multiple
      :accept="ACCEPTED"
      class="hidden"
      @change="onFileChange"
    />

    <input
      ref="zipInput"
      type="file"
      accept=".zip"
      class="hidden"
      @change="onZipChange"
    />

    <!-- Drop zone -->
    <div
      :class="[
        'border-2 border-dashed rounded-xl p-4 sm:p-6 text-center transition-colors cursor-pointer',
        dragging ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-orange-400',
      ]"
      @click="openPicker"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <svg class="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{{ $t('upload.dropzone') }} <span class="text-orange-500 font-medium">{{ $t('upload.selectFile') }}</span></p>
      <p class="text-[10px] sm:text-xs text-gray-400 mt-1">{{ $t('upload.hint') }}</p>
      <button
        v-if="!zipUploading"
        class="mt-2 text-xs text-orange-500 hover:text-orange-600 underline"
        @click.stop="openZipPicker"
      >
        Hoặc upload file ZIP (tối đa 500MB)
      </button>
    </div>

    <!-- ZIP batch progress panel -->
    <div v-if="zipUploading" class="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800 overflow-hidden p-3 sm:p-4">
      <!-- Header: total + batch info -->
      <div class="flex items-center justify-between mb-1">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          ZIP Upload: {{ zipBatchInfo.successCount + zipBatchInfo.skippedCount + zipBatchInfo.failedCount }}/{{ zipBatchInfo.totalFiles }} ảnh
        </span>
        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">
          {{ zipBatchInfo.totalBatches > 1 ? `${zipBatchInfo.totalBatches} batch` : '' }}
        </span>
      </div>

      <!-- Overall progress bar (segmented: green=success, yellow=skipped, red=failed) -->
      <div class="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3 flex">
        <div class="h-full bg-green-500 transition-all duration-300" :style="{ width: `${(zipBatchInfo.successCount / Math.max(zipBatchInfo.totalFiles, 1)) * 100}%` }" />
        <div class="h-full bg-yellow-400 transition-all duration-300" :style="{ width: `${(zipBatchInfo.skippedCount / Math.max(zipBatchInfo.totalFiles, 1)) * 100}%` }" />
        <div class="h-full bg-red-500 transition-all duration-300" :style="{ width: `${(zipBatchInfo.failedCount / Math.max(zipBatchInfo.totalFiles, 1)) * 100}%` }" />
      </div>

      <!-- Step-by-step pipeline status -->
      <div class="space-y-2">
        <!-- Step: Compressing -->
        <div v-if="zipBatchInfo.compressingBatch > 0" class="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
          <svg class="w-4 h-4 animate-spin text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between text-xs mb-0.5">
              <span class="font-medium text-blue-700 dark:text-blue-300">Đang nén batch {{ zipBatchInfo.compressingBatch }}/{{ zipBatchInfo.totalBatches }}</span>
              <span class="text-blue-500 font-mono">{{ zipBatchInfo.compressPercent }}%</span>
            </div>
            <div class="h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 rounded-full transition-all duration-200" :style="{ width: `${zipBatchInfo.compressPercent}%` }" />
            </div>
          </div>
        </div>

        <!-- Step: Uploading -->
        <div v-if="zipBatchInfo.uploadingBatch > 0" class="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
          <svg class="w-4 h-4 animate-spin text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between text-xs mb-0.5">
              <span class="font-medium text-orange-700 dark:text-orange-300">Đang upload batch {{ zipBatchInfo.uploadingBatch }}/{{ zipBatchInfo.totalBatches }}</span>
              <span class="text-orange-500 font-mono">{{ zipBatchInfo.uploadPercent }}%</span>
            </div>
            <div class="h-1.5 bg-orange-200 dark:bg-orange-800 rounded-full overflow-hidden">
              <div class="h-full bg-orange-500 rounded-full transition-all duration-200" :style="{ width: `${zipBatchInfo.uploadPercent}%` }" />
            </div>
          </div>
        </div>
      </div>

      <!-- Result summary -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
        <span v-if="zipBatchInfo.successCount > 0" class="text-green-600 dark:text-green-400 font-medium">{{ zipBatchInfo.successCount }} thành công</span>
        <span v-if="zipBatchInfo.skippedCount > 0" class="text-yellow-600 dark:text-yellow-400">{{ zipBatchInfo.skippedCount }} bỏ qua</span>
        <span v-if="zipBatchInfo.failedCount > 0" class="text-red-500 font-medium">{{ zipBatchInfo.failedCount }} lỗi</span>
      </div>
    </div>

    <!-- Per-file upload progress panel -->
    <div v-if="hasFiles && !zipUploading" class="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <!-- Summary bar — always visible -->
      <div class="px-3 sm:px-4 py-2 sm:py-3">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {{ store.summary.done }}/{{ store.summary.selected || store.summary.total }} ảnh
            </span>
            <div class="flex items-center gap-2 text-xs flex-wrap">
              <span v-if="store.summary.uploading > 0" class="text-orange-600 whitespace-nowrap">
                {{ store.summary.uploading }} uploading
              </span>
              <span v-if="store.summary.processing > 0" class="text-blue-600 whitespace-nowrap">
                {{ store.summary.processing }} {{ $t('upload.processing').toLowerCase() }}
              </span>
              <span v-if="store.summary.ready > 0" class="text-green-600 whitespace-nowrap">
                {{ store.summary.ready }} {{ $t('upload.done').toLowerCase() }}
              </span>
              <span v-if="store.summary.failed > 0" class="text-red-600 whitespace-nowrap">
                {{ store.summary.failed }} {{ $t('upload.failed').toLowerCase() }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <!-- Collapse/expand toggle -->
            <button
              class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              :title="collapsed ? 'Mở rộng' : 'Thu gọn'"
              @click="collapsed = !collapsed"
            >
              <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': !collapsed }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <!-- Clear all button -->
            <button
              v-if="allDone"
              class="text-xs text-gray-400 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded"
              @click="store.clearAll()"
            >
              {{ $t('upload.clearList') }}
            </button>
          </div>
        </div>
        <!-- Progress bar -->
        <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
          <div class="h-full bg-green-500 transition-all duration-300" :style="{ width: `${(store.summary.ready / Math.max(store.summary.total, 1)) * 100}%` }" />
          <div class="h-full bg-red-500 transition-all duration-300" :style="{ width: `${(store.summary.failed / Math.max(store.summary.total, 1)) * 100}%` }" />
          <div class="h-full bg-orange-500 transition-all duration-300" :style="{ width: `${(store.summary.active / Math.max(store.summary.total, 1)) * 100}%` }" />
        </div>
        <div v-if="!allDone" class="text-[10px] text-gray-400 mt-1 text-right">{{ progressPercent }}%</div>
      </div>

      <!-- File list (collapsible, max 5 visible) -->
      <div v-if="!collapsed" class="border-t border-gray-200 dark:border-gray-700 px-3 sm:px-4 py-2 space-y-1.5">
        <div
          v-for="f in store.visibleFiles"
          :key="f.id"
          class="flex items-center gap-2"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-[11px] text-gray-600 dark:text-gray-400 truncate flex-1">{{ f.name }}</p>
              <span :class="['text-[11px] whitespace-nowrap', f.status === 'failed' ? 'text-red-500 font-medium' : 'text-gray-500']">
                {{ fileStatusText(f) }}
              </span>
            </div>
            <div class="h-1 bg-gray-200 rounded-full overflow-hidden mt-0.5">
              <div
                :class="['h-full rounded-full transition-all duration-300', statusColor[f.status]]"
                :style="{ width: `${f.status === 'ready' || f.status === 'failed' ? 100 : f.progress}%` }"
              />
            </div>
          </div>
          <button
            v-if="f.status === 'ready' || f.status === 'failed'"
            class="text-gray-400 hover:text-gray-600 shrink-0"
            @click="store.remove(f.id)"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Hidden files indicator -->
        <p v-if="store.hiddenCount > 0" class="text-[10px] text-gray-400 text-center">
          {{ $t('upload.hiddenFiles', { n: store.hiddenCount }) }}
        </p>
      </div>
    </div>
  </div>
</template>
