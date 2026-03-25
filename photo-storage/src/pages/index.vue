<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import type { Album } from '@/types'
import AlbumCard from '@/components/album/AlbumCard.vue'

const auth = useAuthStore()
const albums = ref<Album[]>([])
const loading = ref(true)

// Animated counters
const counters = ref([
  { target: 5000000, current: 0, suffix: '+', label: 'landing.statPhotos' },
  { target: 1000, current: 0, suffix: '+', label: 'landing.statPhotographers' },
  { target: 80, current: 0, suffix: '%', label: 'landing.statTimeSaved' },
  { target: 99, current: 0, suffix: '%', label: 'landing.statSatisfaction' },
])

let animationFrame: number | null = null

function animateCounters() {
  const duration = 2000
  const startTime = performance.now()

  function step(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic

    counters.value.forEach((c) => {
      c.current = Math.floor(c.target * eased)
    })

    if (progress < 1) {
      animationFrame = requestAnimationFrame(step)
    }
  }

  animationFrame = requestAnimationFrame(step)
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K'
  return n.toString()
}

onMounted(async () => {
  animateCounters()
  try {
    const res = await api.get('/albums', { params: { limit: 12 } })
    albums.value = res.data.data ?? res.data.items ?? []
  } catch {
    // Public albums may fail if backend is not ready
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <div class="bg-gray-950 min-h-screen">
    <!-- Hero Section -->
    <section class="relative overflow-hidden">
      <!-- Background gradient -->
      <div class="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-950 to-black"></div>
      <!-- Subtle grid pattern overlay -->
      <div class="absolute inset-0 opacity-[0.03]" style="background-image: url('data:image/svg+xml,%3Csvg width=&quot;60&quot; height=&quot;60&quot; viewBox=&quot;0 0 60 60&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cg fill=&quot;none&quot; fill-rule=&quot;evenodd&quot;%3E%3Cg fill=&quot;%23ffffff&quot;%3E%3Cpath d=&quot;M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z&quot;/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')"></div>
      <!-- Glow orbs -->
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight">
          <span class="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
            {{ $t('landing.heroTitle') }}
          </span>
        </h1>
        <p class="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          {{ $t('landing.heroSubtitle') }}
        </p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <router-link v-if="!auth.isAuthenticated" to="/register">
            <button class="px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl text-base shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:from-orange-400 hover:to-amber-400 transition-all duration-300 transform hover:scale-[1.02]">
              {{ $t('landing.startFree') }}
            </button>
          </router-link>
          <router-link v-else to="/dashboard">
            <button class="px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl text-base shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:from-orange-400 hover:to-amber-400 transition-all duration-300 transform hover:scale-[1.02]">
              {{ $t('landing.goToDashboard') }}
            </button>
          </router-link>
          <router-link to="/upgrade">
            <button class="px-8 py-3.5 border border-gray-700 text-gray-300 font-semibold rounded-xl text-base hover:bg-white/5 hover:border-gray-600 transition-all duration-300">
              {{ $t('landing.viewPricing') }}
            </button>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Stats Bar -->
    <section class="relative border-y border-gray-800/50 bg-gray-900/50 backdrop-blur-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          <div v-for="stat in counters" :key="stat.label" class="text-center">
            <div class="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
              {{ formatNumber(stat.current) }}{{ stat.suffix }}
            </div>
            <div class="text-sm text-gray-500 mt-1">{{ $t(stat.label) }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Feature Cards -->
    <section class="py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-2xl sm:text-3xl font-bold text-center text-white mb-4">{{ $t('landing.features') }}</h2>
        <p class="text-center text-gray-500 mb-12 max-w-xl mx-auto">{{ $t('landing.featuresSubtitle') }}</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Card 1: Sync from Drive -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-2xl p-8 hover:border-gray-700 transition-all duration-300 group">
            <div class="w-14 h-14 bg-emerald-500/15 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-500/25 transition-colors">
              <svg class="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">{{ $t('landing.featureSync') }}</h3>
            <p class="text-gray-400 text-sm leading-relaxed">{{ $t('landing.featureSyncDesc') }}</p>
          </div>

          <!-- Card 2: Easy selection -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-2xl p-8 hover:border-gray-700 transition-all duration-300 group">
            <div class="w-14 h-14 bg-blue-500/15 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-500/25 transition-colors">
              <svg class="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">{{ $t('landing.featureSelect') }}</h3>
            <p class="text-gray-400 text-sm leading-relaxed">{{ $t('landing.featureSelectDesc') }}</p>
          </div>

          <!-- Card 3: Export list -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-2xl p-8 hover:border-gray-700 transition-all duration-300 group">
            <div class="w-14 h-14 bg-orange-500/15 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-orange-500/25 transition-colors">
              <svg class="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">{{ $t('landing.featureExport') }}</h3>
            <p class="text-gray-400 text-sm leading-relaxed">{{ $t('landing.featureExportDesc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 3-Step Process -->
    <section class="py-20 relative">
      <div class="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900/50 to-gray-950"></div>
      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-2xl sm:text-3xl font-bold text-center text-white mb-4">{{ $t('landing.howItWorks') }}</h2>
        <p class="text-center text-gray-500 mb-16 max-w-xl mx-auto">{{ $t('landing.howItWorksSubtitle') }}</p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <!-- Step 1 -->
          <div class="text-center relative">
            <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20">
              <span class="text-2xl font-bold text-white">1</span>
            </div>
            <!-- Connector line (hidden on mobile) -->
            <div class="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gradient-to-r from-orange-500/40 to-transparent"></div>
            <h3 class="text-lg font-semibold text-white mb-2">{{ $t('landing.step1Title') }}</h3>
            <p class="text-gray-400 text-sm leading-relaxed">{{ $t('landing.step1Desc') }}</p>
          </div>

          <!-- Step 2 -->
          <div class="text-center relative">
            <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
              <span class="text-2xl font-bold text-white">2</span>
            </div>
            <div class="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gradient-to-r from-blue-500/40 to-transparent"></div>
            <h3 class="text-lg font-semibold text-white mb-2">{{ $t('landing.step2Title') }}</h3>
            <p class="text-gray-400 text-sm leading-relaxed">{{ $t('landing.step2Desc') }}</p>
          </div>

          <!-- Step 3 -->
          <div class="text-center">
            <div class="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
              <span class="text-2xl font-bold text-white">3</span>
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">{{ $t('landing.step3Title') }}</h3>
            <p class="text-gray-400 text-sm leading-relaxed">{{ $t('landing.step3Desc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-20">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">{{ $t('landing.ctaTitle') }}</h2>
        <p class="text-gray-400 mb-8">{{ $t('landing.ctaSubtitle') }}</p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <input
            type="email"
            :placeholder="$t('auth.emailPlaceholder')"
            class="w-full sm:flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
          />
          <router-link to="/register" class="w-full sm:w-auto">
            <button class="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300">
              {{ $t('auth.register') }}
            </button>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Public Albums -->
    <section class="py-20 border-t border-gray-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-8">{{ $t('landing.publicAlbums') }}</h2>
        <div v-if="loading" class="text-center py-12 text-gray-500">{{ $t('common.loading') }}</div>
        <div v-else-if="albums.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AlbumCard v-for="album in albums" :key="album.id" :album="album" />
        </div>
        <div v-else class="text-center py-16">
          <div class="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p class="text-gray-500">{{ $t('landing.noAlbums') }}</p>
        </div>
      </div>
    </section>
  </div>
</template>
