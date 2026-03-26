<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImageItem } from '@/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'

const { t } = useI18n()

defineProps<{
  image: ImageItem
  showLike?: boolean
  showDelete?: boolean
  showSetCover?: boolean
}>()

const emit = defineEmits<{
  click: [image: ImageItem]
  like: [image: ImageItem]
  delete: [image: ImageItem]
  setCover: [image: ImageItem]
}>()

const statusBadge = computed(() => ({
  uploading: { label: t('image.status.uploading'), variant: 'default' as const },
  processing: { label: t('image.status.processing'), variant: 'warning' as const },
  ready: { label: '', variant: 'success' as const },
  failed: { label: t('image.status.failed'), variant: 'danger' as const },
}))
</script>

<template>
  <div class="group relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow break-inside-avoid mb-4">
    <div class="bg-gray-100 dark:bg-gray-700 relative" @click="emit('click', image)">
      <img
        v-if="image.thumbUrl || image.thumbKey"
        :src="image.thumbUrl || image.thumbKey || ''"
        class="w-full h-auto object-cover"
        :alt="image.originalName"
        loading="lazy"
      />
      <div v-else-if="image.status === 'processing'" class="aspect-square w-full flex items-center justify-center">
        <svg class="animate-spin h-8 w-8 text-orange-500" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <div v-else-if="image.status === 'failed'" class="aspect-square w-full flex items-center justify-center text-red-400">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div v-else class="aspect-square w-full flex items-center justify-center text-gray-300">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>

      <!-- Status badge -->
      <div v-if="image.status !== 'ready'" class="absolute top-2 left-2">
        <BaseBadge :variant="statusBadge[image.status].variant">
          {{ statusBadge[image.status].label }}
        </BaseBadge>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-2">
      <p class="text-xs text-gray-600 truncate">{{ image.originalName }}</p>
      <div class="flex items-center justify-between mt-1">
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <button
            v-if="showLike"
            class="flex items-center gap-1 hover:text-red-500 transition-colors"
            :class="image.liked ? 'text-red-500' : ''"
            @click.stop="emit('like', image)"
          >
            <svg class="w-3.5 h-3.5" :fill="image.liked ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {{ image.likeCount }}
          </button>
          <span class="flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {{ image.commentCount }}
          </span>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button
            v-if="showSetCover && image.status === 'ready'"
            class="text-gray-400 hover:text-orange-500 transition-colors"
            :title="$t('album.setCover')"
            @click.stop="emit('setCover', image)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            v-if="showDelete"
            class="text-gray-400 hover:text-red-500 transition-colors"
            :title="$t('image.deleteImage')"
            @click.stop="emit('delete', image)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
