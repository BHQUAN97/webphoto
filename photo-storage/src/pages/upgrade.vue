<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import type { Plan, PaymentMethod } from '@/types'
import { formatVnd, cdnUrl } from '@/utils/format'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
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

// Voucher
const voucherCode = ref('')
const activatingVoucher = ref(false)

// Plan card styling
const planStyles: Record<string, { border: string; badge: string; badgeText: string; button: string; glow: string }> = {
  free: {
    border: 'border-gray-700',
    badge: '',
    badgeText: '',
    button: 'bg-gray-700 hover:bg-gray-600 text-gray-300',
    glow: '',
  },
  basic: {
    border: 'border-emerald-500/50',
    badge: '',
    badgeText: '',
    button: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
    glow: '',
  },
  pro: {
    border: 'border-blue-500/50',
    badge: 'bg-blue-500',
    badgeText: 'pricing.popular',
    button: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20',
    glow: 'shadow-lg shadow-blue-500/10',
  },
  vip_pro: {
    border: 'border-orange-500/50',
    badge: 'bg-gradient-to-r from-orange-500 to-amber-500',
    badgeText: 'pricing.bestValue',
    button: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/20',
    glow: 'shadow-lg shadow-orange-500/10',
  },
}

function getStyle(code: string) {
  return planStyles[code] || planStyles.free
}

// Current plan info
const currentPlan = computed(() => {
  return plans.value.find((p) => p.code === auth.planCode)
})

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
    toast.error(e.response?.data?.message || t('pricing.createOrderFailed'))
  } finally {
    creating.value = false
  }
}

async function confirmTransfer(paymentId: string) {
  try {
    await api.post(`/payments/${paymentId}/confirm`, {})
    toast.success(t('pricing.confirmSent'))
    showPayment.value = false
  } catch (e: any) {
    toast.error(e.response?.data?.message || t('pricing.confirmFailed'))
  }
}

async function activateVoucher() {
  if (!voucherCode.value.trim()) return
  activatingVoucher.value = true
  try {
    await api.post('/vouchers/activate', { code: voucherCode.value.trim() })
    toast.success(t('pricing.voucherSuccess'))
    voucherCode.value = ''
    // Refresh user data
    await auth.fetchMe()
  } catch (e: any) {
    toast.error(e.response?.data?.message || t('pricing.voucherFailed'))
  } finally {
    activatingVoucher.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-950">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="text-3xl sm:text-4xl font-bold mb-3">
          <span class="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
            {{ $t('pricing.title') }}
          </span>
        </h1>
        <p class="text-gray-400 text-lg">{{ $t('pricing.subtitle') }}</p>
      </div>

      <!-- Current Plan Info + Voucher -->
      <div v-if="auth.isAuthenticated" class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <!-- Current Plan -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">{{ $t('pricing.yourCurrentPlan') }}</h3>
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl font-bold text-white">{{ currentPlan?.name || auth.planCode || 'Free' }}</span>
            <span class="px-2.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full">
              {{ $t('pricing.active') }}
            </span>
          </div>
          <div class="flex flex-wrap gap-2">
            <span v-if="currentPlan?.maxAlbums" class="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded-lg">
              {{ currentPlan.maxAlbums }} album
            </span>
            <span v-else class="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded-lg">
              {{ $t('pricing.unlimitedAlbums') }}
            </span>
            <span v-if="currentPlan?.canDownload" class="px-3 py-1 bg-emerald-500/15 text-emerald-400 text-xs rounded-lg">
              {{ $t('pricing.downloadOriginal') }}
            </span>
            <span v-if="currentPlan?.canFilter" class="px-3 py-1 bg-blue-500/15 text-blue-400 text-xs rounded-lg">
              {{ $t('pricing.filtersSearch') }}
            </span>
            <span v-if="currentPlan?.canEditPhoto" class="px-3 py-1 bg-purple-500/15 text-purple-400 text-xs rounded-lg">
              {{ $t('pricing.photoEditing') }}
            </span>
          </div>
        </div>

        <!-- Voucher -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">{{ $t('pricing.voucherTitle') }}</h3>
          <p class="text-gray-500 text-sm mb-4">{{ $t('pricing.voucherDesc') }}</p>
          <div class="flex gap-3">
            <input
              v-model="voucherCode"
              type="text"
              :placeholder="$t('pricing.voucherPlaceholder')"
              class="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
              @keyup.enter="activateVoucher"
            />
            <button
              :disabled="activatingVoucher || !voucherCode.trim()"
              class="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-xl text-sm hover:from-orange-400 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              @click="activateVoucher"
            >
              <svg v-if="activatingVoucher" class="animate-spin h-4 w-4 inline mr-1" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ $t('pricing.activate') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-16 text-gray-500">{{ $t('common.loading') }}</div>

      <!-- Pricing Cards -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          v-for="plan in plans"
          :key="plan.id"
          :class="[
            'relative bg-gray-900 rounded-2xl border-2 p-6 flex flex-col transition-all duration-300 hover:translate-y-[-4px]',
            getStyle(plan.code).border,
            getStyle(plan.code).glow,
          ]"
        >
          <!-- Badge -->
          <div
            v-if="getStyle(plan.code).badgeText"
            :class="[
              'absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-bold text-white rounded-full whitespace-nowrap',
              getStyle(plan.code).badge,
            ]"
          >
            {{ $t(getStyle(plan.code).badgeText) }}
          </div>

          <!-- Plan name -->
          <h3 class="text-lg font-semibold text-white mt-1">{{ plan.name }}</h3>

          <!-- Price -->
          <div class="mt-4 mb-6">
            <div v-if="plan.priceVnd === 0">
              <span class="text-3xl font-bold text-white">{{ $t('pricing.free') }}</span>
            </div>
            <div v-else>
              <span class="text-3xl font-bold text-white">{{ formatVnd(plan.priceVnd) }}</span>
              <span class="text-gray-500 text-sm ml-1">{{ plan.durationDays <= 31 ? $t('pricing.perMonth') : $t('pricing.perYear') }}</span>
            </div>
          </div>

          <!-- Feature checklist -->
          <ul class="space-y-3 text-sm flex-1 mb-6">
            <li class="flex items-center gap-2.5">
              <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-gray-300">
                {{ plan.maxAlbums ? `${plan.maxAlbums} album` : $t('pricing.unlimitedAlbums') }}
              </span>
            </li>
            <li class="flex items-center gap-2.5">
              <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-gray-300">{{ $t('pricing.storageDays', { days: plan.durationDays }) }}</span>
            </li>
            <li class="flex items-center gap-2.5">
              <svg
                :class="['w-4 h-4 shrink-0', plan.canDownload ? 'text-emerald-400' : 'text-gray-600']"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path v-if="plan.canDownload" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span :class="plan.canDownload ? 'text-gray-300' : 'text-gray-600'">{{ $t('pricing.downloadOriginal') }}</span>
            </li>
            <li class="flex items-center gap-2.5">
              <svg
                :class="['w-4 h-4 shrink-0', plan.canFilter ? 'text-emerald-400' : 'text-gray-600']"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path v-if="plan.canFilter" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span :class="plan.canFilter ? 'text-gray-300' : 'text-gray-600'">{{ $t('pricing.filtersSearch') }}</span>
            </li>
            <li class="flex items-center gap-2.5">
              <svg
                :class="['w-4 h-4 shrink-0', plan.canEditPhoto ? 'text-emerald-400' : 'text-gray-600']"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path v-if="plan.canEditPhoto" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span :class="plan.canEditPhoto ? 'text-gray-300' : 'text-gray-600'">{{ $t('pricing.photoEditing') }}</span>
            </li>
          </ul>

          <!-- CTA Button -->
          <button
            :class="[
              'w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300',
              plan.code === auth.planCode
                ? 'bg-gray-800 text-gray-400 cursor-default'
                : plan.priceVnd === 0
                  ? 'bg-gray-800 text-gray-400 cursor-default'
                  : getStyle(plan.code).button,
            ]"
            :disabled="plan.code === auth.planCode || plan.priceVnd === 0"
            @click="selectPlan(plan)"
          >
            {{ plan.code === auth.planCode ? $t('pricing.currentPlan') : plan.priceVnd === 0 ? $t('pricing.free') : $t('pricing.upgrade') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <BaseModal :show="showPayment" :title="$t('pricing.payment')" max-width="lg" @close="showPayment = false">
      <template v-if="!paymentResult">
        <p class="text-sm text-gray-600 mb-4">
          {{ $t('profile.plan') }}: <strong>{{ selectedPlan?.name }}</strong> — <strong>{{ formatVnd(selectedPlan?.priceVnd ?? 0) }}</strong>
        </p>
        <div v-if="methods.length > 0" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('pricing.paymentMethod') }}</label>
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
        <BaseButton :loading="creating" class="w-full" @click="createPayment">{{ $t('pricing.createOrder') }}</BaseButton>
      </template>

      <template v-else>
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <p class="text-sm text-green-800 font-medium">{{ $t('pricing.orderCreated') }}</p>
        </div>
        <div class="space-y-3 text-sm">
          <p><strong>{{ $t('pricing.orderAmount') }}</strong> {{ formatVnd(paymentResult.amount) }}</p>
          <p><strong>{{ $t('pricing.transferContent') }}</strong> <span class="font-mono bg-gray-100 px-2 py-1 rounded">{{ paymentResult.referenceCode }}</span></p>
          <div v-if="paymentResult.method?.config" class="bg-gray-50 rounded-lg p-4">
            <p v-if="paymentResult.method.config.bankName"><strong>{{ $t('pricing.bankName') }}</strong> {{ paymentResult.method.config.bankName }}</p>
            <p v-if="paymentResult.method.config.accountNo"><strong>{{ $t('pricing.accountNo') }}</strong> {{ paymentResult.method.config.accountNo }}</p>
            <p v-if="paymentResult.method.config.accountName"><strong>{{ $t('pricing.accountHolder') }}</strong> {{ paymentResult.method.config.accountName }}</p>
            <p v-if="paymentResult.method.config.phone"><strong>{{ $t('pricing.phone') }}</strong> {{ paymentResult.method.config.phone }}</p>
            <div v-if="paymentResult.method.config.qrImageKey" class="mt-3">
              <p class="text-sm font-medium text-gray-700 mb-2">{{ $t('pricing.scanQr') }}</p>
              <img :src="cdnUrl(paymentResult.method.config.qrImageKey)" class="w-48 h-48 object-contain border rounded-lg" alt="QR Code" />
            </div>
          </div>
        </div>
        <BaseButton class="w-full mt-4" @click="confirmTransfer(paymentResult!.paymentId)">
          {{ $t('pricing.confirmTransfer') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
