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
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('album.myAlbums') }}</h1>
      <div class="flex gap-2">
        <router-link to="/dashboard/albums/new?tab=drive">
          <BaseButton variant="secondary">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15l3.43 5.96L11.14 9.46 7.71 3.5zm1.14 0l6.86 11.88H22.57L15.71 3.5H8.85zM15 12.96L11.57 19.5h13.29l3.43-5.96L15 12.96z" />
            </svg>
            {{ $t('drive.importFromDrive') }}
          </BaseButton>
        </router-link>
        <router-link to="/dashboard/albums/new">
          <BaseButton>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {{ $t('album.createAlbum') }}
          </BaseButton>
        </router-link>
      </div>
    </div>

    <AlbumGrid :albums="albums" :loading="loading" />
  </div>
</template>
