<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import { formatBytes } from '@/utils/format'
import StorageBar from '@/components/ui/StorageBar.vue'
import AlbumGrid from '@/components/album/AlbumGrid.vue'
import type { Album, StorageInfo } from '@/types'

useI18n()
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
    <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">{{ $t('dashboard.greeting', { name: auth.user?.displayName }) }}</h1>

    <!-- Stat Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('dashboard.totalImages') }}</p>
        <p class="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats.totalImages }}</p>
        <div class="flex gap-3 mt-2 text-xs">
          <span v-if="stats.processingImages > 0" class="text-yellow-600">{{ stats.processingImages }} {{ $t('dashboard.processing') }}</span>
          <span v-if="stats.failedImages > 0" class="text-red-600 dark:text-red-400">{{ stats.failedImages }} {{ $t('common.error') }}</span>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('dashboard.storage') }}</p>
        <p class="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ formatBytes(storage.usedBytes) }}</p>
        <StorageBar :used-bytes="storage.usedBytes" :limit-bytes="storage.limitBytes" class="mt-2" />
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('dashboard.albums') }}</p>
        <p class="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ albums.length }}</p>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('dashboard.interactions') }}</p>
        <p class="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats.totalLikes }}</p>
        <p class="text-xs text-gray-400 mt-1">{{ stats.totalComments }} {{ $t('dashboard.comments') }}</p>
      </div>
    </div>

    <!-- Recent Albums -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('dashboard.myAlbums') }}</h2>
      <router-link to="/dashboard/albums" class="text-sm text-orange-500 hover:text-orange-600">{{ $t('common.viewAll') }}</router-link>
    </div>
    <AlbumGrid :albums="albums" :loading="loading" />
  </div>
</template>
