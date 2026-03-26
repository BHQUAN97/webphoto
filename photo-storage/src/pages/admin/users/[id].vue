<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/utils/api'
import { formatBytes, formatVnd, formatDate } from '@/utils/format'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const userId = route.params.id as string

const user = ref<any>(null)
const loading = ref(true)
const showGrant = ref(false)
const grantPlan = ref('')
const grantDays = ref(30)
const granting = ref(false)

onMounted(async () => {
  try {
    const res = await api.get(`/admin/users/${userId}`)
    user.value = res.data
  } catch {
    router.push('/admin/users')
  } finally {
    loading.value = false
  }
})

async function grantPlanToUser() {
  granting.value = true
  try {
    await api.post(`/admin/users/${userId}/grant-plan`, { planCode: grantPlan.value, days: grantDays.value })
    showGrant.value = false
    const res = await api.get(`/admin/users/${userId}`)
    user.value = res.data
    toast.success('Tặng gói thành công')
  } catch {
    toast.error('Tặng gói thất bại')
  } finally {
    granting.value = false
  }
}
</script>

<template>
  <div>
    <BaseButton variant="ghost" size="sm" class="mb-4" @click="router.push('/admin/users')">
      &larr; Danh sách user
    </BaseButton>

    <div v-if="loading" class="text-center py-12 text-gray-400">Đang tải...</div>

    <template v-else-if="user">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ user.displayName }}</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ user.email }}</p>
            <div class="flex gap-2 mt-2">
              <BaseBadge :variant="user.isActive ? 'success' : 'danger'">{{ user.isActive ? 'Active' : 'Banned' }}</BaseBadge>
              <BaseBadge>{{ user.role }}</BaseBadge>
              <BaseBadge variant="orange">{{ user.planCode ?? 'free' }}</BaseBadge>
            </div>
          </div>
          <BaseButton size="sm" @click="showGrant = true">Tặng gói</BaseButton>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p class="text-sm text-gray-500 dark:text-gray-400">Storage</p>
          <p class="text-lg font-bold dark:text-white">{{ formatBytes(user.storageUsed ?? 0) }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p class="text-sm text-gray-500 dark:text-gray-400">Ảnh</p>
          <p class="text-lg font-bold dark:text-white">{{ user.imageCount ?? 0 }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p class="text-sm text-gray-500 dark:text-gray-400">Album</p>
          <p class="text-lg font-bold dark:text-white">{{ user.albumCount ?? 0 }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p class="text-sm text-gray-500 dark:text-gray-400">Ngày tạo</p>
          <p class="text-lg font-bold dark:text-white">{{ formatDate(user.createdAt) }}</p>
        </div>
      </div>

      <!-- Payment history -->
      <div v-if="user.payments?.length" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div class="px-4 py-3 border-b dark:border-gray-700"><h3 class="text-sm font-semibold dark:text-white">Lịch sử thanh toán</h3></div>
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Mã</th>
              <th class="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Số tiền</th>
              <th class="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Trạng thái</th>
              <th class="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Ngày</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="p in user.payments" :key="p.id">
              <td class="px-4 py-2 text-sm font-mono">{{ p.referenceCode }}</td>
              <td class="px-4 py-2 text-sm">{{ formatVnd(p.amountVnd) }}</td>
              <td class="px-4 py-2"><BaseBadge :variant="p.status === 'paid' ? 'success' : 'warning'">{{ p.status }}</BaseBadge></td>
              <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{{ formatDate(p.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Grant Plan Modal -->
    <BaseModal :show="showGrant" title="Tặng gói" max-width="sm" @close="showGrant = false">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gói</label>
          <select v-model="grantPlan" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white">
            <option value="basic">Cơ bản</option>
            <option value="pro">Pro</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Số ngày</label>
          <input v-model.number="grantDays" type="number" min="1" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
        </div>
        <BaseButton :loading="granting" class="w-full" @click="grantPlanToUser">Tặng gói</BaseButton>
      </div>
    </BaseModal>
  </div>
</template>
