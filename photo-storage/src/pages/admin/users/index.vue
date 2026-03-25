<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import { debounce } from '@/utils/debounce'
import { formatDate, formatBytes } from '@/utils/format'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseConfirm from '@/components/ui/BaseConfirm.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const users = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const filterPlan = ref('')
const filterStatus = ref('')
const deleteTarget = ref<string | null>(null)
const deleting = ref(false)

const debouncedFetch = debounce(fetchUsers, 300)

async function fetchUsers() {
  loading.value = true
  try {
    const res = await api.get('/admin/users', {
      params: { search: search.value, plan: filterPlan.value, status: filterStatus.value },
    })
    users.value = res.data.items ?? res.data.data ?? res.data
  } catch {
    // silently fail
  } finally {
    loading.value = false
  }
}

async function toggleActive(user: any) {
  await api.patch(`/admin/users/${user.id}`, { isActive: !user.isActive })
  user.isActive = !user.isActive
}

async function deleteUser() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.delete(`/admin/users/${deleteTarget.value}`)
    users.value = users.value.filter((u) => u.id !== deleteTarget.value)
    deleteTarget.value = null
    toast.success('Xóa thành công')
  } catch {
    toast.error('Xóa thất bại')
  } finally {
    deleting.value = false
  }
}

onMounted(fetchUsers)
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Quản lý người dùng</h1>

    <!-- Filters -->
    <div class="flex gap-3 mb-4">
      <input
        v-model="search"
        type="text"
        placeholder="Tìm tên / email..."
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 max-w-xs"
        @input="debouncedFetch"
      />
      <select v-model="filterPlan" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" @change="fetchUsers">
        <option value="">Tất cả gói</option>
        <option value="free">Free</option>
        <option value="basic">Cơ bản</option>
        <option value="pro">Pro</option>
      </select>
      <select v-model="filterStatus" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" @change="fetchUsers">
        <option value="">Tất cả</option>
        <option value="active">Active</option>
        <option value="banned">Banned</option>
      </select>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gói</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày tạo</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="7" class="px-4 py-8 text-center text-gray-400">Đang tải...</td>
          </tr>
          <tr v-for="u in users" :key="u.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ u.displayName }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ u.email }}</td>
            <td class="px-4 py-3">
              <BaseBadge :variant="u.planCode === 'pro' ? 'orange' : u.planCode === 'basic' ? 'info' : 'default'">
                {{ u.planCode ?? 'free' }}
              </BaseBadge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ formatBytes(u.storageUsed ?? 0) }}</td>
            <td class="px-4 py-3">
              <BaseBadge :variant="u.isActive ? 'success' : 'danger'">
                {{ u.isActive ? 'Active' : 'Banned' }}
              </BaseBadge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(u.createdAt) }}</td>
            <td class="px-4 py-3">
              <div class="flex gap-2">
                <router-link :to="`/admin/users/${u.id}`">
                  <BaseButton size="sm" variant="ghost">Xem</BaseButton>
                </router-link>
                <BaseButton size="sm" variant="ghost" @click="toggleActive(u)">
                  {{ u.isActive ? 'Khóa' : 'Mở' }}
                </BaseButton>
                <BaseButton size="sm" variant="ghost" class="!text-red-500" @click="deleteTarget = u.id">Xóa</BaseButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseConfirm
      :show="!!deleteTarget"
      title="Xóa tài khoản"
      message="Tất cả dữ liệu liên quan sẽ bị xóa vĩnh viễn. Tiếp tục?"
      :loading="deleting"
      @confirm="deleteUser"
      @cancel="deleteTarget = null"
    />
  </div>
</template>
