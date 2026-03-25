<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  show: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
})

const emit = defineEmits<{ close: [] }>()

const visible = ref(false)

const typeClasses: Record<string, string> = {
  success: 'bg-green-50 border-green-400 text-green-800',
  error: 'bg-red-50 border-red-400 text-red-800',
  warning: 'bg-yellow-50 border-yellow-400 text-yellow-800',
  info: 'bg-blue-50 border-blue-400 text-blue-800',
}

watch(() => props.show, (val) => {
  visible.value = val
  if (val && props.duration > 0) {
    setTimeout(() => {
      visible.value = false
      emit('close')
    }, props.duration)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-2"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="visible"
        :class="[
          'fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg border shadow-lg max-w-sm',
          typeClasses[type],
        ]"
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">{{ message }}</span>
          <button class="ml-2 opacity-60 hover:opacity-100" @click="visible = false; emit('close')">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
