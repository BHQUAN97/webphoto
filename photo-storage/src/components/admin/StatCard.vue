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
  <div :class="['bg-white rounded-xl p-5 shadow-sm border', alert ? 'border-red-300' : 'border-gray-200']">
    <p class="text-sm text-gray-500">{{ label }}</p>
    <div class="flex items-end gap-2 mt-1">
      <p :class="['text-2xl font-bold', alert ? 'text-red-600' : 'text-gray-900']">{{ value }}</p>
      <span v-if="trend" class="text-xs text-green-600 font-medium mb-1">{{ trend }}</span>
    </div>
  </div>
</template>
