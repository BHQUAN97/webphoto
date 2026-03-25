<script setup lang="ts">
interface Props {
  label: string
  value: string | number
  trend?: string
  alert?: boolean
}

withDefaults(defineProps<Props>(), {
  trend: '',
  alert: false,
})
</script>

<template>
  <div :class="['bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow-sm border', alert ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700']">
    <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{{ label }}</p>
    <div class="flex items-end gap-2 mt-1">
      <p :class="['text-xl sm:text-2xl font-bold', alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white']">{{ value }}</p>
      <span v-if="trend" class="text-xs text-green-600 font-medium mb-1">{{ trend }}</span>
    </div>
  </div>
</template>
