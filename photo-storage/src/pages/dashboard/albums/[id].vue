<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUploadStore } from '@/stores/upload'
import api from '@/utils/api'
import type { Album, ImageItem } from '@/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseConfirm from '@/components/ui/BaseConfirm.vue'
import ImageCard from '@/components/image/ImageCard.vue'
import ImageUploader from '@/components/image/ImageUploader.vue'
import ImageLightbox from '@/components/image/ImageLightbox.vue'
import ImageFilterBar from '@/components/image/ImageFilterBar.vue'
import AlbumForm from '@/components/album/AlbumForm.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { formatBytes, formatDate } from '@/utils/format'
import BackButton from '@/components/ui/BackButton.vue'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const uploadStore = useUploadStore()
const albumId = computed(() => route.params.id as string)

const album = ref<Album | null>(null)
const images = ref<ImageItem[]>([])
const loading = ref(true)
const showEdit = ref(false)
const showDelete = ref(false)
const showShare = ref(false)
const editLoading = ref(false)
const deleteLoading = ref(false)
const shareToken = ref<string | null>(null)
const shareLoading = ref(false)
const shareUrl = computed(() => shareToken.value ? `${window.location.origin}/share/${shareToken.value}` : '')
const lightboxImage = ref<ImageItem | null>(null)
const lightboxIndex = ref(0)
const showDeleteImage = ref(false)
const deleteImageTarget = ref<ImageItem | null>(null)
const deleteImageLoading = ref(false)

// Download ZIP state
const downloadLoading = ref(false)
const showDownloadProgress = ref(false)
const downloadBatchTotal = ref(0)
const downloadBatchCurrent = ref(0)

async function fetchAlbum() {
  loading.value = true
  try {
    const [albumRes, imagesRes] = await Promise.all([
      api.get(`/albums/${albumId.value}`),
      api.get('/images', { params: { albumId: albumId.value, limit: 100 } }),
    ])
    album.value = albumRes.data
    images.value = imagesRes.data.items ?? imagesRes.data.data ?? imagesRes.data
  } catch {
    router.push('/dashboard/albums')
  } finally {
    loading.value = false
  }
}

async function handleFilter(filters: { liked: boolean; status: string; dateFrom: string; dateTo: string; sortBy: string; search: string }) {
  try {
    const res = await api.get('/images', { params: { albumId: albumId.value, ...filters, limit: 100 } })
    images.value = res.data.items ?? res.data.data ?? res.data
  } catch {
    // silently fail
  }
}

async function handleEditAlbum(data: { title: string; description: string; isPublic: boolean }) {
  editLoading.value = true
  try {
    const res = await api.patch(`/albums/${albumId.value}`, data)
    album.value = res.data
    showEdit.value = false
    toast.success(t('album.updateSuccess'))
  } catch {
    toast.error(t('album.updateFailed'))
  } finally {
    editLoading.value = false
  }
}

async function handleDeleteAlbum() {
  deleteLoading.value = true
  try {
    await api.delete(`/albums/${albumId.value}`)
    router.push('/dashboard/albums')
  } catch {
    toast.error(t('album.deleteFailed'))
  } finally {
    deleteLoading.value = false
  }
}

async function openShareDialog() {
  showShare.value = true
  try {
    const res = await api.get(`/albums/${albumId.value}/share`)
    shareToken.value = res.data.token
  } catch {
    shareToken.value = null
  }
}

async function generateShareLink() {
  shareLoading.value = true
  try {
    const res = await api.post(`/albums/${albumId.value}/share`)
    shareToken.value = res.data.token
    toast.success(t('album.shareCreated'))
  } catch {
    toast.error(t('album.shareFailed'))
  } finally {
    shareLoading.value = false
  }
}

async function revokeShareLink() {
  shareLoading.value = true
  try {
    await api.delete(`/albums/${albumId.value}/share`)
    shareToken.value = null
    toast.success(t('album.shareRevoked'))
  } catch {
    toast.error(t('album.revokeShareFailed'))
  } finally {
    shareLoading.value = false
  }
}

function copyShareLink() {
  if (!shareToken.value) return
  const url = `${location.origin}/share/${shareToken.value}`
  navigator.clipboard.writeText(url)
  toast.success(t('album.linkCopied'))
}

function confirmDeleteImage(image: ImageItem) {
  deleteImageTarget.value = image
  showDeleteImage.value = true
  lightboxImage.value = null
}

async function handleDeleteImage() {
  if (!deleteImageTarget.value) return
  deleteImageLoading.value = true
  try {
    await api.delete(`/images/${deleteImageTarget.value.id}`)
    images.value = images.value.filter(i => i.id !== deleteImageTarget.value!.id)
    if (album.value) album.value.imageCount--
    showDeleteImage.value = false
    deleteImageTarget.value = null
    toast.success(t('image.deleted'))
  } catch {
    toast.error(t('image.deleteFailed'))
  } finally {
    deleteImageLoading.value = false
  }
}

async function setAsCover(image: ImageItem) {
  if (!image.thumbUrl) return
  try {
    // Extract key from thumbUrl (remove CDN prefix)
    const cdnPrefix = import.meta.env.VITE_CDN_URL || ''
    const thumbKey = cdnPrefix ? image.thumbUrl.replace(cdnPrefix + '/', '') : image.thumbUrl
    await api.patch(`/albums/${albumId.value}`, { coverKey: thumbKey })
    if (album.value) album.value.coverKey = thumbKey
    toast.success(t('album.coverSet'))
  } catch {
    toast.error(t('album.coverFailed'))
  }
}

async function handleLike(image: ImageItem) {
  try {
    if (image.liked) {
      await api.delete(`/images/${image.id}/like`)
      image.liked = false
      image.likeCount--
    } else {
      await api.post(`/images/${image.id}/like`)
      image.liked = true
      image.likeCount++
    }
  } catch {
    // silently fail
  }
}

// Poll for processing images to update when ready (fallback if socket fails)
let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    const hasProcessing = images.value.some(i => i.status === 'processing') ||
      uploadStore.files.some(f => f.status === 'processing')
    if (!hasProcessing) {
      stopPolling()
      return
    }
    try {
      const res = await api.get('/images', { params: { albumId: albumId.value, limit: 100 } })
      const newImages = res.data.items ?? res.data.data ?? res.data
      // Check if any image transitioned to ready
      for (const img of newImages) {
        const old = images.value.find(i => i.id === img.id)
        if (old?.status === 'processing' && img.status === 'ready') {
          // Update upload store status too
          const uploadFile = uploadStore.files.find(f => f.imageId === img.id)
          if (uploadFile) uploadStore.setStatus(uploadFile.id, 'ready')
        }
      }
      images.value = newImages
    } catch { /* ignore */ }
  }, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function onUploaded() {
  await fetchAlbum()
  startPolling()
}

async function handleDownloadZip() {
  if (!auth.canDownload) {
    toast.error(t('album.downloadRequirePlan'))
    return
  }
  downloadLoading.value = true
  toast.info(t('album.downloadStarted'))

  try {
    // Check mode: multi-batch or single
    const checkRes = await api.post(`/albums/${albumId.value}/download-zip`, {}, { timeout: 0 })

    if (checkRes.data.mode === 'multi-batch') {
      const { batches } = checkRes.data
      showDownloadProgress.value = true
      downloadBatchTotal.value = batches.length
      downloadBatchCurrent.value = 0

      for (let i = 0; i < batches.length; i++) {
        downloadBatchCurrent.value = i + 1
        try {
          const res = await api.post(
            `/albums/${albumId.value}/download-zip`,
            { batch: i },
            { responseType: 'blob', timeout: 0 }
          )
          triggerBlobDownload(res.data, res.headers)
        } catch (batchErr) {
          console.error(`[Download] Batch ${i} failed`, batchErr)
          toast.warning(`Batch ${i + 1}/${batches.length} thất bại, tiếp tục...`)
        }
      }
      showDownloadProgress.value = false
      toast.success(t('album.downloadSuccess'))
    } else {
      // Single batch — download directly as blob
      const res = await api.post(
        `/albums/${albumId.value}/download-zip`,
        {},
        { responseType: 'blob', timeout: 0 }
      )
      triggerBlobDownload(res.data, res.headers)
      toast.success(t('album.downloadSuccess'))
    }
  } catch (err: unknown) {
    showDownloadProgress.value = false
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 403) {
      toast.error(t('album.downloadRequirePlan'))
    } else if (status === 400) {
      toast.error(t('album.downloadNoImages'))
    } else {
      toast.error(t('album.downloadFailed'))
    }
  } finally {
    downloadLoading.value = false
  }
}

function triggerBlobDownload(blob: Blob, headers: Record<string, unknown>) {
  const disposition = String(headers['content-disposition'] || '')
  const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/)
  const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : `${album.value?.title || 'album'}.zip`

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

onMounted(fetchAlbum)
onUnmounted(stopPolling)
</script>

<template>
  <BackButton />
  <div v-if="loading" class="text-center py-12 text-gray-400">{{ $t('common.loading') }}</div>

  <div v-else-if="album">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div class="min-w-0">
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{{ album.title }}</h1>
          <BaseBadge :variant="album.isPublic ? 'success' : 'default'">
            {{ album.isPublic ? 'Public' : 'Private' }}
          </BaseBadge>
        </div>
        <p v-if="album.description" class="text-sm text-gray-500 mt-1">{{ album.description }}</p>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400 mt-2">
          <span>{{ album.imageCount }} {{ $t('album.images') }}</span>
          <span>{{ formatBytes(album.totalBytes) }}</span>
          <span>{{ formatDate(album.createdAt) }}</span>
        </div>
      </div>
      <div class="flex gap-2 shrink-0 flex-wrap">
        <BaseButton v-if="auth.canDownload" variant="secondary" size="sm" :loading="downloadLoading" @click="handleDownloadZip">
          <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {{ $t('album.downloadAlbum') }}
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="openShareDialog">
          <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {{ $t('album.share') }}
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="showEdit = true">{{ $t('common.edit') }}</BaseButton>
        <BaseButton variant="danger" size="sm" @click="showDelete = true">{{ $t('common.delete') }}</BaseButton>
      </div>
    </div>

    <!-- Uploader -->
    <div class="mb-6">
      <ImageUploader :album-id="albumId" @uploaded="onUploaded" />
    </div>

    <!-- Filter -->
    <ImageFilterBar v-if="auth.canFilter" @filter="handleFilter" />

    <!-- Images Grid -->
    <div v-if="images.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <ImageCard
        v-for="img in images"
        :key="img.id"
        :image="img"
        :show-like="auth.isAuthenticated"
        :show-delete="album?.userId === auth.user?.id"
        :show-set-cover="album?.userId === auth.user?.id"
        @click="lightboxImage = img; lightboxIndex = images.indexOf(img)"
        @like="handleLike"
        @delete="confirmDeleteImage"
        @set-cover="setAsCover"
      />
    </div>
    <div v-else class="text-center py-12 text-gray-400">
      <p>{{ $t('album.noImages') }}</p>
    </div>

    <!-- Lightbox -->
    <ImageLightbox
      :image="lightboxImage"
      :images="images"
      :current-index="lightboxIndex"
      :show="!!lightboxImage"
      :can-delete="album?.userId === auth.user?.id"
      @close="lightboxImage = null"
      @like="handleLike"
      @delete="confirmDeleteImage"
      @navigate="(idx: number) => { lightboxIndex = idx; lightboxImage = images[idx] }"
    />

    <!-- Edit Modal -->
    <BaseModal :show="showEdit" :title="$t('album.editAlbum')" @close="showEdit = false">
      <AlbumForm :album="album" :loading="editLoading" @submit="handleEditAlbum" @cancel="showEdit = false" />
    </BaseModal>

    <!-- Delete Album Confirm -->
    <BaseConfirm
      :show="showDelete"
      :title="$t('album.deleteAlbum')"
      :message="$t('album.deleteAlbumConfirm')"
      :confirm-text="$t('common.delete')"
      :loading="deleteLoading"
      @confirm="handleDeleteAlbum"
      @cancel="showDelete = false"
    />

    <!-- Delete Image Confirm -->
    <BaseConfirm
      :show="showDeleteImage"
      :title="$t('image.deleteImage')"
      :message="$t('image.deleteConfirm', { name: deleteImageTarget?.originalName })"
      :confirm-text="$t('common.delete')"
      :loading="deleteImageLoading"
      @confirm="handleDeleteImage"
      @cancel="showDeleteImage = false"
    />

    <!-- Share Modal -->
    <BaseModal :show="showShare" :title="$t('album.shareAlbum')" @close="showShare = false">
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('album.shareDesc') }}
        </p>

        <div v-if="shareToken" class="space-y-3">
          <div class="flex items-center gap-2">
            <input
              :value="shareUrl"
              readonly
              class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
              @click="($event.target as HTMLInputElement).select()"
            />
            <BaseButton variant="primary" size="sm" @click="copyShareLink">{{ $t('album.copyLink') }}</BaseButton>
          </div>
          <BaseButton variant="danger" size="sm" :loading="shareLoading" @click="revokeShareLink">
            {{ $t('album.revokeShareLink') }}
          </BaseButton>
        </div>

        <div v-else>
          <BaseButton variant="primary" :loading="shareLoading" @click="generateShareLink">
            {{ $t('album.createShareLink') }}
          </BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Download ZIP Progress Modal -->
    <BaseModal :show="showDownloadProgress" :title="$t('album.downloadAlbum')" @close="() => {}">
      <div class="space-y-4 text-center">
        <div class="flex justify-center">
          <svg class="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('album.downloadZipProgress', { current: downloadBatchCurrent, total: downloadBatchTotal }) }}
        </p>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            class="bg-blue-500 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${downloadBatchTotal > 0 ? (downloadBatchCurrent / downloadBatchTotal) * 100 : 0}%` }"
          ></div>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
