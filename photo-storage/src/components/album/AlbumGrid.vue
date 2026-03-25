<script setup lang="ts">
import type { Album } from '@/types'
import AlbumCard from './AlbumCard.vue'

defineProps<{
  albums: Album[]
  loading?: boolean
}>()
</script>

<template>
  <div>
    <div v-if="loading" class="text-center py-12 text-gray-400">
      <svg class="animate-spin h-8 w-8 mx-auto mb-3 text-orange-500" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Đang tải...
    </div>
    <div v-else-if="albums.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <AlbumCard v-for="album in albums" :key="album.id" :album="album" />
    </div>
    <div v-else class="text-center py-12">
      <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <p class="text-gray-400">Chưa có album nào</p>
    </div>
  </div>
</template>
