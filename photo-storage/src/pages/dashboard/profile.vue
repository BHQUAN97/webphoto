<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import type { Album, StorageInfo, Payment } from '@/types'
import { formatVnd, formatDate, cdnUrl } from '@/utils/format'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import StorageBar from '@/components/ui/StorageBar.vue'
import AlbumGrid from '@/components/album/AlbumGrid.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const auth = useAuthStore()

const storage = ref<StorageInfo>({ usedBytes: '0', limitBytes: '5368709120' })
const stats = ref({ totalImages: 0, processingImages: 0, failedImages: 0, totalLikes: 0, totalComments: 0 })
const albums = ref<Album[]>([])
const payments = ref<Payment[]>([])
const loading = ref(true)

const editMode = ref(false)
const form = ref({ displayName: '', bio: '' })
const saving = ref(false)
const uploadingAvatar = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)

async function uploadAvatar(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    toast.error('Chỉ hỗ trợ JPEG, PNG, WebP')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Ảnh tối đa 5MB')
    return
  }
  uploadingAvatar.value = true
  try {
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.readAsDataURL(file)
    })
    const { data } = await api.post('/users/me/avatar', { mimeType: file.type, data: base64 })
    await auth.updateProfile({ avatarKey: data.key } as any)
    await auth.fetchMe()
    toast.success('Cập nhật avatar thành công')
  } catch {
    toast.error('Upload avatar thất bại')
  } finally {
    uploadingAvatar.value = false
  }
}

onMounted(async () => {
  try {
    const [storageRes, statsRes, albumsRes, paymentsRes] = await Promise.all([
      api.get('/users/me/storage'),
      api.get('/users/me/stats'),
      api.get('/users/me/albums'),
      api.get('/users/me/payments'),
    ])
    storage.value = storageRes.data
    stats.value = statsRes.data
    albums.value = albumsRes.data.data ?? albumsRes.data
    payments.value = paymentsRes.data.data ?? paymentsRes.data
  } catch {
    // silently fail
  } finally {
    loading.value = false
  }

  if (auth.user) {
    form.value = { displayName: auth.user.displayName, bio: auth.user.bio ?? '' }
  }
})

async function saveProfile() {
  saving.value = true
  try {
    await auth.updateProfile(form.value)
    editMode.value = false
    toast.success('Cập nhật thành công')
  } catch {
    toast.error('Cập nhật thất bại')
  } finally {
    saving.value = false
  }
}

const planBadge: Record<string, { label: string; variant: 'default' | 'info' | 'orange' }> = {
  free: { label: 'Free', variant: 'default' },
  basic: { label: 'Cơ bản', variant: 'info' },
  pro: { label: 'Pro', variant: 'orange' },
}

const paymentStatusBadge: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Chờ thanh toán', variant: 'warning' },
  awaiting_confirm: { label: 'Chờ xác nhận', variant: 'warning' },
  paid: { label: 'Đã thanh toán', variant: 'success' },
  failed: { label: 'Thất bại', variant: 'danger' },
}
</script>

<template>
  <div v-if="loading" class="text-center py-12 text-gray-400">Đang tải...</div>

  <div v-else>
    <!-- Profile Header -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex items-start gap-4">
        <div class="relative group cursor-pointer" @click="avatarInput?.click()">
          <img
            :src="cdnUrl(auth.user?.avatarKey ?? null)"
            class="w-20 h-20 rounded-full object-cover bg-gray-200"
            alt=""
          />
          <div class="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg v-if="!uploadingAvatar" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <svg v-else class="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
          <input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="uploadAvatar" />
        </div>
        <div class="flex-1">
          <template v-if="!editMode">
            <div class="flex items-center gap-3">
              <h1 class="text-xl font-bold text-gray-900">{{ auth.user?.displayName }}</h1>
              <BaseBadge :variant="planBadge[auth.planCode]?.variant ?? 'default'">
                {{ planBadge[auth.planCode]?.label ?? 'Free' }}
              </BaseBadge>
            </div>
            <p class="text-sm text-gray-500 mt-1">{{ auth.user?.email }}</p>
            <p v-if="auth.user?.bio" class="text-sm text-gray-600 mt-2">{{ auth.user.bio }}</p>
            <div class="flex gap-2 mt-3">
              <BaseButton size="sm" variant="secondary" @click="editMode = true">Chỉnh sửa</BaseButton>
              <router-link to="/upgrade">
                <BaseButton size="sm">Nâng cấp gói</BaseButton>
              </router-link>
            </div>
          </template>
          <template v-else>
            <div class="space-y-3 max-w-md">
              <input
                v-model="form.displayName"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Tên hiển thị"
              />
              <textarea
                v-model="form.bio"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Bio..."
              />
              <div class="flex gap-2">
                <BaseButton size="sm" :loading="saving" @click="saveProfile">Lưu</BaseButton>
                <BaseButton size="sm" variant="secondary" @click="editMode = false">Hủy</BaseButton>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <p class="text-sm text-gray-500">Tổng ảnh</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats.totalImages }}</p>
        <div class="flex gap-3 mt-1 text-xs">
          <span v-if="stats.processingImages" class="text-yellow-600">{{ stats.processingImages }} đang xử lý</span>
          <span v-if="stats.failedImages" class="text-red-600">{{ stats.failedImages }} lỗi</span>
        </div>
      </div>
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <p class="text-sm text-gray-500">Dung lượng</p>
        <StorageBar :used-bytes="storage.usedBytes" :limit-bytes="storage.limitBytes" class="mt-2" />
      </div>
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <p class="text-sm text-gray-500">Số album</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ albums.length }}</p>
      </div>
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <p class="text-sm text-gray-500">Tương tác nhận được</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats.totalLikes }} like</p>
        <p class="text-xs text-gray-400 mt-1">{{ stats.totalComments }} bình luận</p>
      </div>
    </div>

    <!-- Albums -->
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Album của tôi</h2>
    <AlbumGrid :albums="albums" class="mb-8" />

    <!-- Payment History -->
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Lịch sử thanh toán</h2>
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gói</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Số tiền</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã tham chiếu</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="p in payments" :key="p.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-700">{{ p.planName ?? '-' }}</td>
            <td class="px-4 py-3 text-sm text-gray-700">{{ formatVnd(p.amountVnd) }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 font-mono">{{ p.referenceCode }}</td>
            <td class="px-4 py-3">
              <BaseBadge :variant="paymentStatusBadge[p.status]?.variant ?? 'default'">
                {{ paymentStatusBadge[p.status]?.label ?? p.status }}
              </BaseBadge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(p.createdAt) }}</td>
          </tr>
          <tr v-if="payments.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Chưa có giao dịch</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
