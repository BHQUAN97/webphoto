<script setup lang="ts">
defineProps<{
  level: 'error' | 'warning'
  message: string
}>()

defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div
    :class="[
      'flex items-center justify-between px-4 py-3 rounded-lg mb-3',
      level === 'error' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800',
    ]"
  >
    <div class="flex items-center gap-2">
      <svg v-if="level === 'error'" class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <svg v-else class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <span class="text-sm font-medium">{{ message }}</span>
    </div>
    <button class="text-gray-400 hover:text-gray-600" @click="$emit('dismiss')">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
