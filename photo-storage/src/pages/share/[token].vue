<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from '@/plugins/i18n'
import { useRoute } from 'vue-router'
import api from '@/utils/api'
import { cdnUrl, formatBytes, timeAgo } from '@/utils/format'
import type { ImageItem } from '@/types'

const { t } = useI18n()
const route = useRoute()
const token = route.params.token as string

const album = ref<any>(null)
const images = ref<ImageItem[]>([])
const loading = ref(true)
const error = ref('')

// Share permissions
const permissions = ref({
  allowLike: true,
  allowComment: true,
  allowDownload: false,
})

// Lightbox state
const lightboxIndex = ref(0)
const lightboxOpen = ref(false)

// Filter state
const sortBy = ref('newest')
const searchQuery = ref('')

// Batch selection state
const batchMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const batchLoading = ref(false)

// Guest likes stored in localStorage
const guestLikes = ref<Set<string>>(new Set())

// Guest comment state
const guestName = ref('')
const guestCommentText = ref('')
const guestCommentPosting = ref(false)

// Comments for current lightbox image
const lightboxComments = ref<any[]>([])
const lightboxCommentsLoading = ref(false)

// Comment sidebar toggle
const showComments = ref(false)

// Download state
const downloadingImageId = ref<string | null>(null)

function loadGuestLikes() {
  try {
    const stored = localStorage.getItem(`share_likes_${token}`)
    if (stored) guestLikes.value = new Set(JSON.parse(stored))
  } catch { /* ignore */ }
}

function saveGuestLikes() {
  try {
    localStorage.setItem(`share_likes_${token}`, JSON.stringify([...guestLikes.value]))
  } catch { /* ignore */ }
}

function loadGuestName() {
  try {
    const stored = localStorage.getItem('share_guest_name')
    if (stored) guestName.value = stored
  } catch { /* ignore */ }
}

function saveGuestName() {
  try {
    localStorage.setItem('share_guest_name', guestName.value)
  } catch { /* ignore */ }
}

// Filtered + sorted images
const filteredImages = computed(() => {
  let list = [...images.value]

  // Search filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(img => img.originalName.toLowerCase().includes(q))
  }

  // Sort
  switch (sortBy.value) {
    case 'oldest':
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      break
    case 'most_liked':
      list.sort((a, b) => b.likeCount - a.likeCount)
      break
    case 'largest':
      list.sort((a, b) => parseInt(b.originalSize) - parseInt(a.originalSize))
      break
    default: // newest
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  // Apply guest like state
  return list.map(img => ({
    ...img,
    liked: guestLikes.value.has(img.id),
  }))
})

const lightboxImage = computed(() => filteredImages.value[lightboxIndex.value] ?? null)

function openLightbox(index: number) {
  if (batchMode.value) return
  lightboxIndex.value = index
  lightboxOpen.value = true
  document.body.style.overflow = 'hidden'
  fetchComments(filteredImages.value[index]?.id)
}

function closeLightbox() {
  lightboxOpen.value = false
  lightboxComments.value = []
  showComments.value = false
  document.body.style.overflow = ''
}

function navigateLightbox(index: number) {
  lightboxIndex.value = index
  fetchComments(filteredImages.value[index]?.id)
}

// Batch selection
function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
  selectedIds.value = new Set(selectedIds.value)
}

function selectAll() {
  if (selectedIds.value.size === filteredImages.value.length) selectedIds.value = new Set()
  else selectedIds.value = new Set(filteredImages.value.map(i => i.id))
}

function exitBatchMode() {
  batchMode.value = false
  selectedIds.value = new Set()
}

async function batchDownload() {
  if (selectedIds.value.size === 0 || !permissions.value.allowDownload) return
  batchLoading.value = true
  let done = 0
  try {
    const ids = [...selectedIds.value]
    for (const id of ids) {
      try {
        window.open(`/api/share/${token}/images/${id}/download`, '_blank')
        done++
        // Small delay to prevent popup blocker
        if (ids.length > 1) await new Promise(r => setTimeout(r, 500))
      } catch { /* skip failed */ }
    }
    if (done > 0) alert(`Đã tải ${done} ảnh`)
  } catch { /* ignore */ }
  finally { batchLoading.value = false }
}

async function fetchComments(imageId?: string) {
  if (!imageId || !permissions.value.allowComment) return
  lightboxCommentsLoading.value = true
  try {
    const res = await api.get(`/share/${token}/images/${imageId}/comments`)
    lightboxComments.value = res.data.comments ?? res.data.data ?? res.data ?? []
  } catch {
    lightboxComments.value = []
  } finally {
    lightboxCommentsLoading.value = false
  }
}

async function postGuestComment() {
  if (!lightboxImage.value || !guestCommentText.value.trim() || guestCommentPosting.value) return
  guestCommentPosting.value = true
  saveGuestName()
  try {
    const res = await api.post(`/share/${token}/images/${lightboxImage.value.id}/comments`, {
      guestName: guestName.value.trim() || 'Khách',
      content: guestCommentText.value.trim(),
    })
    lightboxComments.value.push(res.data)
    guestCommentText.value = ''
    // Update comment count on source image
    const img = images.value.find(i => i.id === lightboxImage.value!.id)
    if (img) img.commentCount++
  } catch {
    alert(t('comment.sendFailed'))
  } finally {
    guestCommentPosting.value = false
  }
}

async function handleLike(image: ImageItem) {
  if (!permissions.value.allowLike) return

  const id = image.id
  const isLiked = guestLikes.value.has(id)

  // Optimistic update
  if (isLiked) {
    guestLikes.value.delete(id)
  } else {
    guestLikes.value.add(id)
  }
  // Force reactivity
  guestLikes.value = new Set(guestLikes.value)
  saveGuestLikes()

  // Update like count in source images + album totalLikes
  const img = images.value.find(i => i.id === id)
  if (img) {
    img.likeCount += isLiked ? -1 : 1
  }
  if (album.value) {
    const current = Number(album.value.totalLikes ?? 0)
    album.value.totalLikes = Math.max(0, current + (isLiked ? -1 : 1))
  }

  // Call API (fire-and-forget, works for both guest and logged-in)
  try {
    if (isLiked) {
      await api.delete(`/share/${token}/images/${id}/like`)
    } else {
      await api.post(`/share/${token}/images/${id}/like`)
    }
  } catch {
    // Revert on error
    if (isLiked) {
      guestLikes.value.add(id)
    } else {
      guestLikes.value.delete(id)
    }
    guestLikes.value = new Set(guestLikes.value)
    saveGuestLikes()
    if (img) {
      img.likeCount += isLiked ? 1 : -1
    }
  }
}

// Pagination
const INITIAL_LIMIT = 30
const PAGE_SIZE = 20
const nextCursor = ref<string | undefined>(undefined)
const loadingMore = ref(false)
const hasMore = ref(true)
const totalImages = ref(0)
const scrollSentinel = ref<HTMLElement>()

// Guest liked count
const guestLikedCount = computed(() => guestLikes.value.size)

async function loadMore() {
  if (loadingMore.value || !hasMore.value || !nextCursor.value) return
  loadingMore.value = true
  try {
    const res = await api.get(`/share/${token}`, { params: { cursor: nextCursor.value, limit: PAGE_SIZE } })
    const newItems = (res.data.images ?? []).map((img: any) => ({
      ...img,
      liked: guestLikes.value.has(img.id),
    }))
    images.value = [...images.value, ...newItems]
    nextCursor.value = res.data.nextCursor
    hasMore.value = !!res.data.nextCursor
  } catch { /* ignore */ }
  finally { loadingMore.value = false }
}

async function handleDownload(image: ImageItem) {
  if (!permissions.value.allowDownload || downloadingImageId.value) return
  downloadingImageId.value = image.id
  try {
    window.open(`/api/share/${token}/images/${image.id}/download`, '_blank')
  } catch {
    alert(t('share.downloadFailed'))
  } finally {
    downloadingImageId.value = null
  }
}

// Keyboard shortcuts for lightbox
function onKeydown(e: KeyboardEvent) {
  if (!lightboxOpen.value) return
  switch (e.key) {
    case 'Escape':
      closeLightbox()
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (lightboxIndex.value > 0) navigateLightbox(lightboxIndex.value - 1)
      break
    case 'ArrowRight':
      e.preventDefault()
      if (lightboxIndex.value < filteredImages.value.length - 1) navigateLightbox(lightboxIndex.value + 1)
      break
  }
}

// Infinite scroll observer
let scrollObserver: IntersectionObserver | null = null

watch(scrollSentinel, (el) => {
  if (el && scrollObserver) scrollObserver.observe(el)
})
watch(hasMore, (val) => {
  if (!val && scrollObserver) scrollObserver.disconnect()
})

onMounted(async () => {
  loadGuestLikes()
  loadGuestName()
  document.addEventListener('keydown', onKeydown)

  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && hasMore.value && !loadingMore.value) loadMore()
  }, { rootMargin: '200px' })

  try {
    const res = await api.get(`/share/${token}`, { params: { limit: INITIAL_LIMIT } })
    album.value = res.data.album
    totalImages.value = res.data.totalImages ?? 0
    images.value = (res.data.images ?? []).map((img: any) => ({
      ...img,
      liked: guestLikes.value.has(img.id),
    }))
    nextCursor.value = res.data.nextCursor
    hasMore.value = !!res.data.nextCursor
    if (res.data.permissions) {
      permissions.value = {
        allowLike: res.data.permissions.allowLike ?? true,
        allowComment: res.data.permissions.allowComment ?? true,
        allowDownload: res.data.permissions.allowDownload ?? false,
      }
    }
  } catch (e: any) {
    error.value = e.response?.data?.message ?? 'Không thể tải album'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  scrollObserver?.disconnect()
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center h-14">
          <svg class="w-7 h-7 text-orange-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
          </svg>
          <span class="ml-2 text-lg font-bold text-gray-900 dark:text-white">PhotoStorage</span>
          <span class="ml-3 text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">Album chia sẻ</span>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-20 text-gray-400">{{ $t('common.loading') }}</div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-20">
        <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p class="text-lg text-gray-600 dark:text-gray-400">{{ error }}</p>
      </div>

      <!-- Album Content -->
      <div v-else-if="album">
        <!-- Album Info — compact layout -->
        <div class="mb-4">
          <!-- Title row + permission badges -->
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <h1 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">{{ album.title }}</h1>
            <span
              v-if="permissions.allowLike"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Like
            </span>
            <span
              v-if="permissions.allowComment"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Comment
            </span>
            <span
              v-if="permissions.allowDownload"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </span>
          </div>
          <!-- Meta row -->
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0 text-[11px] text-gray-400 dark:text-gray-500">
            <span v-if="album.owner" class="flex items-center gap-1">
              <img
                v-if="album.owner.avatarKey"
                :src="cdnUrl(album.owner.avatarKey)"
                class="w-4 h-4 rounded-full object-cover"
                alt=""
              />
              {{ album.owner.displayName }}
            </span>
            <span>&middot;</span>
            <span>{{ images.length }}<template v-if="totalImages > images.length">/{{ totalImages }}</template> ảnh</span>
            <span>&middot;</span>
            <span>{{ formatBytes(album.totalBytes) }}</span>
            <template v-if="(album.totalLikes ?? 0) > 0">
              <span>&middot;</span>
              <span class="text-red-400">&#x2764; {{ album.totalLikes }}</span>
            </template>
            <template v-if="guestLikedCount > 0">
              <span>&middot;</span>
              <span class="text-pink-500">Bạn đã thích {{ guestLikedCount }} ảnh</span>
            </template>
            <span v-if="album.description" class="hidden sm:inline">&middot; {{ album.description }}</span>
          </div>
        </div>

        <!-- Filter Bar + Batch Toggle -->
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-3">
          <div class="flex gap-2 items-center">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Tìm kiếm ảnh..."
              class="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <select
              v-model="sortBy"
              class="hidden sm:block min-w-[120px] px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="most_liked">Nhiều lượt thích</option>
              <option value="largest">Dung lượng lớn</option>
            </select>
            <span class="hidden sm:block text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {{ filteredImages.length }} / {{ images.length }}
            </span>
            <!-- Batch select toggle -->
            <button
              v-if="filteredImages.length > 0 && permissions.allowDownload"
              class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors"
              :class="batchMode
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-400'"
              @click="batchMode ? exitBatchMode() : (batchMode = true)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span class="hidden sm:inline">{{ batchMode ? 'Thoát' : 'Chọn nhiều' }}</span>
            </button>
          </div>
          <!-- Mobile sort row -->
          <div class="sm:hidden mt-2 flex gap-2 items-center">
            <select
              v-model="sortBy"
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="most_liked">Nhiều lượt thích</option>
              <option value="largest">Dung lượng lớn</option>
            </select>
            <span class="text-xs text-gray-400 whitespace-nowrap">{{ filteredImages.length }} / {{ images.length }}</span>
          </div>
        </div>

        <!-- Batch Toolbar -->
        <div v-if="batchMode" class="flex flex-wrap items-center gap-2 mb-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <button class="text-sm text-orange-600 dark:text-orange-400 hover:underline" @click="selectAll">
            {{ selectedIds.size === filteredImages.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả' }}
          </button>
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ selectedIds.size }} / {{ filteredImages.length }} đã chọn</span>
          <div class="flex-1"></div>
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            :disabled="selectedIds.size === 0 || batchLoading"
            @click="batchDownload"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Tải ({{ selectedIds.size }})
          </button>
        </div>

        <!-- Images Grid -->
        <div v-if="filteredImages.length > 0" class="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4">
          <div
            v-for="(img, idx) in filteredImages"
            :key="img.id"
            class="group relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow break-inside-avoid mb-4"
            :class="{ 'ring-2 ring-orange-500': batchMode && selectedIds.has(img.id) }"
            @click="batchMode ? toggleSelect(img.id) : openLightbox(idx)"
          >
            <!-- Batch checkbox overlay -->
            <div v-if="batchMode" class="absolute top-2 left-2 z-10">
              <button
                class="w-6 h-6 rounded border-2 flex items-center justify-center transition-colors"
                :class="selectedIds.has(img.id) ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/80 border-gray-300 hover:border-orange-400'"
                @click.stop="toggleSelect(img.id)"
              >
                <svg v-if="selectedIds.has(img.id)" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
            <div class="bg-gray-100 dark:bg-gray-700">
              <img
                v-if="img.thumbUrl || img.thumbKey"
                :src="img.thumbUrl || cdnUrl(img.thumbKey)"
                class="w-full h-auto object-cover"
                :alt="img.originalName"
                loading="lazy"
              />
              <div v-else class="aspect-square w-full flex items-center justify-center text-gray-300">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div class="p-2 flex items-center justify-between">
              <p class="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{{ img.originalName }}</p>
              <div class="flex items-center gap-2">
                <!-- Download icon on card (if allowed) -->
                <button
                  v-if="permissions.allowDownload && !batchMode"
                  class="text-gray-400 hover:text-green-500 transition-colors"
                  :title="$t('image.download')"
                  @click.stop="handleDownload(img)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <!-- Like button on grid -->
                <button
                  v-if="permissions.allowLike"
                  class="flex items-center gap-1 text-xs shrink-0 transition-colors"
                  :class="img.liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'"
                  @click.stop="handleLike(img)"
                >
                  <svg class="w-3.5 h-3.5" :fill="img.liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {{ img.likeCount }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- Load more sentinel -->
        <div v-if="hasMore && filteredImages.length > 0" ref="scrollSentinel" class="flex flex-col items-center py-6 gap-2">
          <span class="text-xs text-gray-400">Đang hiển thị {{ images.length }}/{{ totalImages }} ảnh</span>
          <button
            v-if="!loadingMore"
            class="px-5 py-2 text-sm font-medium text-orange-500 hover:text-orange-600 border border-orange-300 dark:border-orange-700 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
            @click="loadMore"
          >
            Tải thêm ảnh
          </button>
          <div v-else class="text-sm text-gray-400 flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Đang tải thêm...
          </div>
        </div>
        <div v-else-if="filteredImages.length === 0 && !loading" class="text-center py-20 text-gray-400">
          <p v-if="searchQuery">Không tìm thấy ảnh phù hợp</p>
          <p v-else>Chưa có ảnh nào trong album này</p>
        </div>
      </div>
    </main>

    <!-- Lightbox -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="lightboxOpen && lightboxImage"
          class="fixed inset-0 z-50 flex flex-col bg-black/95"
        >
          <!-- Close button -->
          <button
            class="absolute top-4 right-4 z-50 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            @click="closeLightbox"
          >
            <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Image counter -->
          <div
            v-if="filteredImages.length > 1"
            class="absolute top-4 left-4 z-30 px-3 py-1.5 rounded-full bg-black/60 text-white text-sm select-none"
          >
            {{ lightboxIndex + 1 }} / {{ filteredImages.length }}
          </div>

          <!-- Main content area -->
          <div class="flex-1 flex min-h-0 relative">
            <!-- Previous button -->
            <button
              v-if="filteredImages.length > 1"
              class="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 text-white transition-all"
              :class="lightboxIndex > 0 ? 'hover:bg-black/70 cursor-pointer' : 'opacity-30 cursor-not-allowed'"
              :disabled="lightboxIndex <= 0"
              @click="lightboxIndex > 0 && navigateLightbox(lightboxIndex - 1)"
            >
              <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <!-- Image viewport -->
            <div
              class="flex-1 flex items-center justify-center overflow-hidden"
              @click.self="closeLightbox"
            >
              <img
                v-if="lightboxImage.previewUrl || lightboxImage.previewKey"
                :src="lightboxImage.previewUrl || lightboxImage.previewKey || ''"
                class="max-w-full max-h-full object-contain select-none"
                :alt="lightboxImage.originalName"
                draggable="false"
              />
              <div v-else class="text-white/50 text-center">
                <svg class="w-12 h-12 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p>Đang xử lý...</p>
              </div>
            </div>

            <!-- Next button -->
            <button
              v-if="filteredImages.length > 1"
              class="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 text-white transition-all"
              :class="lightboxIndex < filteredImages.length - 1 ? 'hover:bg-black/70 cursor-pointer' : 'opacity-30 cursor-not-allowed'"
              :disabled="lightboxIndex >= filteredImages.length - 1"
              @click="lightboxIndex < filteredImages.length - 1 && navigateLightbox(lightboxIndex + 1)"
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
                v-if="showComments && permissions.allowComment"
                class="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-gray-800 shadow-xl z-40 flex flex-col"
              >
                <div class="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                  <h3 class="font-semibold text-gray-900 dark:text-white text-sm">
                    {{ $t('comment.title') }} ({{ lightboxImage?.commentCount ?? 0 }})
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
                <!-- Comment list -->
                <div class="flex-1 overflow-y-auto p-4">
                  <div v-if="lightboxCommentsLoading" class="text-center py-4 text-gray-400 text-sm">
                    {{ $t('common.loading') }}
                  </div>
                  <div v-else class="space-y-3">
                    <div v-for="c in lightboxComments" :key="c.id" class="flex gap-2">
                      <div class="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 shrink-0 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-300">
                        {{ (c.guestName || c.user?.displayName || 'K')[0].toUpperCase() }}
                      </div>
                      <div>
                        <p class="text-xs">
                          <span class="font-medium text-gray-900 dark:text-white">{{ c.guestName || c.user?.displayName || 'Khách' }}</span>
                          <span class="text-gray-400 ml-2">{{ timeAgo(c.createdAt) }}</span>
                        </p>
                        <p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ c.content }}</p>
                      </div>
                    </div>
                    <p v-if="lightboxComments.length === 0" class="text-sm text-gray-400">
                      {{ $t('comment.noComments') }}
                    </p>
                  </div>
                </div>
                <!-- Guest comment form -->
                <div class="border-t border-gray-100 dark:border-gray-700 p-4 space-y-2">
                  <input
                    v-model="guestName"
                    type="text"
                    maxlength="100"
                    :placeholder="$t('comment.guestNamePlaceholder')"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <div class="flex gap-2">
                    <textarea
                      v-model="guestCommentText"
                      maxlength="2000"
                      rows="2"
                      :placeholder="$t('comment.guestCommentPlaceholder')"
                      class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                      @keydown.ctrl.enter="postGuestComment"
                    ></textarea>
                    <button
                      class="self-end px-3 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 shrink-0"
                      :disabled="!guestCommentText.trim() || guestCommentPosting"
                      @click="postGuestComment"
                    >
                      {{ $t('common.send') }}
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Bottom toolbar -->
          <div class="shrink-0 flex items-center justify-center gap-1 py-3 px-4 bg-black/70">
            <!-- Like -->
            <button
              v-if="permissions.allowLike"
              class="w-10 h-10 flex items-center justify-center rounded-full transition-colors"
              :class="lightboxImage?.liked ? 'text-red-500 bg-red-500/20' : 'text-white/70 hover:text-white hover:bg-white/10'"
              @click="lightboxImage && handleLike(lightboxImage)"
            >
              <svg class="w-6 h-6" :fill="lightboxImage?.liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>

            <!-- Download -->
            <button
              v-if="permissions.allowDownload"
              class="w-10 h-10 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              :class="{ 'opacity-50 cursor-not-allowed': downloadingImageId }"
              :disabled="!!downloadingImageId"
              @click="lightboxImage && handleDownload(lightboxImage)"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            <!-- Separator -->
            <div v-if="permissions.allowComment" class="w-px h-6 bg-white/20 mx-1"></div>

            <!-- Comments toggle -->
            <button
              v-if="permissions.allowComment"
              class="w-10 h-10 flex items-center justify-center rounded-full transition-colors"
              :class="showComments ? 'text-blue-400 bg-blue-500/20' : 'text-white/70 hover:text-white hover:bg-white/10'"
              @click="showComments = !showComments"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>

            <!-- Image info -->
            <div class="w-px h-6 bg-white/20 mx-1"></div>
            <div class="text-white/40 text-xs truncate max-w-[200px] select-none hidden sm:block">
              {{ lightboxImage?.originalName }} &middot; {{ formatBytes(lightboxImage?.originalSize ?? '0') }}
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
