<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BaseBadge from '@/components/ui/BaseBadge.vue'

const route = useRoute()
const auth = useAuthStore()

const planBadge: Record<string, { label: string; variant: 'default' | 'info' | 'orange' }> = {
  free: { label: 'Free', variant: 'default' },
  basic: { label: 'Cơ bản', variant: 'info' },
  pro: { label: 'Pro', variant: 'orange' },
}

const menu = [
  { to: '/dashboard', label: 'Tổng quan', exact: true, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/dashboard/albums', label: 'Album', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { to: '/dashboard/favorites', label: 'Yêu thích', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { to: '/dashboard/profile', label: 'Hồ sơ', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { to: '/dashboard/settings', label: 'Cài đặt', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

function isActive(item: typeof menu[number]) {
  if (item.exact) return route.path === item.to
  return route.path.startsWith(item.to)
}
</script>

<template>
  <aside class="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] p-4 dark:bg-gray-800 dark:border-gray-700">
    <!-- Plan badge -->
    <div class="mb-6 px-3 py-3 bg-gray-50 rounded-lg">
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-600">Gói hiện tại:</span>
        <BaseBadge :variant="planBadge[auth.planCode]?.variant ?? 'default'">
          {{ planBadge[auth.planCode]?.label ?? 'Free' }}
        </BaseBadge>
      </div>
      <router-link
        to="/upgrade"
        class="mt-2 block text-xs text-orange-500 hover:text-orange-600"
      >
        Nâng cấp &rarr;
      </router-link>
    </div>

    <!-- Navigation -->
    <nav class="space-y-1">
      <router-link
        v-for="item in menu"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors"
        :class="isActive(item) ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
        </svg>
        {{ item.label }}
      </router-link>
    </nav>
  </aside>
</template>
