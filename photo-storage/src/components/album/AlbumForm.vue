<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Album } from '@/types'
import BaseButton from '@/components/ui/BaseButton.vue'

useI18n()

interface Props {
  album?: Album | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  album: null,
  loading: false,
})

const emit = defineEmits<{
  submit: [data: { title: string; description: string; isPublic: boolean; driveFolderId?: string | null }]
  cancel: []
}>()

const form = ref({
  title: '',
  description: '',
  isPublic: true,
})

const driveLink = ref('')
const isEditMode = computed(() => !!props.album)
const hasDrive = computed(() => !!props.album?.driveFolderId)
const showDriveInput = ref(false)

function extractFolderId(link: string): string | null {
  const match = link.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

watch(
  () => props.album,
  (a) => {
    if (a) {
      form.value = {
        title: a.title,
        description: a.description || '',
        isPublic: a.isPublic,
      }
      if (a.driveFolderId) {
        driveLink.value = `https://drive.google.com/drive/folders/${a.driveFolderId}`
        showDriveInput.value = true
      }
    }
  },
  { immediate: true },
)

function handleSubmit() {
  if (!form.value.title.trim()) return
  const data: { title: string; description: string; isPublic: boolean; driveFolderId?: string | null } = { ...form.value }
  // Send driveFolderId if Drive input is shown (either existing or newly added)
  if (showDriveInput.value && driveLink.value.trim()) {
    const newId = extractFolderId(driveLink.value)
    if (newId !== props.album?.driveFolderId) {
      data.driveFolderId = newId
    }
  } else if (hasDrive.value && !showDriveInput.value) {
    // User disabled Drive link — clear it
    data.driveFolderId = null
  }
  emit('submit', data)
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('album.albumName') }}</label>
      <input
        v-model="form.title"
        type="text"
        required
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
        :placeholder="$t('album.albumNamePlaceholder')"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('album.description') }}</label>
      <textarea
        v-model="form.description"
        rows="3"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
        :placeholder="$t('album.descriptionPlaceholder')"
      />
    </div>
    <div class="flex items-center gap-2">
      <input v-model="form.isPublic" type="checkbox" id="isPublic" class="rounded border-gray-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500" />
      <label for="isPublic" class="text-sm text-gray-700 dark:text-gray-300">{{ $t('album.isPublic') }}</label>
    </div>

    <!-- Google Drive folder — always available in edit mode -->
    <div v-if="isEditMode" class="pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between mb-2">
        <label class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <svg class="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.71 3.5L1.15 15l3.43 5.96L11.14 9.46 7.71 3.5zm1.14 0l6.86 11.88H22.57L15.71 3.5H8.85zM15 12.96L11.57 19.5h13.29l3.43-5.96L15 12.96z" />
          </svg>
          Google Drive Folder
        </label>
        <label v-if="!hasDrive" class="relative inline-flex cursor-pointer items-center">
          <input v-model="showDriveInput" type="checkbox" class="sr-only peer" />
          <div class="w-9 h-5 bg-gray-200 dark:bg-gray-600 peer-checked:bg-blue-500 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
        </label>
      </div>
      <div v-if="showDriveInput || hasDrive">
        <input
          v-model="driveLink"
          type="url"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
          placeholder="https://drive.google.com/drive/folders/..."
        />
        <p class="mt-1 text-xs text-gray-400">
          {{ hasDrive ? 'Thay đổi folder sẽ cập nhật nguồn đồng bộ Drive' : 'Dán link Google Drive folder để liên kết album' }}
        </p>
      </div>
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <BaseButton variant="secondary" type="button" @click="emit('cancel')">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" :loading="loading">
        {{ album ? $t('common.update') : $t('album.createAlbum') }}
      </BaseButton>
    </div>
  </form>
</template>
