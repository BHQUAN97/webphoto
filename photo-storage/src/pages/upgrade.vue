<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import type { Plan, PaymentMethod } from '@/types'
import { formatVnd, cdnUrl } from '@/utils/format'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const auth = useAuthStore()
const plans = ref<Plan[]>([])
const methods = ref<PaymentMethod[]>([])
const loading = ref(true)

const showPayment = ref(false)
const selectedPlan = ref<Plan | null>(null)
const selectedMethodId = ref('')
const creating = ref(false)
const paymentResult = ref<{ paymentId: string; referenceCode: string; amount: number; method: any } | null>(null)

onMounted(async () => {
  try {
    const [plansRes, methodsRes] = await Promise.all([
      api.get('/plans').catch(() => ({ data: { plans: [] } })),
      api.get('/payment-methods').catch(() => ({ data: { methods: [] } })),
    ])
    const plansData = plansRes.data.plans ?? plansRes.data.data ?? plansRes.data
    plans.value = Array.isArray(plansData) ? plansData : []
    const methodsData = methodsRes.data.methods ?? methodsRes.data.data ?? methodsRes.data
    methods.value = Array.isArray(methodsData) ? methodsData : []
    if (methods.value.length > 0) {
      selectedMethodId.value = methods.value.find((m) => m.isDefault)?.id ?? methods.value[0].id
    }
  } catch {
    // silently fail
  } finally {
    loading.value = false
  }
})

function selectPlan(plan: Plan) {
  if (plan.priceVnd === 0) return
  selectedPlan.value = plan
  showPayment.value = true
  paymentResult.value = null
}

async function createPayment() {
  if (!selectedPlan.value) return
  creating.value = true
  try {
    const res = await api.post('/payments/create', {
      planCode: selectedPlan.value.code,
      paymentMethodId: selectedMethodId.value || undefined,
    })
    paymentResult.value = res.data
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Tạo đơn hàng thất bại')
  } finally {
    creating.value = false
  }
}

async function confirmTransfer(paymentId: string) {
  try {
    await api.post(`/payments/${paymentId}/confirm`, {})
    toast.success('Đã gửi xác nhận! Vui lòng chờ admin duyệt.')
    showPayment.value = false
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Xác nhận thất bại')
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-5xl mx-auto px-4 py-12">
      <h1 class="text-3xl font-bold text-center text-gray-900 mb-2">Bảng giá</h1>
      <p class="text-center text-gray-500 mb-10">Chọn gói phù hợp với nhu cầu của bạn</p>

      <div v-if="loading" class="text-center py-12 text-gray-400">Đang tải...</div>

      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          v-for="plan in plans"
          :key="plan.id"
          :class="[
            'bg-white rounded-xl shadow-sm border-2 p-6 relative',
            plan.code === 'pro' ? 'border-orange-500' : 'border-gray-200',
          ]"
        >
          <BaseBadge v-if="plan.code === 'pro'" variant="orange" class="absolute -top-3 left-1/2 -translate-x-1/2">
            Phổ biến
          </BaseBadge>
          <h3 class="text-lg font-semibold text-gray-900">{{ plan.name }}</h3>
          <div class="mt-4">
            <span class="text-3xl font-bold text-gray-900">{{ plan.priceVnd === 0 ? 'Miễn phí' : formatVnd(plan.priceVnd) }}</span>
            <span v-if="plan.priceVnd > 0" class="text-gray-500 text-sm">/{{ plan.durationDays <= 31 ? 'tháng' : 'năm' }}</span>
          </div>
          <ul class="mt-6 space-y-3 text-sm text-gray-600">
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              {{ plan.maxAlbums ? `${plan.maxAlbums} album` : 'Không giới hạn album' }}
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              Lưu trữ {{ plan.durationDays }} ngày
            </li>
            <li class="flex items-center gap-2">
              <svg :class="['w-4 h-4', plan.canDownload ? 'text-green-500' : 'text-gray-300']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              <span :class="!plan.canDownload ? 'text-gray-400' : ''">Download ảnh gốc</span>
            </li>
            <li class="flex items-center gap-2">
              <svg :class="['w-4 h-4', plan.canFilter ? 'text-green-500' : 'text-gray-300']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              <span :class="!plan.canFilter ? 'text-gray-400' : ''">Bộ lọc & tìm kiếm</span>
            </li>
            <li class="flex items-center gap-2">
              <svg :class="['w-4 h-4', plan.canEditPhoto ? 'text-green-500' : 'text-gray-300']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              <span :class="!plan.canEditPhoto ? 'text-gray-400' : ''">Chỉnh sửa ảnh</span>
            </li>
          </ul>
          <BaseButton
            :variant="plan.code === auth.planCode ? 'secondary' : 'primary'"
            class="w-full mt-6"
            :disabled="plan.code === auth.planCode || plan.priceVnd === 0"
            @click="selectPlan(plan)"
          >
            {{ plan.code === auth.planCode ? 'Gói hiện tại' : plan.priceVnd === 0 ? 'Miễn phí' : 'Nâng cấp' }}
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <BaseModal :show="showPayment" title="Thanh toán" max-width="lg" @close="showPayment = false">
      <template v-if="!paymentResult">
        <p class="text-sm text-gray-600 mb-4">
          Gói: <strong>{{ selectedPlan?.name }}</strong> — <strong>{{ formatVnd(selectedPlan?.priceVnd ?? 0) }}</strong>
        </p>
        <div v-if="methods.length > 0" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Phương thức thanh toán</label>
          <div class="space-y-2">
            <label
              v-for="m in methods"
              :key="m.id"
              class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
              :class="selectedMethodId === m.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'"
            >
              <input v-model="selectedMethodId" :value="m.id" type="radio" class="text-orange-500" />
              <span class="text-sm text-gray-700">{{ m.name }}</span>
            </label>
          </div>
        </div>
        <BaseButton :loading="creating" class="w-full" @click="createPayment">Tạo đơn hàng</BaseButton>
      </template>

      <template v-else>
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <p class="text-sm text-green-800 font-medium">Đơn hàng đã tạo thành công!</p>
        </div>
        <div class="space-y-3 text-sm">
          <p><strong>Số tiền:</strong> {{ formatVnd(paymentResult.amount) }}</p>
          <p><strong>Nội dung CK:</strong> <span class="font-mono bg-gray-100 px-2 py-1 rounded">{{ paymentResult.referenceCode }}</span></p>
          <div v-if="paymentResult.method?.config" class="bg-gray-50 rounded-lg p-4">
            <p v-if="paymentResult.method.config.bankName"><strong>Ngân hàng:</strong> {{ paymentResult.method.config.bankName }}</p>
            <p v-if="paymentResult.method.config.accountNo"><strong>Số TK:</strong> {{ paymentResult.method.config.accountNo }}</p>
            <p v-if="paymentResult.method.config.accountName"><strong>Chủ TK:</strong> {{ paymentResult.method.config.accountName }}</p>
            <p v-if="paymentResult.method.config.phone"><strong>SĐT:</strong> {{ paymentResult.method.config.phone }}</p>
            <div v-if="paymentResult.method.config.qrImageKey" class="mt-3">
              <p class="text-sm font-medium text-gray-700 mb-2">Quét mã QR:</p>
              <img :src="cdnUrl(paymentResult.method.config.qrImageKey)" class="w-48 h-48 object-contain border rounded-lg" alt="QR Code" />
            </div>
          </div>
        </div>
        <BaseButton class="w-full mt-4" @click="confirmTransfer(paymentResult!.paymentId)">
          Tôi đã chuyển khoản
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
