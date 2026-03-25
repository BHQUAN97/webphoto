<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import api from '@/utils/api'
import AlbumForm from '@/components/album/AlbumForm.vue'
import BackButton from '@/components/ui/BackButton.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const loading = ref(false)

// Tab state: 'manual' | 'drive' — support ?tab=drive query param
const activeTab = ref<'manual' | 'drive'>('manual')

onMounted(() => {
  if (route.query.tab === 'drive') {
    activeTab.value = 'drive'
  }
})

// Drive import state
const driveLink = ref('')
const driveTitle = ref('')
const includeSubfolders = ref(false)
const driveImporting = ref(false)
const driveImportProgress = ref('')
const driveImportCount = ref(0)
const showLargeFolderWarning = ref(false)
const largeFolderConfirmed = ref(false)

async function handleSubmit(data: { title: string; description: string; isPublic: boolean }) {
  loading.value = true
  try {
    const res = await api.post('/albums', data)
    router.push(`/dashboard/albums/${res.data.id}`)
  } catch {
    toast.error(t('album.createFailed'))
  } finally {
    loading.value = false
  }
}

function extractFolderId(link: string): string | null {
  // Support formats:
  // https://drive.google.com/drive/folders/FOLDER_ID
  // https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
  const match = link.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

async function handleDriveImport() {
  const folderId = extractFolderId(driveLink.value)
  if (!folderId) {
    toast.error(t('drive.invalidLink'))
    return
  }

  driveImporting.value = true
  driveImportProgress.value = t('drive.importing')
  driveImportCount.value = 0

  try {
    const res = await api.post('/albums/from-drive', {
      folderId,
      title: driveTitle.value.trim() || undefined,
      includeSubfolders: includeSubfolders.value,
    }, { timeout: 60000 })

    driveImportCount.value = res.data.imageCount || 0

    // Show warning if folder has many files (> 500)
    if (driveImportCount.value > 500 && !largeFolderConfirmed.value) {
      showLargeFolderWarning.value = true
      return
    }

    toast.success(t('drive.importSuccess', { count: driveImportCount.value }))
    router.push(`/dashboard/albums/${res.data.albumId}`)
  } catch {
    toast.error(t('drive.importFailed'))
  } finally {
    driveImporting.value = false
    driveImportProgress.value = ''
  }
}

function confirmLargeFolderImport() {
  showLargeFolderWarning.value = false
  largeFolderConfirmed.value = true
  handleDriveImport()
}
</script>

<template>
  <BackButton />
  <div class="max-w-lg">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ $t('album.createNew') }}</h1>

    <!-- Tab Switcher -->
    <div class="flex border-b border-gray-200 dark:border-gray-700 mb-6">
      <button
        class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
        :class="activeTab === 'manual'
          ? 'border-orange-500 text-orange-600 dark:text-orange-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
        @click="activeTab = 'manual'"
      >
        {{ $t('album.createAlbum') }}
      </button>
      <button
        class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
        :class="activeTab === 'drive'
          ? 'border-orange-500 text-orange-600 dark:text-orange-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
        @click="activeTab = 'drive'"
      >
        <!-- Google Drive icon -->
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.71 3.5L1.15 15l3.43 5.96L11.14 9.46 7.71 3.5zm1.14 0l6.86 11.88H22.57L15.71 3.5H8.85zM15 12.96L11.57 19.5h13.29l3.43-5.96L15 12.96z" />
        </svg>
        {{ $t('drive.importFromDrive') }}
      </button>
    </div>

    <!-- Manual Create Tab -->
    <div v-if="activeTab === 'manual'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <AlbumForm :loading="loading" @submit="handleSubmit" @cancel="router.back()" />
    </div>

    <!-- Drive Import Tab -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <form @submit.prevent="handleDriveImport" class="space-y-5">
        <!-- Drive Folder Link -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('drive.folderLink') }}
          </label>
          <input
            v-model="driveLink"
            type="url"
            required
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white dark:bg-gray-700 dark:text-white"
            :placeholder="$t('drive.folderPlaceholder')"
          />
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {{ $t('drive.folderHint') }}
          </p>
        </div>

        <!-- Album Title (optional) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('album.albumName') }}
            <span class="text-gray-400 font-normal">({{ $t('drive.optionalAutoDetect') }})</span>
          </label>
          <input
            v-model="driveTitle"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white dark:bg-gray-700 dark:text-white"
            :placeholder="$t('album.albumNamePlaceholder')"
          />
        </div>

        <!-- Include Subfolders Toggle -->
        <div class="flex items-center justify-between">
          <div>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('drive.includeSubfolders') }}</span>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('drive.includeSubfoldersHint') }}</p>
          </div>
          <button
            type="button"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            :class="includeSubfolders ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'"
            @click="includeSubfolders = !includeSubfolders"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              :class="includeSubfolders ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>

        <!-- Large Folder Warning -->
        <div v-if="showLargeFolderWarning" class="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
          <p class="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
            {{ $t('drive.largeFolderWarning', { count: driveImportCount }) || `Folder chứa ${driveImportCount} ảnh. Quá trình import có thể mất nhiều thời gian.` }}
          </p>
          <div class="flex gap-2">
            <BaseButton variant="secondary" size="sm" @click="showLargeFolderWarning = false">{{ $t('common.cancel') }}</BaseButton>
            <BaseButton size="sm" @click="confirmLargeFolderImport">{{ $t('drive.continueImport') || 'Tiếp tục import' }}</BaseButton>
          </div>
        </div>

        <!-- Import Progress -->
        <div v-if="driveImporting" class="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4">
          <div class="flex items-center gap-3">
            <svg class="animate-spin h-5 w-5 text-orange-500" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span class="text-sm text-orange-700 dark:text-orange-300">{{ driveImportProgress }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-2">
          <BaseButton variant="secondary" type="button" @click="router.back()">{{ $t('common.cancel') }}</BaseButton>
          <BaseButton type="submit" :loading="driveImporting" :disabled="!driveLink.trim()">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15l3.43 5.96L11.14 9.46 7.71 3.5zm1.14 0l6.86 11.88H22.57L15.71 3.5H8.85zM15 12.96L11.57 19.5h13.29l3.43-5.96L15 12.96z" />
            </svg>
            {{ $t('drive.importButton') }}
          </BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>
