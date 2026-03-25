<script setup lang="ts">
import { ref } from 'vue'
import { useUploadStore } from '@/stores/upload'
import { useToast } from '@/composables/useToast'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = defineProps<{ albumId: string }>()
const emit = defineEmits<{ uploaded: [] }>()

const store = useUploadStore()
const toast = useToast()
const fileInput = ref<HTMLInputElement>()
const dragging = ref(false)

const ACCEPTED = '.cr2,.arw,.nef,.dng,.jpg,.jpeg,.png,.tiff,.tif'

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

const ALLOWED_EXTENSIONS = new Set(['.cr2', '.arw', '.nef', '.dng', '.jpg', '.jpeg', '.png', '.tiff', '.tif'])

async function handleFiles(files: File[]) {
  // Client-side extension validation (size validated in useUpload)
  const validFiles = files.filter(f => {
    const ext = f.name.lastIndexOf('.') >= 0 ? f.name.slice(f.name.lastIndexOf('.')).toLowerCase() : ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      toast.error(`"${f.name}" — định dạng không được hỗ trợ`)
      return false
    }
    return true
  })
  if (!validFiles.length) return

  toast.info(`Bắt đầu upload ${validFiles.length} ảnh...`)

  const { useUpload } = await import('@/composables/useUpload')
  const { uploadFiles } = useUpload()
  const successCount = await uploadFiles(validFiles, props.albumId)
  if (successCount > 0) emit('uploaded')
}

const statusLabel: Record<string, string> = {
  uploading: 'Đang upload',
  processing: 'Đang xử lý...',
  ready: 'Hoàn tất',
  failed: 'Lỗi',
}

const statusColor: Record<string, string> = {
  uploading: 'bg-orange-500',
  processing: 'bg-yellow-500',
  ready: 'bg-green-500',
  failed: 'bg-red-500',
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
  return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
}

function uploadInfo(f: { progress: number; speed?: number; status: string }): string {
  if (f.status !== 'uploading') return statusLabel[f.status] ?? f.status
  const pct = `${f.progress}%`
  if (!f.speed || f.speed < 1024) return pct
  return `${pct} · ${formatSpeed(f.speed)}`
}
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
        'border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-colors cursor-pointer',
        dragging ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-orange-400',
      ]"
      @click="openPicker"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <svg class="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p class="text-sm text-gray-600 dark:text-gray-300">Kéo thả ảnh hoặc <span class="text-orange-500 font-medium">chọn file</span></p>
      <p class="text-xs text-gray-400 mt-1">CR2, ARW, NEF, DNG, JPEG, PNG, TIFF — tối đa 200MB/file</p>
    </div>

    <!-- Upload progress list -->
    <div v-if="store.files.length > 0" class="mt-4 space-y-2">
      <div
        v-for="f in store.files"
        :key="f.id"
        class="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ f.name }}</p>
          <div class="flex items-center gap-2 mt-1">
            <div class="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                :class="['h-full rounded-full transition-all duration-300', statusColor[f.status]]"
                :style="{ width: `${f.status === 'ready' || f.status === 'failed' ? 100 : f.progress}%` }"
              />
            </div>
            <span class="text-xs text-gray-500 whitespace-nowrap">{{ uploadInfo(f) }}</span>
          </div>
        </div>
        <button
          v-if="f.status === 'ready' || f.status === 'failed'"
          class="text-gray-400 hover:text-gray-600"
          @click="store.remove(f.id)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="flex justify-end">
        <BaseButton variant="ghost" size="sm" @click="store.clear()">Xóa đã hoàn tất</BaseButton>
      </div>
    </div>
  </div>
</template>
