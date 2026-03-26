<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/utils/api'
import type { Voucher } from '@/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'

const { t } = useI18n()
const toast = useToast()
const vouchers = ref<Voucher[]>([])
const loading = ref(true)
const showCreate = ref(false)
const saving = ref(false)
const plans = ref<{ id: string; code: string; name: string }[]>([])

const form = ref({
  code: '',
  type: 'plan_activation' as 'plan_activation' | 'addon_storage' | 'addon_days',
  planId: '',
  durationDays: 30,
  addonBytes: '',
  maxUses: '',
  validUntil: '',
})

function resetForm() {
  form.value = { code: '', type: 'plan_activation', planId: '', durationDays: 30, addonBytes: '', maxUses: '', validUntil: '' }
}

async function fetchVouchers() {
  try {
    const res = await api.get('/admin/vouchers')
    vouchers.value = res.data.vouchers
  } catch { /* */ }
  finally { loading.value = false }
}

async function fetchPlans() {
  try {
    const res = await api.get('/admin/plans')
    plans.value = (res.data.plans ?? []).filter((p: any) => p.isActive)
  } catch { /* */ }
}

async function createVoucher() {
  if (!form.value.code.trim()) { toast.error(t('voucher.codeRequired')); return }
  saving.value = true
  try {
    await api.post('/admin/vouchers', {
      code: form.value.code,
      type: form.value.type,
      planId: form.value.planId || null,
      durationDays: form.value.durationDays,
      addonBytes: form.value.addonBytes ? Number(form.value.addonBytes) * 1024 * 1024 * 1024 : null,
      maxUses: form.value.maxUses ? Number(form.value.maxUses) : null,
      validUntil: form.value.validUntil || null,
    })
    toast.success(t('voucher.createSuccess'))
    showCreate.value = false
    resetForm()
    await fetchVouchers()
  } catch (err: any) {
    toast.error(err?.response?.data?.message || t('voucher.createFailed'))
  } finally { saving.value = false }
}

async function toggleActive(v: Voucher) {
  try {
    await api.patch(`/admin/vouchers/${v.id}`, { isActive: !v.isActive })
    v.isActive = !v.isActive
    toast.success(v.isActive ? t('voucher.activated') : t('voucher.deactivated'))
  } catch { toast.error(t('voucher.updateFailed')) }
}

async function deleteVoucher(v: Voucher) {
  if (!confirm(t('voucher.deleteConfirm', { code: v.code }))) return
  try {
    await api.delete(`/admin/vouchers/${v.id}`)
    vouchers.value = vouchers.value.filter(x => x.id !== v.id)
    toast.success(t('voucher.deleted'))
  } catch { toast.error(t('voucher.deleteFailed')) }
}

const typeLabels: Record<string, string> = {
  plan_activation: 'Kích hoạt gói',
  addon_storage: 'Thêm dung lượng',
  addon_days: 'Gia hạn ngày',
}

onMounted(async () => {
  await Promise.all([fetchVouchers(), fetchPlans()])
})
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ $t('voucher.title') }}</h1>
      <BaseButton @click="showCreate = true">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ $t('voucher.create') }}
      </BaseButton>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">{{ $t('common.loading') }}</div>

    <div v-else class="space-y-4">
      <!-- Active Vouchers -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('voucher.colCode') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('voucher.colType') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('voucher.colUsage') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('voucher.colDuration') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('voucher.colStatus') }}</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('voucher.colActions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="vouchers.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-gray-400">{{ $t('voucher.noVouchers') }}</td>
            </tr>
            <tr v-for="v in vouchers" :key="v.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td class="px-4 py-3">
                <code class="text-sm font-mono font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded">{{ v.code }}</code>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ typeLabels[v.type] ?? v.type }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                {{ v.usedCount }}<span v-if="v.maxUses"> / {{ v.maxUses }}</span>
                <span v-else class="text-gray-400"> / ∞</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {{ v.durationDays }} {{ $t('voucher.days') }}
                <span v-if="v.validUntil" class="block text-xs">{{ $t('voucher.expiredLabel') }} {{ formatDate(v.validUntil) }}</span>
              </td>
              <td class="px-4 py-3">
                <BaseBadge :variant="v.isActive ? 'success' : 'default'">
                  {{ v.isActive ? $t('voucher.active') : $t('voucher.inactive') }}
                </BaseBadge>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-1">
                  <button
                    class="text-xs px-2 py-1 rounded"
                    :class="v.isActive ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'"
                    @click="toggleActive(v)"
                  >
                    {{ v.isActive ? $t('voucher.disable') : $t('voucher.enable') }}
                  </button>
                  <button class="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" @click="deleteVoucher(v)">{{ $t('common.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Modal -->
    <BaseModal :show="showCreate" :title="$t('voucher.createNew')" @close="showCreate = false">
      <form class="space-y-4" @submit.prevent="createVoucher">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('voucher.code') }}</label>
          <input v-model="form.code" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm uppercase" placeholder="VD: WELCOME2024" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('voucher.typeLabel') }}</label>
          <select v-model="form.type" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm">
            <option value="plan_activation">{{ $t('voucher.typePlanActivation') }}</option>
            <option value="addon_storage">{{ $t('voucher.typeAddonStorage') }}</option>
            <option value="addon_days">{{ $t('voucher.typeAddonDays') }}</option>
          </select>
        </div>
        <div v-if="form.type === 'plan_activation'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('voucher.plan') }}</label>
          <select v-model="form.planId" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm">
            <option value="">{{ $t('voucher.selectPlan') }}</option>
            <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }} ({{ p.code }})</option>
          </select>
        </div>
        <div v-if="form.type === 'addon_storage'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('voucher.storageLabel') }}</label>
          <input v-model="form.addonBytes" type="number" min="1" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" placeholder="5" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('voucher.durationLabel') }}</label>
          <input v-model.number="form.durationDays" type="number" min="1" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('voucher.maxUsesLabel') }}</label>
            <input v-model="form.maxUses" type="number" min="1" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" placeholder="Không giới hạn" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('voucher.expiryLabel') }}</label>
            <input v-model="form.validUntil" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <BaseButton variant="secondary" type="button" @click="showCreate = false">{{ $t('common.cancel') }}</BaseButton>
          <BaseButton type="submit" :loading="saving">{{ $t('voucher.create') }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
