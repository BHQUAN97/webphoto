<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/utils/api'
import { cdnUrl, formatBytes } from '@/utils/format'
import ImageLightbox from '@/components/image/ImageLightbox.vue'
import type { ImageItem } from '@/types'

const route = useRoute()
const token = route.params.token as string

const album = ref<any>(null)
const images = ref<ImageItem[]>([])
const loading = ref(true)
const error = ref('')

// Lightbox state
const lightboxIndex = ref(0)
const lightboxOpen = ref(false)

// Filter state
const sortBy = ref('newest')
const searchQuery = ref('')

// Guest likes stored in localStorage
const guestLikes = ref<Set<string>>(new Set())

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
  lightboxIndex.value = index
  lightboxOpen.value = true
}

function closeLightbox() {
  lightboxOpen.value = false
}

function navigateLightbox(index: number) {
  lightboxIndex.value = index
}

async function handleLike(image: ImageItem) {
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

  // Update like count in source images
  const img = images.value.find(i => i.id === id)
  if (img) {
    img.likeCount += isLiked ? -1 : 1
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

onMounted(async () => {
  loadGuestLikes()
  try {
    const res = await api.get(`/share/${token}`)
    album.value = res.data.album
    images.value = (res.data.images ?? []).map((img: any) => ({
      ...img,
      liked: guestLikes.value.has(img.id),
    }))
  } catch (e: any) {
    error.value = e.response?.data?.message ?? 'Không thể tải album'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center h-16">
          <svg class="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
          </svg>
          <span class="ml-2 text-xl font-bold text-gray-900 dark:text-white">PhotoStorage</span>
          <span class="ml-3 text-sm text-gray-400 dark:text-gray-500 hidden sm:inline">Album chia sẻ</span>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-20 text-gray-400">Đang tải...</div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-20">
        <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p class="text-lg text-gray-600 dark:text-gray-400">{{ error }}</p>
      </div>

      <!-- Album Content -->
      <div v-else-if="album">
        <!-- Album Info -->
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ album.title }}</h1>
          <p v-if="album.description" class="text-gray-600 dark:text-gray-400 mt-2">{{ album.description }}</p>
          <div class="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
            <span v-if="album.owner" class="flex items-center gap-2">
              <img
                v-if="album.owner.avatarKey"
                :src="cdnUrl(album.owner.avatarKey)"
                class="w-5 h-5 rounded-full object-cover"
                alt=""
              />
              {{ album.owner.displayName }}
            </span>
            <span>{{ filteredImages.length }} ảnh</span>
            <span>{{ formatBytes(album.totalBytes) }}</span>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Tìm kiếm ảnh..."
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <select
              v-model="sortBy"
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="most_liked">Nhiều lượt thích</option>
              <option value="largest">Dung lượng lớn</option>
            </select>
            <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
              Hiển thị {{ filteredImages.length }} / {{ images.length }} ảnh
            </div>
          </div>
        </div>

        <!-- Images Grid -->
        <div v-if="filteredImages.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <div
            v-for="(img, idx) in filteredImages"
            :key="img.id"
            class="group relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
            @click="openLightbox(idx)"
          >
            <div class="aspect-square bg-gray-100 dark:bg-gray-700">
              <img
                v-if="img.thumbUrl || img.thumbKey"
                :src="img.thumbUrl || cdnUrl(img.thumbKey)"
                class="w-full h-full object-cover"
                :alt="img.originalName"
                loading="lazy"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div class="p-2 flex items-center justify-between">
              <p class="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{{ img.originalName }}</p>
              <div class="flex items-center gap-1 text-xs text-gray-400 ml-1 shrink-0">
                <svg class="w-3.5 h-3.5" :class="img.liked ? 'text-red-500' : ''" :fill="img.liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {{ img.likeCount }}
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-20 text-gray-400">
          <p v-if="searchQuery">Không tìm thấy ảnh phù hợp</p>
          <p v-else>Chưa có ảnh nào trong album này</p>
        </div>
      </div>
    </main>

    <!-- Lightbox -->
    <ImageLightbox
      :image="lightboxImage"
      :images="filteredImages"
      :current-index="lightboxIndex"
      :show="lightboxOpen"
      @close="closeLightbox"
      @navigate="navigateLightbox"
      @like="handleLike"
    />
  </div>
</template>
