<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from '@/plugins/i18n'
import { useUploadStore } from '@/stores/upload'
import { useToast } from '@/composables/useToast'
import BaseButton from '@/components/ui/BaseButton.vue'

const { t } = useI18n()
const props = defineProps<{ albumId: string }>()
const emit = defineEmits<{ uploaded: [] }>()

const store = useUploadStore()
const toast = useToast()
const fileInput = ref<HTMLInputElement>()
const dragging = ref(false)

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

  const { useUpload } = await import('@/composables/useUpload')
  const { uploadFiles } = useUpload()
  const successCount = await uploadFiles(validFiles, props.albumId)
  if (successCount > 0) emit('uploaded')
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

const { summary } = store
const showSummary = computed(() => store.files.length > 1)
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

    <!-- Drop zone -->
    <div
      :class="[
        'border-2 border-dashed rounded-xl p-4 sm:p-6 md:p-8 text-center transition-colors cursor-pointer',
        dragging ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-orange-400',
      ]"
      @click="openPicker"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <svg class="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{{ $t('upload.dropzone') }} <span class="text-orange-500 font-medium">{{ $t('upload.selectFile') }}</span></p>
      <p class="text-[10px] sm:text-xs text-gray-400 mt-1">{{ $t('upload.hint') }}</p>
    </div>

    <!-- Batch summary bar -->
    <div v-if="showSummary && summary.total > 0" class="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 sm:px-4 py-2 sm:py-3">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-2">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ $t('upload.progress', { done: summary.done, total: summary.total }) }}
        </span>
        <div class="flex items-center gap-3 text-xs">
          <span v-if="summary.uploading > 0" class="text-orange-600">{{ $t('upload.countUploading', { n: summary.uploading }) }}</span>
          <span v-if="summary.processing > 0" class="text-blue-600">{{ $t('upload.countProcessing', { n: summary.processing }) }}</span>
          <span v-if="summary.ready > 0" class="text-green-600">{{ $t('upload.countSuccess', { n: summary.ready }) }}</span>
          <span v-if="summary.failed > 0" class="text-red-600">{{ $t('upload.countFailed', { n: summary.failed }) }}</span>
        </div>
      </div>
      <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
        <div class="h-full bg-green-500 transition-all duration-300" :style="{ width: `${(summary.ready / summary.total) * 100}%` }" />
        <div class="h-full bg-red-500 transition-all duration-300" :style="{ width: `${(summary.failed / summary.total) * 100}%` }" />
        <div class="h-full bg-orange-500 transition-all duration-300" :style="{ width: `${(summary.active / summary.total) * 100}%` }" />
      </div>
    </div>

    <!-- File progress list (max 5 visible) -->
    <div v-if="store.visibleFiles.length > 0" class="mt-3 space-y-1.5">
      <div
        v-for="f in store.visibleFiles"
        :key="f.id"
        class="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">{{ f.name }}</p>
            <span :class="['text-xs whitespace-nowrap', f.status === 'failed' ? 'text-red-500 font-medium' : 'text-gray-500']">
              {{ fileStatusText(f) }}
            </span>
          </div>
          <div class="h-1 bg-gray-200 rounded-full overflow-hidden mt-1">
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
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Hidden files indicator -->
      <p v-if="store.hiddenCount > 0" class="text-xs text-gray-400 text-center py-1">
        {{ $t('upload.hiddenFiles', { n: store.hiddenCount }) }}
      </p>
    </div>

    <!-- Clear button -->
    <div v-if="summary.done > 0 && summary.active === 0" class="flex justify-end mt-2">
      <BaseButton variant="ghost" size="sm" @click="store.clear()">{{ $t('upload.clearList') }}</BaseButton>
    </div>
  </div>
</template>
