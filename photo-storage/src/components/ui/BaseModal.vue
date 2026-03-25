<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'

interface Props {
  show: boolean
  title?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  maxWidth: 'md',
})

const emit = defineEmits<{ close: [] }>()

const widthClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

watch(() => props.show, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
})

function onBackdrop() {
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="fixed inset-0 bg-black/50" @click="onBackdrop" />
        <div
          :class="[
            'relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full p-6 z-10',
            widthClasses[maxWidth],
          ]"
        >
          <div v-if="title" class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="emit('close')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
