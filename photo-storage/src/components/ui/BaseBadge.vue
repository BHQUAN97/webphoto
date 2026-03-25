<script setup lang="ts">
interface Props {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange'
  size?: 'sm' | 'md'
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'sm',
})

const variantClasses: Record<string, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  orange: 'bg-orange-100 text-orange-700',
}

const sizeClasses: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}
</script>

<template>
  <span
    :class="[
      'inline-flex items-center font-medium rounded-full',
      variantClasses[variant],
      sizeClasses[size],
    ]"
  >
    <slot />
  </span>
</template>
