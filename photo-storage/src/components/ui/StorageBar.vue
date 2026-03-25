<script setup lang="ts">
import { computed } from 'vue'
import { formatBytes } from '@/utils/format'

interface Props {
  usedBytes: string | number
  limitBytes: string | number
}

const props = defineProps<Props>()

const percent = computed(() => {
  const used = typeof props.usedBytes === 'string' ? Number(props.usedBytes) : props.usedBytes
  const limit = typeof props.limitBytes === 'string' ? Number(props.limitBytes) : props.limitBytes
  if (limit === 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
})

const barColor = computed(() => {
  if (percent.value >= 90) return 'bg-red-500'
  if (percent.value >= 80) return 'bg-yellow-500'
  return 'bg-orange-500'
})
</script>

<template>
  <div>
    <div class="flex justify-between text-sm mb-1">
      <span class="text-gray-600">{{ formatBytes(usedBytes) }} / {{ formatBytes(limitBytes) }}</span>
      <span :class="percent >= 80 ? 'text-red-600 font-medium' : 'text-gray-500'">{{ percent }}%</span>
    </div>
    <div class="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        :class="['h-full rounded-full transition-all duration-500', barColor]"
        :style="{ width: `${percent}%` }"
      />
    </div>
  </div>
</template>
