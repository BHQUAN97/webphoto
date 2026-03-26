<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import BaseButton from '@/components/ui/BaseButton.vue'
import BackButton from '@/components/ui/BackButton.vue'

const { t } = useI18n()
const auth = useAuthStore()

const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordError = ref('')
const passwordSuccess = ref(false)
const saving = ref(false)

async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = false

  if (passwordForm.value.newPassword.length < 8) {
    passwordError.value = t('auth.passwordTooShort')
    return
  }
  if (!/[a-z]/.test(passwordForm.value.newPassword) || !/[A-Z]/.test(passwordForm.value.newPassword) || !/[0-9]/.test(passwordForm.value.newPassword)) {
    passwordError.value = t('auth.passwordWeak')
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = t('settings.newPasswordMismatch')
    return
  }

  saving.value = true
  try {
    await auth.changePassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    })
    passwordSuccess.value = true
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (e: any) {
    passwordError.value = e.response?.data?.message || t('settings.passwordChangeFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BackButton />
  <div class="max-w-lg">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ $t('settings.title') }}</h1>

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ $t('settings.changePassword') }}</h2>

      <div v-if="passwordError" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">
        {{ passwordError }}
      </div>
      <div v-if="passwordSuccess" class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm rounded-lg">
        {{ $t('settings.passwordChanged') }}
      </div>

      <form class="space-y-4" @submit.prevent="changePassword">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('settings.currentPassword') }}</label>
          <input
            v-model="passwordForm.currentPassword"
            type="password"
            required
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('settings.newPassword') }}</label>
          <input
            v-model="passwordForm.newPassword"
            type="password"
            required
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('settings.confirmNewPassword') }}</label>
          <input
            v-model="passwordForm.confirmPassword"
            type="password"
            required
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <BaseButton type="submit" :loading="saving">{{ $t('settings.changePassword') }}</BaseButton>
      </form>
    </div>
  </div>
</template>
