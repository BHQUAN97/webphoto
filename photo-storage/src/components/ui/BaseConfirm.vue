<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'

useI18n()

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
  title: undefined,
  confirmText: undefined,
  cancelText: undefined,
  variant: 'danger',
  loading: false,
})

defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <BaseModal :show="show" :title="title ?? $t('common.confirm')" max-width="sm" @close="$emit('cancel')">
    <p class="text-sm text-gray-600 mb-6">{{ message }}</p>
    <div class="flex justify-end gap-3">
      <BaseButton variant="secondary" @click="$emit('cancel')">{{ cancelText ?? $t('common.cancel') }}</BaseButton>
      <BaseButton :variant="variant === 'danger' ? 'danger' : 'primary'" :loading="loading" @click="$emit('confirm')">
        {{ confirmText ?? $t('common.confirm') }}
      </BaseButton>
    </div>
  </BaseModal>
</template>
