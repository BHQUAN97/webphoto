<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import type { SystemSettings } from '@/types'
import { formatBytes } from '@/utils/format'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useToast } from '@/composables/useToast'

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

async function fetchDriveConfig() {
  try {
    const res = await api.get('/admin/settings/drive-config')
    driveConfig.value = res.data
  } catch { /* */ }
}

async function saveDriveConfig() {
  if (!driveJsonInput.value.trim()) {
    toast.error('Vui lòng dán nội dung Service Account JSON')
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
    toast.success(`Drive đã kết nối: ${res.data.clientEmail}`)
  } catch (err: any) {
    toast.error(err?.response?.data?.message || 'Lưu thất bại')
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
    toast.success('Lưu thành công')
    await fetchStorageInfo()
  } catch { toast.error('Lưu thất bại') }
  finally { saving.value = false }
}

async function saveAdminInfo() {
  savingAdminInfo.value = true
  try {
    await api.patch('/admin/settings', adminInfo.value)
    toast.success('Lưu thông tin quản trị thành công')
  } catch { toast.error('Lưu thất bại') }
  finally { savingAdminInfo.value = false }
}

async function sendTestMail() {
  if (!testMailEmail.value.trim()) {
    toast.error('Vui lòng nhập email người nhận')
    return
  }
  sendingTestMail.value = true
  try {
    await api.post('/admin/settings/test-mail', {
      template: testMailTemplate.value,
      to: testMailEmail.value.trim(),
    })
    toast.success('Đã gửi mail test thành công')
  } catch (err: any) {
    toast.error(err?.response?.data?.message || 'Gửi mail thất bại')
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
  <div class="max-w-2xl">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Cài đặt hệ thống</h1>

    <div v-if="loading" class="text-center py-12 text-gray-400">Đang tải...</div>

    <div v-else class="space-y-6">
      <!-- Storage Backend -->
      <form @submit.prevent="save" class="space-y-6">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Storage Backend</h2>

          <div class="flex gap-4">
            <label
              class="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors"
              :class="settings.storage_backend === 'r2' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'"
            >
              <input v-model="settings.storage_backend" type="radio" value="r2" class="text-orange-500" />
              <div>
                <p class="font-medium text-gray-900">Cloudflare R2</p>
                <p class="text-xs text-gray-500">Lưu trữ cloud, cần R2 credentials</p>
              </div>
            </label>
            <label
              class="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors"
              :class="settings.storage_backend === 'local' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'"
            >
              <input v-model="settings.storage_backend" type="radio" value="local" class="text-orange-500" />
              <div>
                <p class="font-medium text-gray-900">Local Filesystem</p>
                <p class="text-xs text-gray-500">Lưu trữ trên máy triển khai</p>
              </div>
            </label>
          </div>

          <div v-if="settings.storage_backend === 'local'">
            <label class="block text-sm font-medium text-gray-700 mb-1">Thư mục lưu trữ</label>
            <input v-model="settings.local_storage_dir" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" placeholder="./data/storage" />
            <p class="text-xs text-gray-400 mt-1">Đường dẫn tương đối từ thư mục server hoặc đường dẫn tuyệt đối</p>
          </div>

          <!-- Storage Info Panel -->
          <div v-if="storageInfo" class="bg-gray-50 rounded-lg p-4 space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">Backend hiện tại:</span>
              <span class="text-sm font-medium" :class="storageInfo.backend === 'r2' ? 'text-blue-600' : 'text-green-600'">
                {{ storageInfo.backend === 'r2' ? 'Cloudflare R2' : 'Local Filesystem' }}
              </span>
            </div>
            <div v-if="storageInfo.directory" class="flex items-center gap-2">
              <span class="text-sm text-gray-500">Thư mục:</span>
              <span class="text-sm font-mono text-gray-700">{{ storageInfo.directory }}</span>
            </div>
            <div v-if="storageInfo.usedBytesPrivate != null" class="flex items-center gap-2">
              <span class="text-sm text-gray-500">Private (originals):</span>
              <span class="text-sm font-medium text-gray-700">{{ formatBytes(storageInfo.usedBytesPrivate) }}</span>
            </div>
            <div v-if="storageInfo.usedBytesPublic != null" class="flex items-center gap-2">
              <span class="text-sm text-gray-500">Public (thumbs/previews):</span>
              <span class="text-sm font-medium text-gray-700">{{ formatBytes(storageInfo.usedBytesPublic) }}</span>
            </div>
          </div>

          <div v-if="settings.storage_backend !== storageInfo?.backend" class="p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-lg">
            Thay đổi backend sẽ không di chuyển file cũ. File đã lưu ở backend cũ sẽ không truy cập được từ backend mới.
          </div>
        </div>

        <!-- General Settings -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <h2 class="text-lg font-semibold text-gray-900">Cài đặt chung</h2>

          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-900">Cho phép đăng ký mới</p>
              <p class="text-sm text-gray-500">Tắt để ngừng nhận user mới</p>
            </div>
            <label class="relative inline-flex cursor-pointer">
              <input v-model="settings.registration_open" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-200 peer-checked:bg-orange-500 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Upload size tối đa (MB)</label>
            <input v-model.number="settings.max_upload_size_mb" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Định dạng file cho phép</label>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="mime in allMimeTypes"
                :key="mime"
                class="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg cursor-pointer text-sm"
                :class="settings.allowed_mime_types.includes(mime) ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600'"
              >
                <input :checked="settings.allowed_mime_types.includes(mime)" type="checkbox" class="hidden" @change="toggleMime(mime)" />
                {{ mime.split('/').pop() }}
              </label>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ngưỡng cảnh báo storage (%)</label>
            <input v-model.number="settings.storage_alert_threshold_percent" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ngưỡng spike lỗi ảnh (số/giờ)</label>
            <input v-model.number="settings.image_error_spike_threshold" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Stuck job timeout (phút)</label>
            <input v-model.number="settings.worker_stuck_minutes" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <BaseButton type="submit" :loading="saving">Lưu cài đặt</BaseButton>
        </div>
      </form>

      <!-- Admin Info (QTHT) -->
      <form @submit.prevent="saveAdminInfo">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Thông tin quản trị</h2>
          <p class="text-sm text-gray-500">Thông tin hiển thị trong email, footer và trang liên hệ.</p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email quản trị</label>
              <input v-model="adminInfo.admin_email" type="email" placeholder="admin@example.com" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tên quản trị viên</label>
              <input v-model="adminInfo.admin_name" type="text" placeholder="Nguyen Van A" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nhà phát triển</label>
              <input v-model="adminInfo.app_developer" type="text" placeholder="Tên công ty / cá nhân" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
              <input v-model="adminInfo.app_address" type="text" placeholder="123 Đường ABC, Quận XYZ" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Zalo liên hệ</label>
              <input v-model="adminInfo.contact_zalo" type="text" placeholder="0901234567 hoặc link Zalo" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Messenger liên hệ</label>
              <input v-model="adminInfo.contact_messenger" type="text" placeholder="https://m.me/username" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <BaseButton type="submit" :loading="savingAdminInfo">Lưu thông tin quản trị</BaseButton>
        </div>
      </form>

      <!-- Google Drive Integration -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.71 3.5L1.15 15l3.43 5.96L11.14 9.46 7.71 3.5zm1.14 0l6.86 11.88H22.57L15.71 3.5H8.85zM15 12.96L11.57 19.5h13.29l3.43-5.96L15 12.96z" />
          </svg>
          <h2 class="text-lg font-semibold text-gray-900">Google Drive</h2>
        </div>
        <p class="text-sm text-gray-500">Kết nối Google Drive để import ảnh từ folder Drive vào album.</p>

        <!-- Status -->
        <div v-if="driveConfig.configured" class="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-sm font-medium text-green-700">Đã kết nối</span>
          </div>
          <div class="text-sm text-gray-600 space-y-1">
            <p><span class="text-gray-500">Service Account:</span> <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{{ driveConfig.clientEmail }}</code></p>
            <p><span class="text-gray-500">Project:</span> {{ driveConfig.projectId }}</p>
          </div>
          <p class="text-xs text-gray-400 mt-2">
            Để import ảnh, hãy share folder Google Drive với email service account ở trên (quyền Viewer).
          </p>
          <BaseButton variant="secondary" size="sm" @click="showDriveJson = !showDriveJson">
            {{ showDriveJson ? 'Ẩn' : 'Cập nhật key mới' }}
          </BaseButton>
        </div>

        <div v-else class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p class="text-sm text-yellow-700 mb-2">Chưa cấu hình Google Drive. Cần Service Account JSON từ Google Cloud Console.</p>
          <ol class="text-xs text-yellow-600 space-y-1 list-decimal list-inside mb-3">
            <li>Vào <a href="https://console.cloud.google.com" target="_blank" class="underline">Google Cloud Console</a></li>
            <li>Tạo Project → Enable "Google Drive API"</li>
            <li>Tạo Service Account → Create Key (JSON) → Download</li>
            <li>Dán nội dung file JSON vào ô bên dưới</li>
          </ol>
        </div>

        <!-- JSON Input -->
        <div v-if="!driveConfig.configured || showDriveJson" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Service Account JSON</label>
            <textarea
              v-model="driveJsonInput"
              rows="8"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            Lưu và kết nối Drive
          </BaseButton>
        </div>
      </div>

      <!-- Test Mail -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Test gửi mail</h2>
        <p class="text-sm text-gray-500">Gửi mail test để kiểm tra cấu hình SMTP / Resend và xem trước template.</p>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Template</label>
            <select v-model="testMailTemplate" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option v-for="tpl in mailTemplates" :key="tpl.value" :value="tpl.value">{{ tpl.label }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email người nhận</label>
            <input v-model="testMailEmail" type="email" placeholder="test@example.com" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <BaseButton :loading="sendingTestMail" @click="sendTestMail">
            Gửi test
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
