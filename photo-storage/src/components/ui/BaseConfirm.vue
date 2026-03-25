<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'

interface Props {
  show: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  title: 'Xác nhận',
  confirmText: 'Xác nhận',
  cancelText: 'Hủy',
  variant: 'danger',
  loading: false,
})

defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <BaseModal :show="show" :title="title" max-width="sm" @close="$emit('cancel')">
    <p class="text-sm text-gray-600 mb-6">{{ message }}</p>
    <div class="flex justify-end gap-3">
      <BaseButton variant="secondary" @click="$emit('cancel')">{{ cancelText }}</BaseButton>
      <BaseButton :variant="variant === 'danger' ? 'danger' : 'primary'" :loading="loading" @click="$emit('confirm')">
        {{ confirmText }}
      </BaseButton>
    </div>
  </BaseModal>
</template>
