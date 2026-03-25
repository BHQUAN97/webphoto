<script setup lang="ts">
import type { Album } from '@/types'
import { cdnUrl, formatBytes, formatDate } from '@/utils/format'
import BaseBadge from '@/components/ui/BaseBadge.vue'

defineProps<{ album: Album }>()
</script>

<template>
  <router-link
    :to="`/dashboard/albums/${album.id}`"
    class="block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
  >
    <div class="aspect-[4/3] bg-gray-100 relative">
      <img
        v-if="album.coverKey"
        :src="cdnUrl(album.coverKey)"
        class="w-full h-full object-cover"
        :alt="album.title"
        loading="lazy"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div class="absolute top-2 right-2">
        <BaseBadge :variant="album.isPublic ? 'success' : 'default'">
          {{ album.isPublic ? 'Public' : 'Private' }}
        </BaseBadge>
      </div>
    </div>
    <div class="p-4">
      <h3 class="font-semibold text-gray-900 truncate">{{ album.title }}</h3>
      <div class="flex items-center gap-3 mt-2 text-xs text-gray-500">
        <span>{{ album.imageCount }} ảnh</span>
        <span>{{ formatBytes(album.totalBytes) }}</span>
      </div>
      <p v-if="album.ownerName" class="text-xs text-gray-400 mt-1">{{ album.ownerName }}</p>
      <p class="text-xs text-gray-400 mt-1">{{ formatDate(album.createdAt) }}</p>
    </div>
  </router-link>
</template>
