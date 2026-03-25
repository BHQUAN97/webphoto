<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import type { ImageItem } from '@/types'
import ImageCard from '@/components/image/ImageCard.vue'
import ImageLightbox from '@/components/image/ImageLightbox.vue'

const images = ref<ImageItem[]>([])
const loading = ref(true)
const lightboxImage = ref<ImageItem | null>(null)

onMounted(async () => {
  try {
    const res = await api.get('/images', { params: { liked: true, limit: 100 } })
    images.value = res.data.items ?? res.data.data ?? res.data
  } catch {
    // silently fail
  } finally {
    loading.value = false
  }
})

async function handleLike(image: ImageItem) {
  try {
    await api.delete(`/images/${image.id}/like`)
    images.value = images.value.filter((i) => i.id !== image.id)
  } catch {
    // silently fail
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Ảnh yêu thích</h1>

    <div v-if="loading" class="text-center py-12 text-gray-400">Đang tải...</div>
    <div v-else-if="images.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <ImageCard
        v-for="img in images"
        :key="img.id"
        :image="img"
        show-like
        @click="lightboxImage = img"
        @like="handleLike"
      />
    </div>
    <div v-else class="text-center py-12 text-gray-400">
      <p>Bạn chưa yêu thích ảnh nào</p>
    </div>

    <ImageLightbox
      :image="lightboxImage"
      :show="!!lightboxImage"
      @close="lightboxImage = null"
      @like="handleLike"
    />
  </div>
</template>
