<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import type { Album } from '@/types'
import AlbumGrid from '@/components/album/AlbumGrid.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const albums = ref<Album[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await api.get('/users/me/albums')
    albums.value = res.data.albums ?? res.data.data ?? res.data
  } catch {
    // silently fail
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Album của tôi</h1>
      <router-link to="/dashboard/albums/new">
        <BaseButton>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Tạo album
        </BaseButton>
      </router-link>
    </div>

    <AlbumGrid :albums="albums" :loading="loading" />
  </div>
</template>
