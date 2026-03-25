<script setup lang="ts">
interface Props {
  label: string
  value: string | number
  trend?: string
  alert?: boolean
  gradient?: string
  icon?: string
}

withDefaults(defineProps<Props>(), {
  trend: '',
  alert: false,
  gradient: '',
  icon: '',
})
</script>

<template>
  <!-- Gradient variant -->
  <div
    v-if="gradient"
    :class="[
      'relative overflow-hidden rounded-2xl p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5',
      gradient,
    ]"
  >
    <!-- Decorative circle -->
    <div class="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
    <div class="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5" />

    <!-- Icon top-right -->
    <div v-if="icon" class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
      <!-- Users -->
      <svg v-if="icon === 'users'" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
      <!-- User Plus -->
      <svg v-else-if="icon === 'user-plus'" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
      </svg>
      <!-- Currency -->
      <svg v-else-if="icon === 'currency'" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <!-- Photo -->
      <svg v-else-if="icon === 'photo'" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zm14.25-15.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
      <!-- Clock -->
      <svg v-else-if="icon === 'clock'" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <!-- Alert -->
      <svg v-else-if="icon === 'alert'" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <!-- Folder -->
      <svg v-else-if="icon === 'folder'" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    </div>

    <!-- Content -->
    <div class="relative z-10">
      <p class="text-sm font-medium text-white/80">{{ label }}</p>
      <p class="text-2xl sm:text-3xl font-bold text-white mt-1">{{ value }}</p>
      <span v-if="trend" class="inline-block mt-1 text-xs font-medium text-white/70 bg-white/15 rounded-full px-2 py-0.5">{{ trend }}</span>
    </div>
  </div>

  <!-- Legacy flat variant (no gradient) -->
  <div
    v-else
    :class="['bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow-sm border', alert ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700']"
  >
    <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{{ label }}</p>
    <div class="flex items-end gap-2 mt-1">
      <p :class="['text-xl sm:text-2xl font-bold', alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white']">{{ value }}</p>
      <span v-if="trend" class="text-xs text-green-600 font-medium mb-1">{{ trend }}</span>
    </div>
  </div>
</template>
