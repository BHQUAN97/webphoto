<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import { formatVnd, formatDate } from '@/utils/format'
import { debounce } from '@/utils/debounce'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const payments = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const filterStatus = ref('')
const totalRevenue = ref(0)

const showApprove = ref<any>(null)
const approveNote = ref('')
const approving = ref(false)
const showReject = ref<any>(null)
const rejectNote = ref('')
const debouncedFetch = debounce(fetchPayments, 300)
const rejecting = ref(false)

async function fetchPayments() {
  loading.value = true
  try {
    const res = await api.get('/admin/payments', { params: { search: search.value, status: filterStatus.value } })
    const data = res.data.items ?? res.data.data ?? res.data
    payments.value = Array.isArray(data) ? data : []
    totalRevenue.value = res.data.totalRevenue ?? 0
  } catch { /* */ } finally { loading.value = false }
}

async function approve() {
  if (!showApprove.value) return
  approving.value = true
  try {
    await api.post(`/admin/payments/${showApprove.value.id}/approve`, { adminNote: approveNote.value })
    showApprove.value.status = 'paid'
    showApprove.value = null
    approveNote.value = ''
    toast.success('Duyệt thành công')
  } catch { toast.error('Duyệt thất bại') }
  finally { approving.value = false }
}

async function reject() {
  if (!showReject.value) return
  rejecting.value = true
  try {
    await api.post(`/admin/payments/${showReject.value.id}/reject`, { adminNote: rejectNote.value })
    showReject.value.status = 'failed'
    showReject.value = null
    rejectNote.value = ''
    toast.success('Từ chối thành công')
  } catch { toast.error('Từ chối thất bại') }
  finally { rejecting.value = false }
}

async function exportCSV() {
  const res = await api.get('/admin/payments/export', { params: { status: filterStatus.value }, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'payments.csv'
  a.click()
}

const statusBadge: Record<string, { label: string; variant: 'warning' | 'success' | 'danger' | 'default' }> = {
  pending: { label: 'Chờ TT', variant: 'warning' },
  awaiting_confirm: { label: 'Chờ duyệt', variant: 'warning' },
  paid: { label: 'Đã TT', variant: 'success' },
  failed: { label: 'Thất bại', variant: 'danger' },
}

onMounted(fetchPayments)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Quản lý thanh toán</h1>
      <div class="flex gap-2">
        <span class="text-sm text-gray-500 self-center">Tổng: <strong>{{ formatVnd(totalRevenue) }}</strong></span>
        <BaseButton variant="secondary" size="sm" @click="exportCSV">Export CSV</BaseButton>
      </div>
    </div>
    <div class="flex gap-3 mb-4">
      <input v-model="search" type="text" placeholder="Mã tham chiếu / email..." class="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64" @input="debouncedFetch" />
      <select v-model="filterStatus" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" @change="fetchPayments">
        <option value="">Tất cả</option>
        <option value="pending">Chờ TT</option>
        <option value="awaiting_confirm">Chờ duyệt</option>
        <option value="paid">Đã TT</option>
        <option value="failed">Thất bại</option>
      </select>
    </div>
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Số tiền</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading"><td colspan="6" class="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
          <tr v-for="p in payments" :key="p.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm font-mono">{{ p.referenceCode }}</td>
            <td class="px-4 py-3 text-sm">{{ p.userName ?? p.userId }}</td>
            <td class="px-4 py-3 text-sm font-medium">{{ formatVnd(p.amountVnd) }}</td>
            <td class="px-4 py-3">
              <BaseBadge :variant="statusBadge[p.status]?.variant ?? 'default'">{{ statusBadge[p.status]?.label ?? p.status }}</BaseBadge>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(p.createdAt) }}</td>
            <td class="px-4 py-3">
              <div v-if="p.status === 'awaiting_confirm'" class="flex gap-2">
                <BaseButton size="sm" variant="primary" @click="showApprove = p">Duyệt</BaseButton>
                <BaseButton size="sm" variant="danger" @click="showReject = p">Từ chối</BaseButton>
              </div>
              <span v-else class="text-xs text-gray-400">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Approve Modal -->
    <BaseModal :show="!!showApprove" title="Duyệt thanh toán" max-width="sm" @close="showApprove = null">
      <p class="text-sm text-gray-600 mb-3">Đơn #{{ showApprove?.referenceCode }} — {{ formatVnd(showApprove?.amountVnd ?? 0) }}</p>
      <textarea v-model="approveNote" rows="2" placeholder="Ghi chú (tuỳ chọn)..." class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4" />
      <BaseButton :loading="approving" class="w-full" @click="approve">Xác nhận đã thanh toán</BaseButton>
    </BaseModal>

    <!-- Reject Modal -->
    <BaseModal :show="!!showReject" title="Từ chối thanh toán" max-width="sm" @close="showReject = null">
      <p class="text-sm text-gray-600 mb-3">Đơn #{{ showReject?.referenceCode }}</p>
      <textarea v-model="rejectNote" rows="2" placeholder="Lý do từ chối..." class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4" />
      <BaseButton variant="danger" :loading="rejecting" class="w-full" @click="reject">Từ chối</BaseButton>
    </BaseModal>
  </div>
</template>
