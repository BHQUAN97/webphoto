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
        <h1 class="text-4xl sm:text-5xl font-bold mb-4">{{ $t('landing.heroTitle') }}</h1>
        <p class="text-lg sm:text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
          {{ $t('landing.heroSubtitle') }}
        </p>
        <div class="flex items-center justify-center gap-4">
          <router-link v-if="!auth.isAuthenticated" to="/register">
            <BaseButton size="lg">{{ $t('landing.startFree') }}</BaseButton>
          </router-link>
          <router-link v-else to="/dashboard">
            <BaseButton size="lg">{{ $t('landing.goToDashboard') }}</BaseButton>
          </router-link>
          <router-link to="/upgrade">
            <BaseButton variant="ghost" size="lg" class="!text-white hover:!bg-white/10">
              {{ $t('landing.viewPricing') }}
            </BaseButton>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="py-16 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-2xl font-bold text-center text-gray-900 mb-12">{{ $t('landing.features') }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="text-center p-6">
            <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">{{ $t('landing.featureRaw') }}</h3>
            <p class="text-gray-500 text-sm">{{ $t('landing.featureRawDesc') }}</p>
          </div>
          <div class="text-center p-6">
            <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">{{ $t('landing.featureWebp') }}</h3>
            <p class="text-gray-500 text-sm">{{ $t('landing.featureWebpDesc') }}</p>
          </div>
          <div class="text-center p-6">
            <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">{{ $t('landing.featureDownload') }}</h3>
            <p class="text-gray-500 text-sm">{{ $t('landing.featureDownloadDesc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Public Albums -->
    <section class="py-16 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-8">{{ $t('landing.publicAlbums') }}</h2>
        <div v-if="loading" class="text-center py-12 text-gray-400">{{ $t('common.loading') }}</div>
        <div v-else-if="albums.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AlbumCard v-for="album in albums" :key="album.id" :album="album" />
        </div>
        <div v-else class="text-center py-12 text-gray-400">{{ $t('landing.noAlbums') }}</div>
      </div>
    </section>
  </div>
</template>
