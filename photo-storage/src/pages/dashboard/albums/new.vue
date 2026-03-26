<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import api from '@/utils/api'
import BackButton from '@/components/ui/BackButton.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const loading = ref(false)

// Album info
const title = ref('')
const description = ref('')
const isPublic = ref(true)

// Source mode: 'upload' (default) or 'drive' — supports ?tab=drive query param
const sourceMode = ref<'upload' | 'drive'>(route.query.tab === 'drive' ? 'drive' : 'upload')

// Drive options
const driveLink = ref('')
const includeSubfolders = ref(false)
const driveImporting = ref(false)

function extractFolderId(link: string): string | null {
  const match = link.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

async function handleCreate() {
  if (!title.value.trim()) {
    toast.error(t('album.albumNameRequired') || 'Tên album không được để trống')
    return
  }

  loading.value = true

  try {
    if (sourceMode.value === 'drive') {
      // Create from Google Drive
      const folderId = extractFolderId(driveLink.value)
      if (!folderId) {
        toast.error(t('drive.invalidLink'))
        loading.value = false
        return
      }

      driveImporting.value = true
      const res = await api.post('/albums/from-drive', {
        folderId,
        title: title.value.trim(),
        includeSubfolders: includeSubfolders.value,
      }, { timeout: 120000 })

      const count = res.data.imageCount || 0
      toast.success(t('drive.importSuccess', { count }) || `Import ${count} ảnh thành công`)
      router.push(`/dashboard/albums/${res.data.albumId}`)
    } else {
      // Create empty album → redirect to upload
      const res = await api.post('/albums', {
        title: title.value.trim(),
        description: description.value.trim() || null,
        isPublic: isPublic.value,
      })
      router.push(`/dashboard/albums/${res.data.id}`)
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number; data?: { message?: string } } })?.response?.status
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    if (status === 409) {
      toast.error(msg || 'Album từ folder này đã tồn tại')
    } else {
      toast.error(msg || t('album.createFailed'))
    }
  } finally {
    loading.value = false
    driveImporting.value = false
  }
}
</script>

<template>
  <BackButton />
  <div class="max-w-xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ $t('album.createNew') }}</h1>

    <form @submit.prevent="handleCreate" class="space-y-6">
      <!-- Album Info Card -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">Thông tin album</h2>

        <!-- Title -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('album.albumName') }} <span class="text-red-500">*</span>
          </label>
          <input
            v-model="title"
            type="text"
            required
            class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white dark:bg-gray-700 dark:text-white"
            :placeholder="$t('album.albumNamePlaceholder')"
          />
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('album.description') }}
          </label>
          <textarea
            v-model="description"
            rows="2"
            class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white dark:bg-gray-700 dark:text-white"
            :placeholder="$t('album.descriptionPlaceholder')"
          />
        </div>

        <!-- Public toggle -->
        <label class="flex items-center justify-between cursor-pointer">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('album.isPublic') }}</span>
          <button
            type="button"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            :class="isPublic ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'"
            @click="isPublic = !isPublic"
          >
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="isPublic ? 'translate-x-6' : 'translate-x-1'" />
          </button>
        </label>
      </div>

      <!-- Source Selection Card -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">Nguồn ảnh</h2>

        <div class="grid grid-cols-2 gap-3 mb-4">
          <!-- Upload option -->
          <button
            type="button"
            class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center"
            :class="sourceMode === 'upload'
              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600'
              : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'"
            @click="sourceMode = 'upload'"
          >
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span class="text-sm font-medium">Upload trực tiếp</span>
            <span class="text-xs opacity-60">Kéo thả hoặc chọn file</span>
          </button>

          <!-- Drive option -->
          <button
            type="button"
            class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center"
            :class="sourceMode === 'drive'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
              : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'"
            @click="sourceMode = 'drive'"
          >
            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15l3.43 5.96L11.14 9.46 7.71 3.5zm1.14 0l6.86 11.88H22.57L15.71 3.5H8.85zM15 12.96L11.57 19.5h13.29l3.43-5.96L15 12.96z" />
            </svg>
            <span class="text-sm font-medium">Google Drive</span>
            <span class="text-xs opacity-60">Dán link folder Drive</span>
          </button>
        </div>

        <!-- Drive Options (shown when drive selected) -->
        <div v-if="sourceMode === 'drive'" class="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('drive.folderLink') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="driveLink"
              type="url"
              required
              class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 dark:text-white"
              placeholder="https://drive.google.com/drive/folders/..."
            />
            <p class="mt-1 text-xs text-gray-400">Share folder cho service account hoặc public</p>
          </div>

          <label class="flex items-center justify-between cursor-pointer">
            <div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('drive.includeSubfolders') }}</span>
              <p class="text-xs text-gray-400">{{ $t('drive.includeSubfoldersHint') }}</p>
            </div>
            <button
              type="button"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :class="includeSubfolders ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'"
              @click="includeSubfolders = !includeSubfolders"
            >
              <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="includeSubfolders ? 'translate-x-6' : 'translate-x-1'" />
            </button>
          </label>
        </div>

        <!-- Upload hint (shown when upload selected) -->
        <p v-if="sourceMode === 'upload'" class="text-xs text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
          Tạo album trước, sau đó upload ảnh trên trang chi tiết album
        </p>
      </div>

      <!-- Import progress -->
      <div v-if="driveImporting" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div class="flex items-center gap-3">
          <svg class="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="text-sm text-blue-700 dark:text-blue-300">{{ $t('drive.importing') }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3">
        <BaseButton variant="secondary" type="button" @click="router.back()">{{ $t('common.cancel') }}</BaseButton>
        <BaseButton
          type="submit"
          :loading="loading"
          :disabled="!title.trim() || (sourceMode === 'drive' && !driveLink.trim())"
        >
          <template v-if="sourceMode === 'drive'">
            <svg class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15l3.43 5.96L11.14 9.46 7.71 3.5zm1.14 0l6.86 11.88H22.57L15.71 3.5H8.85zM15 12.96L11.57 19.5h13.29l3.43-5.96L15 12.96z" />
            </svg>
            Import từ Drive
          </template>
          <template v-else>
            {{ $t('album.createAlbum') }}
          </template>
        </BaseButton>
      </div>
    </form>
  </div>
</template>
