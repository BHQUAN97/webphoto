<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImageItem } from '@/types'
import { formatBytes } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import CommentList from './CommentList.vue'

const { t } = useI18n()

interface Props {
  image: ImageItem | null
  images?: ImageItem[]
  currentIndex?: number
  show: boolean
  canDelete?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  images: () => [],
  currentIndex: 0,
  canDelete: false,
})
const emit = defineEmits<{
  close: []
  like: [image: ImageItem]
  delete: [image: ImageItem]
  navigate: [index: number]
}>()

const auth = useAuthStore()
const downloading = ref(false)
const zoomLevel = ref(1)
const showComments = ref(false)

const canGoPrev = computed(() => props.currentIndex > 0)
const canGoNext = computed(() => props.currentIndex < props.images.length - 1)

function goNext() {
  if (canGoNext.value) {
    resetZoom()
    emit('navigate', props.currentIndex + 1)
  }
}

function goPrev() {
  if (canGoPrev.value) {
    resetZoom()
    emit('navigate', props.currentIndex - 1)
  }
}

function zoomIn() {
  if (zoomLevel.value < 3) zoomLevel.value = Math.min(zoomLevel.value + 1, 3)
}

function zoomOut() {
  if (zoomLevel.value > 1) zoomLevel.value = Math.max(zoomLevel.value - 1, 1)
}

function resetZoom() {
  zoomLevel.value = 1
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

function handleDoubleClick() {
  resetZoom()
}

async function handleDownload() {
  if (!props.image || !auth.canDownload) return
  downloading.value = true
  try {
    const res = await api.get(`/images/${props.image.id}/download-url`)
    window.open(res.data.url, '_blank')
  } catch {
    alert(t('image.downloadFailed'))
  } finally {
    downloading.value = false
  }
}

// Reset state when lightbox opens/closes or image changes
watch(() => props.show, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
  if (!val) {
    resetZoom()
    showComments.value = false
  }
})

watch(() => props.image, () => {
  resetZoom()
})

function onKeydown(e: KeyboardEvent) {
  if (!props.show) return
  switch (e.key) {
    case 'Escape':
      emit('close')
      break
    case 'ArrowLeft':
      e.preventDefault()
      goPrev()
      break
    case 'ArrowRight':
      e.preventDefault()
      goNext()
      break
    case '+':
    case '=':
      e.preventDefault()
      zoomIn()
      break
    case '-':
      e.preventDefault()
      zoomOut()
      break
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
        class="fixed inset-0 z-50 flex flex-col bg-black/95"
      >
        <!-- Close button — top-right, always visible -->
        <button
          class="absolute top-4 right-4 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          :title="t('common.close')"
          @click="emit('close')"
        >
          <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Image counter -->
        <div
          v-if="images.length > 1"
          class="absolute top-4 left-4 z-30 px-3 py-1.5 rounded-full bg-black/60 text-white text-sm select-none"
        >
          {{ currentIndex + 1 }} / {{ images.length }}
        </div>

        <!-- Main content area -->
        <div class="flex-1 flex min-h-0 relative">
          <!-- Previous button -->
          <button
            v-if="images.length > 1"
            class="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 text-white transition-all"
            :class="canGoPrev ? 'hover:bg-black/70 cursor-pointer' : 'opacity-30 cursor-not-allowed'"
            :disabled="!canGoPrev"
            @click="goPrev"
          >
            <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <!-- Image viewport -->
          <div
            class="flex-1 flex items-center justify-center overflow-hidden"
            @wheel.prevent="handleWheel"
            @dblclick="handleDoubleClick"
            @click.self="emit('close')"
          >
            <img
              v-if="image.previewUrl || image.previewKey"
              :src="image.previewUrl || image.previewKey || ''"
              class="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
              :style="{ transform: `scale(${zoomLevel})` }"
              :alt="image.originalName"
              draggable="false"
            />
            <div v-else class="text-white/50 text-center">
              <svg class="w-12 h-12 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p>{{ t('image.status.processing') }}</p>
            </div>
          </div>

          <!-- Next button -->
          <button
            v-if="images.length > 1"
            class="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 text-white transition-all"
            :class="canGoNext ? 'hover:bg-black/70 cursor-pointer' : 'opacity-30 cursor-not-allowed'"
            :disabled="!canGoNext"
            @click="goNext"
          >
            <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <!-- Comment sidebar -->
          <Transition
            enter-active-class="transition-transform duration-300 ease-out"
            leave-active-class="transition-transform duration-200 ease-in"
            enter-from-class="translate-x-full"
            leave-to-class="translate-x-full"
          >
            <div
              v-if="showComments"
              class="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-gray-800 shadow-xl z-20 flex flex-col"
            >
              <div class="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 class="font-semibold text-gray-900 dark:text-white text-sm">
                  {{ t('image.comments') }} ({{ image.commentCount }})
                </h3>
                <button
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  @click="showComments = false"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div class="flex-1 overflow-y-auto p-4">
                <CommentList :image-id="image.id" />
              </div>
            </div>
          </Transition>
        </div>

        <!-- Bottom toolbar — icon only -->
        <div class="shrink-0 flex items-center justify-center gap-1 py-3 px-4 bg-black/70">
          <!-- Like -->
          <button
            class="w-10 h-10 flex items-center justify-center rounded-full transition-colors"
            :class="image.liked ? 'text-red-500 bg-red-500/20' : 'text-white/70 hover:text-white hover:bg-white/10'"
            :title="t('image.like')"
            @click="emit('like', image)"
          >
            <svg class="w-5 h-5" :fill="image.liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          <!-- Download -->
          <button
            v-if="auth.canDownload"
            class="w-10 h-10 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            :class="{ 'opacity-50 cursor-not-allowed': downloading }"
            :disabled="downloading"
            :title="t('image.download')"
            @click="handleDownload"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <!-- Delete -->
          <button
            v-if="canDelete && image"
            class="w-10 h-10 flex items-center justify-center rounded-full text-white/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            :title="t('common.delete')"
            @click="emit('delete', image)"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <!-- Separator -->
          <div class="w-px h-6 bg-white/20 mx-1"></div>

          <!-- Zoom out -->
          <button
            class="w-10 h-10 flex items-center justify-center rounded-full transition-colors"
            :class="zoomLevel > 1 ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-white/30 cursor-not-allowed'"
            :disabled="zoomLevel <= 1"
            :title="t('image.zoomOut')"
            @click="zoomOut"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>

          <!-- Zoom level indicator -->
          <span class="text-white/50 text-xs w-8 text-center select-none">{{ zoomLevel }}x</span>

          <!-- Zoom in -->
          <button
            class="w-10 h-10 flex items-center justify-center rounded-full transition-colors"
            :class="zoomLevel < 3 ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-white/30 cursor-not-allowed'"
            :disabled="zoomLevel >= 3"
            :title="t('image.zoomIn')"
            @click="zoomIn"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>

          <!-- Separator -->
          <div class="w-px h-6 bg-white/20 mx-1"></div>

          <!-- Comments toggle -->
          <button
            class="w-10 h-10 flex items-center justify-center rounded-full transition-colors"
            :class="showComments ? 'text-blue-400 bg-blue-500/20' : 'text-white/70 hover:text-white hover:bg-white/10'"
            :title="t('image.comments')"
            @click="showComments = !showComments"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>

          <!-- Image info -->
          <div class="w-px h-6 bg-white/20 mx-1"></div>
          <div class="text-white/40 text-xs truncate max-w-[200px] select-none hidden sm:block">
            {{ image.originalName }} &middot; {{ formatBytes(image.originalSize) }}
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
