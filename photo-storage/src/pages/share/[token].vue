<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/utils/api'
import { cdnUrl, formatBytes } from '@/utils/format'
import ImageLightbox from '@/components/image/ImageLightbox.vue'

const route = useRoute()
const token = route.params.token as string

const album = ref<any>(null)
const images = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const lightboxImage = ref<any>(null)

onMounted(async () => {
  try {
    const res = await api.get(`/share/${token}`)
    album.value = res.data.album
    images.value = res.data.images
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
        <div class="mb-8">
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
            <span>{{ album.imageCount }} ảnh</span>
            <span>{{ formatBytes(album.totalBytes) }}</span>
          </div>
        </div>

        <!-- Images Grid -->
        <div v-if="images.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <div
            v-for="img in images"
            :key="img.id"
            class="group relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
            @click="lightboxImage = img"
          >
            <div class="aspect-square bg-gray-100 dark:bg-gray-700">
              <img
                v-if="img.thumbKey"
                :src="cdnUrl(img.thumbKey)"
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
            <div class="p-2">
              <p class="text-xs text-gray-600 dark:text-gray-400 truncate">{{ img.originalName }}</p>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-20 text-gray-400">
          <p>Chưa có ảnh nào trong album này</p>
        </div>
      </div>
    </main>

    <!-- Lightbox -->
    <ImageLightbox
      :image="lightboxImage"
      :show="!!lightboxImage"
      @close="lightboxImage = null"
    />
  </div>
</template>
