<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '@/plugins/i18n'

const { t } = useI18n()
const emit = defineEmits<{ navigate: [] }>()
const route = useRoute()

const menu = computed(() => [
  { to: '/admin', label: t('adminNav.dashboard'), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', exact: true },
  { to: '/admin/users', label: t('adminNav.users'), icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { to: '/admin/albums', label: t('adminNav.albums'), icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { to: '/admin/payments', label: t('adminNav.payments'), icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { to: '/admin/plans', label: t('adminNav.plans'), icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { to: '/admin/payment-methods', label: t('adminNav.paymentMethods'), icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { to: '/admin/vouchers', label: 'Voucher', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
  { to: '/admin/settings', label: t('adminNav.settings'), icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  { to: '/admin/logs', label: t('adminNav.logs'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
])

function isActive(item: typeof menu.value[number]) {
  if (item.exact) return route.path === item.to
  return route.path.startsWith(item.to)
}
</script>

<template>
  <aside class="w-64 bg-gray-900 h-[calc(100vh-4rem)] overflow-y-auto p-4">
    <div class="mb-6 px-3">
      <h2 class="text-lg font-bold text-white">Admin Panel</h2>
      <p class="text-xs text-gray-400 mt-1">{{ $t('adminNav.systemManagement') }}</p>
    </div>

    <nav class="space-y-1">
      <router-link
        v-for="item in menu"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors"
        :class="isActive(item) ? 'bg-orange-600 text-white font-medium' : 'text-gray-300 hover:bg-gray-800 hover:text-white'"
        @click="emit('navigate')"
      >
        <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
        </svg>
        {{ item.label }}
      </router-link>
    </nav>

    <!-- Back to dashboard -->
    <div class="mt-8 pt-4 border-t border-gray-700">
      <router-link
        to="/dashboard"
        class="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white"
        @click="emit('navigate')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {{ $t('adminNav.backToDashboard') }}
      </router-link>
    </div>
  </aside>
</template>
