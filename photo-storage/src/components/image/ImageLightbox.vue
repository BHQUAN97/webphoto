<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { ImageItem } from '@/types'
import { cdnUrl, formatBytes, formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import CommentList from './CommentList.vue'

interface Props {
  image: ImageItem | null
  show: boolean
  canDelete?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: []; like: [image: ImageItem]; delete: [image: ImageItem] }>()

const auth = useAuthStore()
const downloading = ref(false)

async function handleDownload() {
  if (!props.image || !auth.canDownload) return
  downloading.value = true
  try {
    const res = await api.get(`/images/${props.image.id}/download-url`)
    window.open(res.data.url, '_blank')
  } catch {
    alert('Không thể tải ảnh')
  } finally {
    downloading.value = false
  }
}

watch(() => props.show, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show && image"
        class="fixed inset-0 z-50 flex bg-black/90"
        @click.self="emit('close')"
      >
        <!-- Close button -->
        <button class="absolute top-4 right-4 text-white/70 hover:text-white z-10" @click="emit('close')">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Image -->
        <div class="flex-1 flex items-center justify-center p-8">
          <img
            v-if="image.previewKey"
            :src="cdnUrl(image.previewKey)"
            class="max-w-full max-h-full object-contain"
            :alt="image.originalName"
          />
          <div v-else class="text-white/50 text-center">
            <p>Preview chưa sẵn sàng</p>
          </div>
        </div>

        <!-- Sidebar info -->
        <div class="w-80 bg-white dark:bg-gray-800 h-full overflow-y-auto flex flex-col">
          <div class="p-4 border-b border-gray-100">
            <h3 class="font-semibold text-gray-900 dark:text-white truncate">{{ image.originalName }}</h3>
            <div class="text-xs text-gray-500 mt-2 space-y-1">
              <p>Dung lượng: {{ formatBytes(image.originalSize) }}</p>
              <p v-if="image.width && image.height">Kích thước: {{ image.width }} x {{ image.height }}</p>
              <p>Ngày tải: {{ formatDate(image.createdAt) }}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-4 border-b border-gray-100 flex gap-2">
            <button
              class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors"
              :class="image.liked ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'"
              @click="emit('like', image)"
            >
              <svg class="w-4 h-4" :fill="image.liked ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {{ image.likeCount }}
            </button>
            <button
              v-if="auth.canDownload"
              class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-50 text-gray-600 hover:bg-gray-100"
              :disabled="downloading"
              @click="handleDownload"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Tải gốc
            </button>
            <button
              v-if="canDelete && image"
              class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100"
              @click="emit('delete', image)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Xóa
            </button>
          </div>

          <!-- Comments -->
          <div class="flex-1 p-4">
            <CommentList :image-id="image.id" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
