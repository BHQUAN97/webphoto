<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import type { Plan } from '@/types'
import { formatVnd, formatBytes } from '@/utils/format'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const plans = ref<Plan[]>([])
const loading = ref(true)
const showForm = ref(false)
const editingPlan = ref<Plan | null>(null)
const saving = ref(false)

const form = ref({
  code: '', name: '', priceVnd: 0, durationDays: 30,
  quotaBytes: '5368709120', maxAlbums: 5 as number | null,
  canDownload: false, canFilter: false, canEditPhoto: false,
  sortOrder: 0,
})

async function fetchPlans() {
  try {
    const res = await api.get('/admin/plans')
    plans.value = res.data.plans ?? res.data.data ?? res.data
  } catch { /* */ } finally { loading.value = false }
}

function openCreate() {
  editingPlan.value = null
  form.value = { code: '', name: '', priceVnd: 0, durationDays: 30, quotaBytes: '5368709120', maxAlbums: 5, canDownload: false, canFilter: false, canEditPhoto: false, sortOrder: 0 }
  showForm.value = true
}

function openEdit(plan: Plan) {
  editingPlan.value = plan
  form.value = { code: plan.code, name: plan.name, priceVnd: plan.priceVnd, durationDays: plan.durationDays, quotaBytes: plan.quotaBytes, maxAlbums: plan.maxAlbums, canDownload: plan.canDownload, canFilter: plan.canFilter, canEditPhoto: plan.canEditPhoto, sortOrder: plan.sortOrder }
  showForm.value = true
}

async function savePlan() {
  saving.value = true
  try {
    if (editingPlan.value) {
      await api.patch(`/admin/plans/${editingPlan.value.id}`, form.value)
    } else {
      await api.post('/admin/plans', form.value)
    }
    showForm.value = false
    await fetchPlans()
    toast.success('Lưu thành công')
  } catch { toast.error('Lưu thất bại') }
  finally { saving.value = false }
}

onMounted(fetchPlans)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Quản lý gói dịch vụ</h1>
      <BaseButton @click="openCreate">Tạo gói mới</BaseButton>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="p in plans" :key="p.id" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-900 dark:text-white">{{ p.name }}</h3>
          <BaseBadge :variant="p.isActive ? 'success' : 'default'">{{ p.isActive ? 'Active' : 'Inactive' }}</BaseBadge>
        </div>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ p.priceVnd === 0 ? 'Miễn phí' : formatVnd(p.priceVnd) }}</p>
        <ul class="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li>{{ p.maxAlbums ?? '∞' }} album</li>
          <li>{{ p.durationDays }} ngày</li>
          <li>Quota: {{ formatBytes(p.quotaBytes) }}</li>
          <li>Download: {{ p.canDownload ? 'Có' : 'Không' }}</li>
          <li>Filter: {{ p.canFilter ? 'Có' : 'Không' }}</li>
          <li>Edit photo: {{ p.canEditPhoto ? 'Có' : 'Không' }}</li>
        </ul>
        <BaseButton variant="secondary" size="sm" class="mt-4" @click="openEdit(p)">Sửa</BaseButton>
      </div>
    </div>

    <BaseModal :show="showForm" :title="editingPlan ? 'Sửa gói' : 'Tạo gói'" max-width="lg" @close="showForm = false">
      <form class="grid grid-cols-2 gap-4" @submit.prevent="savePlan">
        <div><label class="block text-sm font-medium mb-1 dark:text-gray-300">Code</label><input v-model="form.code" :disabled="!!editingPlan" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" /></div>
        <div><label class="block text-sm font-medium mb-1 dark:text-gray-300">Tên</label><input v-model="form.name" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" /></div>
        <div><label class="block text-sm font-medium mb-1 dark:text-gray-300">Giá (VNĐ)</label><input v-model.number="form.priceVnd" type="number" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" /></div>
        <div><label class="block text-sm font-medium mb-1 dark:text-gray-300">Thời hạn (ngày)</label><input v-model.number="form.durationDays" type="number" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" /></div>
        <div><label class="block text-sm font-medium mb-1 dark:text-gray-300">Quota (bytes)</label><input v-model="form.quotaBytes" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" /></div>
        <div><label class="block text-sm font-medium mb-1 dark:text-gray-300">Max album</label><input v-model.number="form.maxAlbums" type="number" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" placeholder="Để trống = unlimited" /></div>
        <div class="col-span-2 flex gap-6">
          <label class="flex items-center gap-2 text-sm"><input v-model="form.canDownload" type="checkbox" /> Download</label>
          <label class="flex items-center gap-2 text-sm"><input v-model="form.canFilter" type="checkbox" /> Bộ lọc</label>
          <label class="flex items-center gap-2 text-sm"><input v-model="form.canEditPhoto" type="checkbox" /> Chỉnh ảnh</label>
        </div>
        <div class="col-span-2 flex justify-end gap-3">
          <BaseButton variant="secondary" type="button" @click="showForm = false">Hủy</BaseButton>
          <BaseButton type="submit" :loading="saving">Lưu</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
