<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import type { Album, StorageInfo, Payment } from '@/types'
import { formatVnd, formatDate, cdnUrl } from '@/utils/format'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import StorageBar from '@/components/ui/StorageBar.vue'
import AlbumGrid from '@/components/album/AlbumGrid.vue'
import BackButton from '@/components/ui/BackButton.vue'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
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
    toast.error(t('profile.avatarOnlyFormats'))
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error(t('profile.avatarMaxSize'))
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
    toast.success(t('profile.avatarSuccess'))
  } catch {
    toast.error(t('profile.avatarFailed'))
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
    toast.success(t('profile.updateSuccess'))
  } catch {
    toast.error(t('profile.updateFailed'))
  } finally {
    saving.value = false
  }
}

const planBadge: Record<string, { label: string; variant: 'default' | 'info' | 'orange' }> = {
  free: { label: 'Free', variant: 'default' },
  basic: { label: t('sidebar.planBasic'), variant: 'info' },
  pro: { label: 'Pro', variant: 'orange' },
}

const paymentStatusBadge: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' }> = {
  pending: { label: t('paymentStatus.pending'), variant: 'warning' },
  awaiting_confirm: { label: t('paymentStatus.awaitingConfirm'), variant: 'warning' },
  paid: { label: t('paymentStatus.paid'), variant: 'success' },
  failed: { label: t('paymentStatus.failed'), variant: 'danger' },
}
</script>

<template>
  <BackButton />
  <div v-if="loading" class="text-center py-12 text-gray-400">{{ $t('common.loading') }}</div>

  <div v-else>
    <!-- Profile Header -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div class="flex items-start gap-4">
        <div class="relative group cursor-pointer" @click="avatarInput?.click()">
          <img
            :src="cdnUrl(auth.user?.avatarKey ?? null)"
            class="w-20 h-20 rounded-full object-cover bg-gray-200 dark:bg-gray-700"
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
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ auth.user?.displayName }}</h1>
              <BaseBadge :variant="planBadge[auth.planCode]?.variant ?? 'default'">
                {{ planBadge[auth.planCode]?.label ?? 'Free' }}
              </BaseBadge>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ auth.user?.email }}</p>
            <p v-if="auth.user?.bio" class="text-sm text-gray-600 dark:text-gray-400 mt-2">{{ auth.user.bio }}</p>
            <div class="flex flex-col sm:flex-row gap-2 mt-3">
              <BaseButton size="sm" variant="secondary" @click="editMode = true">{{ $t('profile.editProfile') }}</BaseButton>
              <router-link to="/upgrade">
                <BaseButton size="sm">{{ $t('profile.upgradePlan') }}</BaseButton>
              </router-link>
            </div>
          </template>
          <template v-else>
            <div class="space-y-3 max-w-md">
              <input
                v-model="form.displayName"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                :placeholder="$t('auth.displayName')"
              />
              <textarea
                v-model="form.bio"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                :placeholder="$t('profile.bio')"
              />
              <div class="flex gap-2">
                <BaseButton size="sm" :loading="saving" @click="saveProfile">{{ $t('common.save') }}</BaseButton>
                <BaseButton size="sm" variant="secondary" @click="editMode = false">{{ $t('common.cancel') }}</BaseButton>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('profile.totalImages') }}</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats.totalImages }}</p>
        <div class="flex gap-3 mt-1 text-xs">
          <span v-if="stats.processingImages" class="text-yellow-600">{{ stats.processingImages }} {{ $t('dashboard.processing') }}</span>
          <span v-if="stats.failedImages" class="text-red-600">{{ stats.failedImages }} {{ $t('common.error') }}</span>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('profile.storage') }}</p>
        <StorageBar :used-bytes="storage.usedBytes" :limit-bytes="storage.limitBytes" class="mt-2" />
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('profile.albumCount') }}</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ albums.length }}</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('profile.interactionsReceived') }}</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stats.totalLikes }} {{ $t('dashboard.like') }}</p>
        <p class="text-xs text-gray-400 mt-1">{{ stats.totalComments }} {{ $t('dashboard.comments') }}</p>
      </div>
    </div>

    <!-- Albums -->
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ $t('profile.myAlbums') }}</h2>
    <AlbumGrid :albums="albums" class="mb-8" />

    <!-- Payment History -->
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ $t('profile.paymentHistory') }}</h2>
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('profile.plan') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('profile.amount') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('profile.referenceCode') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('profile.status') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('profile.date') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="p in payments" :key="p.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ p.planName ?? '-' }}</td>
            <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ formatVnd(p.amountVnd) }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">{{ p.referenceCode }}</td>
            <td class="px-4 py-3">
              <BaseBadge :variant="paymentStatusBadge[p.status]?.variant ?? 'default'">
                {{ paymentStatusBadge[p.status]?.label ?? p.status }}
              </BaseBadge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(p.createdAt) }}</td>
          </tr>
          <tr v-if="payments.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">{{ $t('profile.noPayments') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
