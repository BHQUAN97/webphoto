<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from '@/plugins/i18n'
import api from '@/utils/api'
import type { ImageItem } from '@/types'
import ImageCard from '@/components/image/ImageCard.vue'
import ImageLightbox from '@/components/image/ImageLightbox.vue'
import BackButton from '@/components/ui/BackButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()

const images = ref<ImageItem[]>([])
const loading = ref(true)
const lightboxImage = ref<ImageItem | null>(null)
const showExport = ref(false)

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

function getExportText(): string {
  return images.value
    .map((img, idx) => `${idx + 1}. ${img.originalName}`)
    .join('\n')
}

async function copyList() {
  try {
    await navigator.clipboard.writeText(getExportText())
    toast.success(t('favorites.copied'))
  } catch {
    toast.error(t('favorites.copyFailed'))
  }
}

function downloadTxt() {
  const text = getExportText()
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'favorites.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function downloadCsv() {
  if (images.value.length === 0) return
  const header = 'No,Filename,Extension'
  const rows = images.value.map((img, i) => {
    const name = img.originalName || 'unknown'
    const ext = name.split('.').pop() || ''
    const base = name.replace(/\.[^.]+$/, '')
    return `${i + 1},"${base}","${ext}"`
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'favorites.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.success(t('favorites.csvExported'))
}

function copyLightroomFilter() {
  if (images.value.length === 0) return
  // Lightroom Library Filter format: filenames without extension, separated by ", "
  const names = images.value.map(img => {
    const name = img.originalName || ''
    return name.replace(/\.[^.]+$/, '') // remove extension
  })
  const filterStr = names.join(', ')
  navigator.clipboard.writeText(filterStr).catch(() => {
    // fallback
  })
  toast.success(t('favorites.lightroomCopied'))
}
</script>

<template>
  <div>
    <BackButton />
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ $t('favorites.title') }}</h1>
      <BaseButton
        v-if="images.length > 0"
        variant="secondary"
        size="sm"
        @click="showExport = true"
      >
        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {{ $t('favorites.exportList') }}
      </BaseButton>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">{{ $t('common.loading') }}</div>
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
      <p>{{ $t('favorites.empty') }}</p>
    </div>

    <ImageLightbox
      :image="lightboxImage"
      :show="!!lightboxImage"
      @close="lightboxImage = null"
      @like="handleLike"
    />

    <!-- Export Modal -->
    <BaseModal :show="showExport" :title="$t('favorites.exportTitle')" @close="showExport = false">
      <div class="space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('favorites.totalCount', { count: images.length }) }}
        </p>
        <div class="max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <ol class="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li v-for="img in images" :key="img.id">
              {{ img.originalName }}
            </li>
          </ol>
        </div>
        <div class="flex gap-2">
          <BaseButton variant="primary" size="sm" @click="copyList">
            <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {{ $t('favorites.copyList') }}
          </BaseButton>
          <BaseButton variant="secondary" size="sm" @click="downloadTxt">
            <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {{ $t('favorites.downloadTxt') }}
          </BaseButton>
          <BaseButton variant="secondary" size="sm" @click="downloadCsv">
            <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {{ $t('favorites.downloadCsv') }}
          </BaseButton>
        </div>
        <div class="flex gap-2 items-start">
          <BaseButton variant="secondary" size="sm" @click="copyLightroomFilter">
            <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {{ $t('favorites.copyLightroom') }}
          </BaseButton>
          <span class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ $t('favorites.lightroomHint') }}</span>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
