<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/utils/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BackButton from '@/components/ui/BackButton.vue'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'

const { t } = useI18n()
const toast = useToast()
const loading = ref(true)
const referralCode = ref('')
const stats = ref({ totalReferred: 0, totalRewarded: 0, totalDaysEarned: 0 })
const referrals = ref<{ id: string; refereeDisplayName: string; rewardDays: number; rewarded: boolean; createdAt: string }[]>([])

const shareUrl = computed(() => referralCode.value ? `${window.location.origin}/register?ref=${referralCode.value}` : '')

function copyLink() {
  navigator.clipboard.writeText(shareUrl.value)
  toast.success(t('referral.linkCopied'))
}

function copyCode() {
  navigator.clipboard.writeText(referralCode.value)
  toast.success(t('referral.codeCopied'))
}

onMounted(async () => {
  try {
    const res = await api.get('/referrals/me')
    referralCode.value = res.data.referralCode ?? ''
    stats.value = res.data.stats
    referrals.value = res.data.referrals
  } catch { /* */ }
  finally { loading.value = false }
})
</script>

<template>
  <BackButton />
  <div class="max-w-2xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ $t('referral.title') }}</h1>

    <div v-if="loading" class="text-center py-12 text-gray-400">{{ $t('common.loading') }}</div>

    <div v-else class="space-y-6">
      <!-- Referral Code Card -->
      <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
        <h2 class="text-lg font-semibold mb-2">{{ $t('referral.codeTitle') }}</h2>
        <p class="text-sm text-orange-100 mb-4">{{ $t('referral.codeDesc') }}</p>
        <div class="flex items-center gap-3 mb-4">
          <code class="text-2xl font-bold tracking-widest bg-white/20 px-4 py-2 rounded-lg">{{ referralCode }}</code>
          <button @click="copyCode" class="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors" title="Copy mã">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            :value="shareUrl"
            readonly
            class="flex-1 px-3 py-2 bg-white/20 rounded-lg text-sm text-white placeholder-orange-200 truncate"
          />
          <BaseButton variant="secondary" @click="copyLink" class="shrink-0 !bg-white !text-orange-600 hover:!bg-orange-50">
            {{ $t('referral.copyLink') }}
          </BaseButton>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalReferred }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('referral.introduced') }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
          <p class="text-2xl font-bold text-green-600">{{ stats.totalRewarded }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('referral.rewarded') }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
          <p class="text-2xl font-bold text-orange-500">+{{ stats.totalDaysEarned }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('referral.vipDays') }}</p>
        </div>
      </div>

      <!-- Referral History -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 class="font-semibold text-gray-900 dark:text-white text-sm">{{ $t('referral.history') }}</h3>
        </div>
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('referral.colUser') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('referral.colReward') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('referral.colStatus') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ $t('referral.colDate') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="referrals.length === 0">
              <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-400">{{ $t('referral.noReferrals') }}</td>
            </tr>
            <tr v-for="r in referrals" :key="r.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ r.refereeDisplayName }}</td>
              <td class="px-4 py-3 text-sm text-orange-500 font-medium">+{{ r.rewardDays }} ngày</td>
              <td class="px-4 py-3">
                <BaseBadge :variant="r.rewarded ? 'success' : 'warning'">
                  {{ r.rewarded ? $t('referral.statusRewarded') : $t('referral.statusPending') }}
                </BaseBadge>
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ formatDate(r.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
