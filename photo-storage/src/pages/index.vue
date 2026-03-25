<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import type { Album } from '@/types'
import AlbumCard from '@/components/album/AlbumCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const auth = useAuthStore()
const albums = ref<Album[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await api.get('/albums', { params: { limit: 12 } })
    albums.value = res.data.data ?? res.data.items ?? []
  } catch {
    // Public albums may fail if backend is not ready
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="bg-gradient-to-br from-orange-500 to-orange-700 text-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 class="text-4xl sm:text-5xl font-bold mb-4">Lưu trữ ảnh chuyên nghiệp</h1>
        <p class="text-lg sm:text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
          Upload ảnh RAW chất lượng gốc, xem trên web với tốc độ cao, tải về nguyên vẹn 100%.
        </p>
        <div class="flex items-center justify-center gap-4">
          <router-link v-if="!auth.isAuthenticated" to="/register">
            <BaseButton size="lg">Bắt đầu miễn phí</BaseButton>
          </router-link>
          <router-link v-else to="/dashboard">
            <BaseButton size="lg">Vào Dashboard</BaseButton>
          </router-link>
          <router-link to="/upgrade">
            <BaseButton variant="ghost" size="lg" class="!text-white hover:!bg-white/10">
              Xem bảng giá
            </BaseButton>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="py-16 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-2xl font-bold text-center text-gray-900 mb-12">Tính năng nổi bật</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="text-center p-6">
            <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">Upload RAW</h3>
            <p class="text-gray-500 text-sm">Hỗ trợ CR2, ARW, NEF, DNG. Upload nhiều file cùng lúc với progress bar.</p>
          </div>
          <div class="text-center p-6">
            <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">Xem nhanh WebP</h3>
            <p class="text-gray-500 text-sm">Ảnh tự động tối ưu thành WebP, tải trang nhanh qua CDN toàn cầu.</p>
          </div>
          <div class="text-center p-6">
            <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">Download gốc 100%</h3>
            <p class="text-gray-500 text-sm">Tải ảnh RAW nguyên vẹn, không nén lại. Hỗ trợ tải cả album dạng ZIP.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Public Albums -->
    <section class="py-16 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-8">Album công khai</h2>
        <div v-if="loading" class="text-center py-12 text-gray-400">Đang tải...</div>
        <div v-else-if="albums.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AlbumCard v-for="album in albums" :key="album.id" :album="album" />
        </div>
        <div v-else class="text-center py-12 text-gray-400">Chưa có album nào</div>
      </div>
    </section>
  </div>
</template>
