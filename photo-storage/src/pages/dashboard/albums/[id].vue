<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from '@/plugins/i18n'
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
import { formatBytes, formatDate, formatDateTime } from '@/utils/format'
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
const sharePermissions = ref({
  allowLike: true,
  allowComment: true,
  allowDownload: false,
})
const permissionsLoading = ref(false)
const shareUrl = computed(() => shareToken.value ? `${window.location.origin}/share/${shareToken.value}` : '')
const lightboxImage = ref<ImageItem | null>(null)
const lightboxIndex = ref(0)
const showDeleteImage = ref(false)
const deleteImageTarget = ref<ImageItem | null>(null)
const deleteImageLoading = ref(false)

// Batch selection state
const batchMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const batchLoading = ref(false)
const showBatchRename = ref(false)
const renamePattern = ref('')
const renameReplacement = ref('')

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
  selectedIds.value = new Set(selectedIds.value) // trigger reactivity
}
function selectAll() {
  if (selectedIds.value.size === images.value.length) selectedIds.value = new Set()
  else selectedIds.value = new Set(images.value.map(i => i.id))
}
function exitBatchMode() {
  batchMode.value = false
  selectedIds.value = new Set()
}

async function batchDelete() {
  if (selectedIds.value.size === 0) return
  if (!confirm(t('batch.deleteConfirm', { count: selectedIds.value.size }))) return
  batchLoading.value = true
  try {
    const res = await api.post('/images/batch', { action: 'delete', imageIds: [...selectedIds.value] })
    toast.success(t('batch.deleteSuccess', { count: res.data.affected }))
    images.value = images.value.filter(i => !selectedIds.value.has(i.id))
    if (album.value) album.value.imageCount = images.value.length
    exitBatchMode()
  } catch { toast.error(t('batch.deleteFailed')) }
  finally { batchLoading.value = false }
}

const showBatchDownloadChoice = ref(false)

async function batchDownload() {
  if (selectedIds.value.size === 0) return
  if (selectedIds.value.size === 1) {
    // Single file — download directly
    await batchDownloadSequential()
    return
  }
  // Multiple files — ask user
  showBatchDownloadChoice.value = true
}

async function batchDownloadZip() {
  showBatchDownloadChoice.value = false
  batchLoading.value = true
  toast.info(t('batch.downloadProcessing'))
  try {
    const res = await fetch('/api/images/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ action: 'download', imageIds: [...selectedIds.value] }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `selected_${selectedIds.value.size}_photos.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(t('batch.downloadSuccess', { count: selectedIds.value.size }))
  } catch { toast.error(t('batch.downloadFailed')) }
  finally { batchLoading.value = false }
}

async function batchDownloadSequential() {
  showBatchDownloadChoice.value = false
  batchLoading.value = true
  toast.info(t('batch.downloadProcessing'))
  let done = 0
  try {
    const ids = [...selectedIds.value]
    for (const id of ids) {
      const img = images.value.find(i => i.id === id)
      if (!img) continue
      try {
        const res = await api.get(`/images/${id}/download-url`)
        const blob = await fetch(res.data.url).then(r => r.blob())
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = img.originalName || 'image'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        done++
      } catch { /* skip failed */ }
    }
    toast.success(t('batch.downloadSuccess', { count: done }))
  } catch { toast.error(t('batch.downloadFailed')) }
  finally { batchLoading.value = false }
}

async function batchRename() {
  if (selectedIds.value.size === 0) return
  batchLoading.value = true
  try {
    const res = await api.post('/images/batch', {
      action: 'rename', imageIds: [...selectedIds.value],
      pattern: renamePattern.value || undefined,
      replacement: renameReplacement.value,
    })
    toast.success(t('batch.renameSuccess', { count: res.data.affected }))
    showBatchRename.value = false
    renamePattern.value = ''
    renameReplacement.value = ''
    exitBatchMode()
    await fetchAlbum()
  } catch { toast.error(t('batch.renameFailed')) }
  finally { batchLoading.value = false }
}

// Drive sync state
const driveSyncing = ref(false)

// Download ZIP state
const showDownloadOptions = ref(false)
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

async function handleEditAlbum(data: { title: string; description: string; isPublic: boolean; driveFolderId?: string | null }) {
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
    if (res.data.permissions) {
      sharePermissions.value = {
        allowLike: res.data.permissions.allowLike ?? true,
        allowComment: res.data.permissions.allowComment ?? true,
        allowDownload: res.data.permissions.allowDownload ?? false,
      }
    }
  } catch {
    shareToken.value = null
  }
}

async function updateSharePermissions() {
  permissionsLoading.value = true
  try {
    await api.patch(`/albums/${albumId.value}/share`, {
      allowLike: sharePermissions.value.allowLike,
      allowComment: sharePermissions.value.allowComment,
      allowDownload: sharePermissions.value.allowDownload,
    })
    toast.success(t('album.permissionsUpdated'))
  } catch {
    toast.error(t('album.permissionsUpdateFailed'))
  } finally {
    permissionsLoading.value = false
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

async function copyShareLink() {
  if (!shareToken.value) return
  const url = `${location.origin}/share/${shareToken.value}`
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = url
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
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

function openDownloadOptions() {
  if (!auth.canDownload) {
    toast.error(t('album.downloadRequirePlan'))
    return
  }
  showDownloadOptions.value = true
}

async function downloadFavorites() {
  showDownloadOptions.value = false
  const favImages = images.value.filter(i => i.liked)
  if (favImages.length === 0) {
    toast.error(t('album.noFavorites'))
    return
  }
  downloadLoading.value = true
  toast.info(t('album.downloadStarted'))
  try {
    const res = await fetch('/api/images/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ action: 'download', imageIds: favImages.map(i => i.id) }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${album.value?.title || 'album'}_favorites.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(t('album.downloadSuccess'))
  } catch { toast.error(t('album.downloadFailed')) }
  finally { downloadLoading.value = false }
}

async function downloadWithComments() {
  showDownloadOptions.value = false
  const commentedImages = images.value.filter(i => i.commentCount > 0)
  if (commentedImages.length === 0) {
    toast.error(t('album.noCommentedImages'))
    return
  }
  downloadLoading.value = true
  toast.info(t('album.downloadStarted'))
  try {
    const res = await fetch('/api/images/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ action: 'download', imageIds: commentedImages.map(i => i.id) }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${album.value?.title || 'album'}_commented.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(t('album.downloadSuccess'))
  } catch { toast.error(t('album.downloadFailed')) }
  finally { downloadLoading.value = false }
}

function downloadEditList() {
  showDownloadOptions.value = false
  const commentedImages = images.value.filter(i => i.commentCount > 0)
  if (commentedImages.length === 0) {
    toast.error(t('album.noCommentedImages'))
    return
  }
  const text = commentedImages
    .map((img, idx) => `${idx + 1}. ${img.originalName}`)
    .join('\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${album.value?.title || 'album'}_edit_list.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function downloadFullAlbum() {
  showDownloadOptions.value = false
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
          await streamDownloadZip(i)
        } catch (batchErr) {
          console.error(`[Download] Batch ${i} failed`, batchErr)
          toast.warning(`Batch ${i + 1}/${batches.length} thất bại, tiếp tục...`)
        }
      }
      showDownloadProgress.value = false
      toast.success(t('album.downloadSuccess'))
    } else {
      // Single batch — stream download (non-blocking)
      await streamDownloadZip()
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

async function streamDownloadZip(batch?: number) {
  // Use fetch with streaming — browser downloads progressively without loading all into memory
  const body = batch !== undefined ? JSON.stringify({ batch }) : '{}'
  const res = await fetch(`/api/albums/${albumId.value}/download-zip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}) },
    credentials: 'include',
    body,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const disposition = res.headers.get('content-disposition') || ''
  const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/)
  const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : `${album.value?.title || 'album'}.zip`

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function handleDriveResync() {
  if (!album.value?.driveFolderId) return
  driveSyncing.value = true
  try {
    const res = await api.post(`/albums/${albumId.value}/drive-sync`)
    toast.success(t('drive.resyncStarted', { count: res.data.newImages || 0 }))
    await fetchAlbum()
    startPolling()
  } catch {
    toast.error(t('drive.resyncFailed'))
  } finally {
    driveSyncing.value = false
  }
}

onMounted(fetchAlbum)
onUnmounted(stopPolling)
</script>

<template>
  <BackButton />
  <div v-if="loading" class="text-center py-12 text-gray-400">{{ $t('common.loading') }}</div>

  <div v-else-if="album">
    <!-- Header — compact layout -->
    <div class="mb-2">
      <!-- Title + Actions — single row -->
      <div class="flex items-center justify-between gap-2 mb-0.5">
        <div class="flex items-center gap-2 min-w-0">
          <h1 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">{{ album.title }}</h1>
          <BaseBadge :variant="album.isPublic ? 'success' : 'default'" class="text-[10px] leading-tight">
            {{ album.isPublic ? 'Public' : 'Private' }}
          </BaseBadge>
          <BaseBadge v-if="album.driveFolderId" variant="default" class="text-[10px] leading-tight">
            <svg class="w-3 h-3 inline mr-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15l3.43 5.96L11.14 9.46 7.71 3.5zm1.14 0l6.86 11.88H22.57L15.71 3.5H8.85zM15 12.96L11.57 19.5h13.29l3.43-5.96L15 12.96z" />
            </svg>
            Drive
          </BaseBadge>
        </div>
        <div class="flex gap-1 shrink-0">
          <button v-if="album.driveFolderId" class="p-1 lg:p-2 rounded-md text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors" :title="$t('drive.resync')" @click="handleDriveResync">
            <svg class="w-4 h-4 lg:w-6 lg:h-6" :class="{ 'animate-spin': driveSyncing }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button v-if="auth.canDownload" class="p-1 lg:p-2 rounded-md text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors" :title="$t('album.downloadAlbum')" @click="openDownloadOptions">
            <svg class="w-4 h-4 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button class="p-1 lg:p-2 rounded-md text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors" :title="$t('album.share')" @click="openShareDialog">
            <svg class="w-4 h-4 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          <button class="p-1 lg:p-2 rounded-md text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors" :title="$t('common.edit')" @click="showEdit = true">
            <svg class="w-4 h-4 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button class="p-1 lg:p-2 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" :title="$t('common.delete')" @click="showDelete = true">
            <svg class="w-4 h-4 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Meta row -->
      <div class="flex flex-wrap items-center gap-x-2 gap-y-0 text-[11px] text-gray-400 dark:text-gray-500">
        <span>{{ album.imageCount }} {{ $t('album.images') }}</span>
        <span>&middot;</span>
        <span>{{ formatBytes(album.totalBytes) }}</span>
        <span>&middot;</span>
        <span>{{ formatDate(album.createdAt) }}</span>
        <span v-if="album.description" class="text-gray-500 dark:text-gray-400 hidden sm:inline">&middot; {{ album.description }}</span>
        <template v-if="album.driveFolderId && album.driveLastSyncAt">
          <span>&middot;</span>
          <span>{{ $t('drive.lastSync') }}: {{ formatDateTime(album.driveLastSyncAt) }}</span>
        </template>
      </div>
    </div>

    <!-- Uploader -->
    <div class="mb-3">
      <ImageUploader :album-id="albumId" @uploaded="onUploaded" />
    </div>

    <!-- Filter + Batch Toggle -->
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <ImageFilterBar v-if="auth.canFilter" class="flex-1 min-w-0" @filter="handleFilter" />
      <BaseButton v-if="album?.userId === auth.user?.id && images.length > 0" variant="secondary" size="sm" @click="batchMode ? exitBatchMode() : (batchMode = true)">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {{ batchMode ? $t('batch.exitSelect') : $t('batch.selectMultiple') }}
      </BaseButton>
    </div>

    <!-- Batch Toolbar -->
    <div v-if="batchMode" class="flex flex-wrap items-center gap-2 mb-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
      <button class="text-sm text-orange-600 dark:text-orange-400 hover:underline" @click="selectAll">
        {{ selectedIds.size === images.length ? $t('batch.deselectAll') : $t('batch.selectAll') }}
      </button>
      <span class="text-sm text-gray-500 dark:text-gray-400">{{ selectedIds.size }} / {{ images.length }} {{ $t('batch.selected') }}</span>
      <div class="flex-1"></div>
      <BaseButton size="sm" variant="secondary" :disabled="selectedIds.size === 0" :loading="batchLoading" @click="batchDownload">
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {{ $t('batch.download') }} ({{ selectedIds.size }})
      </BaseButton>
      <BaseButton size="sm" variant="secondary" :disabled="selectedIds.size === 0" @click="showBatchRename = true">
        {{ $t('batch.rename') }}
      </BaseButton>
      <BaseButton size="sm" variant="danger" :disabled="selectedIds.size === 0" :loading="batchLoading" @click="batchDelete">
        {{ $t('batch.delete') }} ({{ selectedIds.size }})
      </BaseButton>
    </div>

    <!-- Images Grid -->
    <div v-if="images.length > 0" class="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4">
      <div v-for="img in images" :key="img.id" class="relative break-inside-avoid mb-4">
        <!-- Batch checkbox overlay -->
        <div v-if="batchMode" class="absolute top-2 left-2 z-10">
          <button
            class="w-6 h-6 rounded border-2 flex items-center justify-center transition-colors"
            :class="selectedIds.has(img.id) ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/80 border-gray-300 hover:border-orange-400'"
            @click.stop="toggleSelect(img.id)"
          >
            <svg v-if="selectedIds.has(img.id)" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
        <ImageCard
          :image="img"
          :show-like="auth.isAuthenticated && !batchMode"
          :show-delete="!batchMode && album?.userId === auth.user?.id"
          :show-set-cover="!batchMode && album?.userId === auth.user?.id"
          :class="{ 'ring-2 ring-orange-500 rounded-xl': batchMode && selectedIds.has(img.id) }"
          @click="batchMode ? toggleSelect(img.id) : (lightboxImage = img, lightboxIndex = images.indexOf(img))"
          @like="handleLike"
          @delete="confirmDeleteImage"
          @set-cover="setAsCover"
        />
      </div>
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

    <!-- Batch Download Choice Modal -->
    <BaseModal :show="showBatchDownloadChoice" :title="$t('batch.downloadChoiceTitle')" @close="showBatchDownloadChoice = false">
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('batch.downloadChoiceDesc', { count: selectedIds.size }) }}</p>
        <div class="flex flex-col gap-2">
          <BaseButton variant="primary" :loading="batchLoading" @click="batchDownloadZip">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {{ $t('batch.downloadAsZip') }}
          </BaseButton>
          <BaseButton variant="secondary" :loading="batchLoading" @click="batchDownloadSequential">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {{ $t('batch.downloadOneByOne') }}
          </BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Batch Rename Modal -->
    <BaseModal :show="showBatchRename" :title="$t('batch.renameTitle')" @close="showBatchRename = false">
      <form class="space-y-4" @submit.prevent="batchRename">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('batch.renameDesc', { count: selectedIds.size }) }}</p>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('batch.findPatternLabel') }}</label>
          <input v-model="renamePattern" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" placeholder="VD: IMG_" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('batch.replaceLabel') }}</label>
          <input v-model="renameReplacement" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" placeholder="VD: Wedding_" />
        </div>
        <p class="text-xs text-gray-400">{{ $t('batch.renameHint') }}</p>
        <div class="flex justify-end gap-3 pt-2">
          <BaseButton variant="secondary" type="button" @click="showBatchRename = false">{{ $t('common.cancel') }}</BaseButton>
          <BaseButton type="submit" :loading="batchLoading">{{ $t('batch.rename') }}</BaseButton>
        </div>
      </form>
    </BaseModal>

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

        <div v-if="shareToken" class="space-y-4">
          <div class="flex items-center gap-2">
            <input
              :value="shareUrl"
              readonly
              class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
              @click="($event.target as HTMLInputElement).select()"
            />
            <BaseButton variant="primary" size="sm" @click="copyShareLink">{{ $t('album.copyLink') }}</BaseButton>
          </div>

          <!-- Share Permissions -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ $t('album.sharePermissions') }}</h4>
            <div class="space-y-3">
              <!-- Allow Like -->
              <label class="flex items-center justify-between cursor-pointer">
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ $t('album.allowLike') }}</span>
                <button
                  type="button"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  :class="sharePermissions.allowLike ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'"
                  @click="sharePermissions.allowLike = !sharePermissions.allowLike; updateSharePermissions()"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    :class="sharePermissions.allowLike ? 'translate-x-6' : 'translate-x-1'"
                  />
                </button>
              </label>
              <!-- Allow Comment -->
              <label class="flex items-center justify-between cursor-pointer">
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ $t('album.allowComment') }}</span>
                <button
                  type="button"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  :class="sharePermissions.allowComment ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'"
                  @click="sharePermissions.allowComment = !sharePermissions.allowComment; updateSharePermissions()"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    :class="sharePermissions.allowComment ? 'translate-x-6' : 'translate-x-1'"
                  />
                </button>
              </label>
              <!-- Allow Download -->
              <label class="flex items-center justify-between cursor-pointer">
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ $t('album.allowDownload') }}</span>
                <button
                  type="button"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  :class="sharePermissions.allowDownload ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'"
                  @click="sharePermissions.allowDownload = !sharePermissions.allowDownload; updateSharePermissions()"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    :class="sharePermissions.allowDownload ? 'translate-x-6' : 'translate-x-1'"
                  />
                </button>
              </label>
            </div>
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

    <!-- Download Options Modal -->
    <BaseModal :show="showDownloadOptions" :title="$t('album.downloadOptions')" @close="showDownloadOptions = false">
      <div class="space-y-3">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('album.downloadOptionsDesc') }}</p>

        <!-- Favorites -->
        <button
          class="w-full flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors text-left"
          :disabled="downloadLoading"
          @click="downloadFavorites"
        >
          <div class="shrink-0 w-9 h-9 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ $t('album.downloadFavorites') }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('album.downloadFavoritesDesc') }}</div>
          </div>
        </button>

        <!-- With comments -->
        <button
          class="w-full flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors text-left"
          :disabled="downloadLoading"
          @click="downloadWithComments"
        >
          <div class="shrink-0 w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ $t('album.downloadWithComments') }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('album.downloadWithCommentsDesc') }}</div>
          </div>
        </button>

        <!-- Edit list TXT -->
        <button
          class="w-full flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors text-left"
          :disabled="downloadLoading"
          @click="downloadEditList"
        >
          <div class="shrink-0 w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ $t('album.downloadEditList') }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('album.downloadEditListDesc') }}</div>
          </div>
        </button>

        <!-- Full album -->
        <button
          class="w-full flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors text-left"
          :disabled="downloadLoading"
          @click="downloadFullAlbum"
        >
          <div class="shrink-0 w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ $t('album.downloadFullAlbum') }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('album.downloadFullAlbumDesc') }}</div>
          </div>
        </button>
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
