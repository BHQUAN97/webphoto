<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import type { SystemSettings } from '@/types'
import { formatBytes } from '@/utils/format'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/plugins/i18n'

const { t } = useI18n()
const toast = useToast()
const settings = ref<SystemSettings>({
  registration_open: true,
  max_upload_size_mb: 200,
  allowed_mime_types: [],
  storage_alert_threshold_percent: 80,
  image_error_spike_threshold: 20,
  worker_stuck_minutes: 30,
  storage_backend: 'r2',
  local_storage_dir: './data/storage',
})
const loading = ref(true)
const saving = ref(false)

const storageInfo = ref<{ backend: string; directory?: string; usedBytesPrivate?: number; usedBytesPublic?: number } | null>(null)
const loadingStorageInfo = ref(false)

// Admin info fields (QTHT)
const adminInfo = ref({
  admin_email: '',
  admin_name: '',
  app_developer: '',
  app_address: '',
  contact_zalo: '',
  contact_messenger: '',
})
const savingAdminInfo = ref(false)

// Google Drive config
const driveConfig = ref<{ configured: boolean; clientEmail?: string; projectId?: string; updatedAt?: string }>({ configured: false })
const driveJsonInput = ref('')
const savingDrive = ref(false)
const showDriveJson = ref(false)

// Tabs
const activeTab = ref<'general' | 'storage' | 'admin' | 'drive' | 'mail'>('general')
const tabs = [
  { key: 'general' as const, i18nKey: 'adminSettings.tabGeneral', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { key: 'storage' as const, i18nKey: 'adminSettings.tabStorage', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
  { key: 'admin' as const, i18nKey: 'adminSettings.tabAdmin', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { key: 'drive' as const, i18nKey: 'adminSettings.tabDrive', icon: 'M7.71 3.5L1.15 15l3.43 5.96L11.14 9.46 7.71 3.5zm1.14 0l6.86 11.88H22.57L15.71 3.5H8.85zM15 12.96L11.57 19.5h13.29l3.43-5.96L15 12.96z' },
  { key: 'mail' as const, i18nKey: 'adminSettings.tabMail', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
]

async function fetchDriveConfig() {
  try {
    const res = await api.get('/admin/settings/drive-config')
    driveConfig.value = res.data
  } catch { /* */ }
}

async function saveDriveConfig() {
  if (!driveJsonInput.value.trim()) {
    toast.error(t('adminSettings.driveJsonRequired'))
    return
  }
  savingDrive.value = true
  try {
    const res = await api.post('/admin/settings/drive-config', {
      serviceAccountJson: driveJsonInput.value.trim(),
    })
    driveConfig.value = {
      configured: true,
      clientEmail: res.data.clientEmail,
      projectId: res.data.projectId,
    }
    driveJsonInput.value = ''
    showDriveJson.value = false
    toast.success(t('adminSettings.driveConnectedSuccess', { email: res.data.clientEmail }))
  } catch (err: any) {
    toast.error(err?.response?.data?.message || t('adminSettings.saveFailed'))
  } finally {
    savingDrive.value = false
  }
}

// Mail test
const mailTemplates = [
  { value: 'order_new', label: 'Đơn hàng mới (order_new)' },
  { value: 'order_customer_confirm', label: 'Khách xác nhận CK (order_customer_confirm)' },
  { value: 'order_paid', label: 'Thanh toán thành công (order_paid)' },
  { value: 'order_failed', label: 'Đơn không thành công (order_failed)' },
  { value: 'order_reminder', label: 'Nhắc thanh toán (order_reminder)' },
  { value: 'register_welcome', label: 'Chào mừng đăng ký (register_welcome)' },
  { value: 'reset_password', label: 'Đặt lại mật khẩu (reset_password)' },
  { value: 'storage_warning', label: 'Cảnh báo dung lượng (storage_warning)' },
  { value: 'system_restart', label: 'Hệ thống khởi động (system_restart)' },
]
const testMailTemplate = ref('register_welcome')
const testMailEmail = ref('')
const sendingTestMail = ref(false)

const allMimeTypes = [
  'image/x-canon-cr2', 'image/x-sony-arw', 'image/x-nikon-nef', 'image/x-adobe-dng',
  'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
]

async function fetchStorageInfo() {
  loadingStorageInfo.value = true
  try {
    const res = await api.get('/admin/settings/storage-info')
    storageInfo.value = res.data
  } catch { /* */ }
  finally { loadingStorageInfo.value = false }
}

onMounted(async () => {
  try {
    const res = await api.get('/admin/settings')
    const data = res.data

    // Populate main settings
    settings.value = {
      registration_open: data.registration_open === 'true' || data.registration_open === true,
      max_upload_size_mb: Number(data.max_upload_size_mb) || 200,
      allowed_mime_types: typeof data.allowed_mime_types === 'string' ? JSON.parse(data.allowed_mime_types) : (data.allowed_mime_types ?? []),
      storage_alert_threshold_percent: Number(data.storage_alert_threshold_percent) || 80,
      image_error_spike_threshold: Number(data.image_error_spike_threshold) || 20,
      worker_stuck_minutes: Number(data.worker_stuck_minutes) || 30,
      storage_backend: data.storage_backend || 'r2',
      local_storage_dir: data.local_storage_dir || './data/storage',
    }

    // Populate admin info fields
    adminInfo.value = {
      admin_email: data.admin_email || '',
      admin_name: data.admin_name || '',
      app_developer: data.app_developer || '',
      app_address: data.app_address || '',
      contact_zalo: data.contact_zalo || '',
      contact_messenger: data.contact_messenger || '',
    }
  } catch { /* */ } finally { loading.value = false }

  await Promise.all([fetchStorageInfo(), fetchDriveConfig()])
})

async function save() {
  saving.value = true
  try {
    await api.patch('/admin/settings', settings.value)
    toast.success(t('adminSettings.saveSuccess'))
    await fetchStorageInfo()
  } catch { toast.error(t('adminSettings.saveFailed')) }
  finally { saving.value = false }
}

async function saveAdminInfo() {
  savingAdminInfo.value = true
  try {
    await api.patch('/admin/settings', adminInfo.value)
    toast.success(t('adminSettings.adminInfoSuccess'))
  } catch { toast.error(t('adminSettings.saveFailed')) }
  finally { savingAdminInfo.value = false }
}

async function sendTestMail() {
  if (!testMailEmail.value.trim()) {
    toast.error(t('adminSettings.recipientRequired'))
    return
  }
  sendingTestMail.value = true
  try {
    await api.post('/admin/settings/test-mail', {
      template: testMailTemplate.value,
      to: testMailEmail.value.trim(),
    })
    toast.success(t('adminSettings.testMailSuccess'))
  } catch (err: any) {
    toast.error(err?.response?.data?.message || t('adminSettings.testMailFailed'))
  } finally {
    sendingTestMail.value = false
  }
}

function toggleMime(mime: string) {
  const idx = settings.value.allowed_mime_types.indexOf(mime)
  if (idx >= 0) settings.value.allowed_mime_types.splice(idx, 1)
  else settings.value.allowed_mime_types.push(mime)
}
</script>

<template>
  <div class="max-w-3xl overflow-x-hidden">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ $t('adminSettings.title') }}</h1>

    <div v-if="loading" class="text-center py-12 text-gray-400">Đang tải...</div>

    <div v-else>
      <!-- Tab Navigation -->
      <div class="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px"
          :class="activeTab === tab.key
            ? 'border-orange-500 text-orange-600 dark:text-orange-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
          @click="activeTab = tab.key"
        >
          <svg v-if="tab.key !== 'drive'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
          </svg>
          <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path :d="tab.icon" />
          </svg>
          {{ $t(tab.i18nKey) }}
        </button>
      </div>

      <!-- Tab: General Settings -->
      <form v-if="activeTab === 'general'" class="space-y-6" @submit.prevent="save">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-900 dark:text-white">{{ $t('adminSettings.allowRegistration') }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('adminSettings.allowRegistrationDesc') }}</p>
            </div>
            <label class="relative inline-flex cursor-pointer">
              <input v-model="settings.registration_open" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-checked:bg-orange-500 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.maxUploadSize') }}</label>
            <input v-model.number="settings.max_upload_size_mb" type="number" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ $t('adminSettings.allowedMimeTypes') }}</label>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="mime in allMimeTypes"
                :key="mime"
                class="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg cursor-pointer text-sm transition-colors"
                :class="settings.allowed_mime_types.includes(mime)
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'"
              >
                <input :checked="settings.allowed_mime_types.includes(mime)" type="checkbox" class="hidden" @change="toggleMime(mime)" />
                {{ mime.split('/').pop() }}
              </label>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.storageAlertThreshold') }}</label>
            <input v-model.number="settings.storage_alert_threshold_percent" type="number" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.errorSpikeThreshold') }}</label>
            <input v-model.number="settings.image_error_spike_threshold" type="number" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.stuckJobTimeout') }}</label>
            <input v-model.number="settings.worker_stuck_minutes" type="number" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
          </div>

          <BaseButton type="submit" :loading="saving">{{ $t('adminSettings.saveSettings') }}</BaseButton>
        </div>
      </form>

      <!-- Tab: Storage Backend -->
      <form v-if="activeTab === 'storage'" class="space-y-6" @submit.prevent="save">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('adminSettings.storageBackend') }}</h2>

          <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <label
              class="flex-1 flex items-center gap-3 p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-colors"
              :class="settings.storage_backend === 'r2'
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 dark:border-gray-600'"
            >
              <input v-model="settings.storage_backend" type="radio" value="r2" class="text-orange-500 shrink-0" />
              <div class="min-w-0">
                <p class="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{{ $t('adminSettings.cloudflareR2') }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('adminSettings.cloudflareR2Desc') }}</p>
              </div>
            </label>
            <label
              class="flex-1 flex items-center gap-3 p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-colors"
              :class="settings.storage_backend === 'local'
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 dark:border-gray-600'"
            >
              <input v-model="settings.storage_backend" type="radio" value="local" class="text-orange-500 shrink-0" />
              <div class="min-w-0">
                <p class="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{{ $t('adminSettings.localFilesystem') }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('adminSettings.localFilesystemDesc') }}</p>
              </div>
            </label>
          </div>

          <div v-if="settings.storage_backend === 'local'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.storageDir') }}</label>
            <input v-model="settings.local_storage_dir" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm font-mono" placeholder="./data/storage" />
            <p class="text-xs text-gray-400 mt-1">{{ $t('adminSettings.storageDirHint') }}</p>
          </div>

          <!-- Storage Info Panel -->
          <div v-if="storageInfo" class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 space-y-2 overflow-hidden">
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span class="text-sm text-gray-500 dark:text-gray-400 shrink-0">{{ $t('adminSettings.currentBackend') }}</span>
              <span class="text-sm font-medium" :class="storageInfo.backend === 'r2' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'">
                {{ storageInfo.backend === 'r2' ? $t('adminSettings.cloudflareR2') : $t('adminSettings.localFilesystem') }}
              </span>
            </div>
            <div v-if="storageInfo.directory" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span class="text-sm text-gray-500 dark:text-gray-400 shrink-0">{{ $t('adminSettings.directory') }}</span>
              <span class="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">{{ storageInfo.directory }}</span>
            </div>
            <div v-if="storageInfo.usedBytesPrivate != null" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span class="text-sm text-gray-500 dark:text-gray-400 shrink-0">Private (originals):</span>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ formatBytes(storageInfo.usedBytesPrivate) }}</span>
            </div>
            <div v-if="storageInfo.usedBytesPublic != null" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span class="text-sm text-gray-500 dark:text-gray-400 shrink-0">Public (thumbs/previews):</span>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ formatBytes(storageInfo.usedBytesPublic) }}</span>
            </div>
          </div>

          <div v-if="settings.storage_backend !== storageInfo?.backend" class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 text-sm rounded-lg">
            {{ $t('adminSettings.backendChangeWarning') }}
          </div>

          <BaseButton type="submit" :loading="saving">{{ $t('adminSettings.saveStorage') }}</BaseButton>
        </div>
      </form>

      <!-- Tab: Admin Info -->
      <form v-if="activeTab === 'admin'" @submit.prevent="saveAdminInfo">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('adminSettings.adminInfo') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('adminSettings.adminInfoDesc') }}</p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.adminEmail') }}</label>
              <input v-model="adminInfo.admin_email" type="email" placeholder="admin@example.com" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.adminName') }}</label>
              <input v-model="adminInfo.admin_name" type="text" placeholder="Nguyen Van A" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.developer') }}</label>
              <input v-model="adminInfo.app_developer" type="text" placeholder="Tên công ty / cá nhân" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.address') }}</label>
              <input v-model="adminInfo.app_address" type="text" placeholder="123 Đường ABC, Quận XYZ" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.zalo') }}</label>
              <input v-model="adminInfo.contact_zalo" type="text" placeholder="0901234567 hoặc link Zalo" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.messenger') }}</label>
              <input v-model="adminInfo.contact_messenger" type="text" placeholder="https://m.me/username" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
            </div>
          </div>

          <BaseButton type="submit" :loading="savingAdminInfo">{{ $t('adminSettings.saveAdminInfo') }}</BaseButton>
        </div>
      </form>

      <!-- Tab: Google Drive -->
      <div v-if="activeTab === 'drive'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.71 3.5L1.15 15l3.43 5.96L11.14 9.46 7.71 3.5zm1.14 0l6.86 11.88H22.57L15.71 3.5H8.85zM15 12.96L11.57 19.5h13.29l3.43-5.96L15 12.96z" />
          </svg>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('adminSettings.tabDrive') }}</h2>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('adminSettings.driveDesc') }}</p>

        <!-- Status -->
        <div v-if="driveConfig.configured" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-sm font-medium text-green-700 dark:text-green-400">{{ $t('adminSettings.driveConnected') }}</span>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <p><span class="text-gray-500 dark:text-gray-400">{{ $t('adminSettings.driveServiceAccount') }}</span> <code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">{{ driveConfig.clientEmail }}</code></p>
            <p><span class="text-gray-500 dark:text-gray-400">{{ $t('adminSettings.driveProject') }}</span> {{ driveConfig.projectId }}</p>
          </div>
          <p class="text-xs text-gray-400 mt-2">
            {{ $t('adminSettings.driveShareHint') }}
          </p>
          <BaseButton variant="secondary" size="sm" @click="showDriveJson = !showDriveJson">
            {{ showDriveJson ? $t('adminSettings.driveHide') : $t('adminSettings.driveUpdateKey') }}
          </BaseButton>
        </div>

        <div v-else class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p class="text-sm text-yellow-700 dark:text-yellow-400 mb-2">{{ $t('adminSettings.driveNotConfigured') }}</p>
          <ol class="text-xs text-yellow-600 dark:text-yellow-500 space-y-1 list-decimal list-inside mb-3">
            <li>Vào <a href="https://console.cloud.google.com" target="_blank" class="underline">Google Cloud Console</a></li>
            <li>Tạo Project &rarr; Enable "Google Drive API"</li>
            <li>Tạo Service Account &rarr; Create Key (JSON) &rarr; Download</li>
            <li>Dán nội dung file JSON vào ô bên dưới</li>
          </ol>
        </div>

        <!-- JSON Input -->
        <div v-if="!driveConfig.configured || showDriveJson" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.driveJsonLabel') }}</label>
            <textarea
              v-model="driveJsonInput"
              rows="8"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-xs font-mono bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder='Dán nội dung file JSON tải từ Google Cloud Console...

{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "xxx@xxx.iam.gserviceaccount.com",
  ...
}'
            />
          </div>
          <BaseButton :loading="savingDrive" @click="saveDriveConfig">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {{ $t('adminSettings.driveSaveConnect') }}
          </BaseButton>
        </div>
      </div>

      <!-- Tab: Test Mail -->
      <div v-if="activeTab === 'mail'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('adminSettings.testMail') }}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('adminSettings.testMailDesc') }}</p>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.template') }}</label>
            <select v-model="testMailTemplate" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm">
              <option v-for="tpl in mailTemplates" :key="tpl.value" :value="tpl.value">{{ tpl.label }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('adminSettings.recipientEmail') }}</label>
            <input v-model="testMailEmail" type="email" placeholder="test@example.com" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
          </div>
          <BaseButton :loading="sendingTestMail" @click="sendTestMail">
            {{ $t('adminSettings.sendTest') }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
