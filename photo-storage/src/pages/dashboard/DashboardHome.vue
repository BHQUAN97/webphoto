<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import { formatBytes } from '@/utils/format'
import StorageBar from '@/components/ui/StorageBar.vue'
import AlbumGrid from '@/components/album/AlbumGrid.vue'
import type { Album, StorageInfo } from '@/types'

const auth = useAuthStore()

const storage = ref<StorageInfo>({ usedBytes: '0', limitBytes: '5368709120' })
const stats = ref({ totalImages: 0, processingImages: 0, failedImages: 0, totalLikes: 0, totalComments: 0 })
const albums = ref<Album[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [storageRes, statsRes, albumsRes] = await Promise.all([
      api.get('/users/me/storage'),
      api.get('/users/me/stats'),
      api.get('/users/me/albums', { params: { limit: 8 } }),
    ])
    storage.value = storageRes.data
    stats.value = statsRes.data
    albums.value = albumsRes.data.data ?? albumsRes.data
  } catch {
    // silently fail
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Xin chào, {{ auth.user?.displayName }}!</h1>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <p class="text-sm text-gray-500">Tổng ảnh</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats.totalImages }}</p>
        <div class="flex gap-3 mt-2 text-xs">
          <span v-if="stats.processingImages > 0" class="text-yellow-600">{{ stats.processingImages }} đang xử lý</span>
          <span v-if="stats.failedImages > 0" class="text-red-600">{{ stats.failedImages }} lỗi</span>
        </div>
      </div>

      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <p class="text-sm text-gray-500">Dung lượng</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ formatBytes(storage.usedBytes) }}</p>
        <StorageBar :used-bytes="storage.usedBytes" :limit-bytes="storage.limitBytes" class="mt-2" />
      </div>

      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <p class="text-sm text-gray-500">Album</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ albums.length }}</p>
      </div>

      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <p class="text-sm text-gray-500">Tương tác</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats.totalLikes }}</p>
        <p class="text-xs text-gray-400 mt-1">{{ stats.totalComments }} bình luận</p>
      </div>
    </div>

    <!-- Recent Albums -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900">Album của tôi</h2>
      <router-link to="/dashboard/albums" class="text-sm text-orange-500 hover:text-orange-600">Xem tất cả &rarr;</router-link>
    </div>
    <AlbumGrid :albums="albums" :loading="loading" />
  </div>
</template>
