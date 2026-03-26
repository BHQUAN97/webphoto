<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import BaseButton from '@/components/ui/BaseButton.vue'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const referralCode = (route.query.ref as string) ?? ''

const form = ref({ email: '', password: '', displayName: '', confirmPassword: '' })
const error = ref('')

async function handleSubmit() {
  error.value = ''
  if (form.value.password !== form.value.confirmPassword) {
    error.value = t('auth.passwordMismatch')
    return
  }
  if (form.value.password.length < 8) {
    error.value = t('auth.passwordTooShort')
    return
  }
  if (!/[a-z]/.test(form.value.password) || !/[A-Z]/.test(form.value.password) || !/[0-9]/.test(form.value.password)) {
    error.value = t('auth.passwordWeak')
    return
  }
  try {
    await auth.register({
      email: form.value.email,
      password: form.value.password,
      displayName: form.value.displayName,
      referralCode: referralCode || undefined,
    } as any)
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.response?.data?.message || t('auth.registerFailed')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <router-link to="/" class="inline-flex items-center gap-2">
          <svg class="w-10 h-10 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
          </svg>
          <span class="text-2xl font-bold text-gray-900 dark:text-white">PhotoStorage</span>
        </router-link>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">{{ $t('auth.register') }}</h2>

        <div v-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">
          {{ error }}
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('auth.displayName') }}</label>
            <input
              v-model="form.displayName"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              :placeholder="$t('auth.displayNamePlaceholder')"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('auth.email') }}</label>
            <input
              v-model="form.email"
              type="email"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              :placeholder="$t('auth.emailPlaceholder')"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('auth.password') }}</label>
            <input
              v-model="form.password"
              type="password"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              :placeholder="$t('auth.passwordHint')"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('auth.confirmPassword') }}</label>
            <input
              v-model="form.confirmPassword"
              type="password"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              :placeholder="$t('auth.passwordPlaceholder')"
            />
          </div>
          <BaseButton type="submit" :loading="auth.loading" class="w-full">
            {{ $t('auth.register') }}
          </BaseButton>
        </form>

        <p class="mt-4 text-sm text-center text-gray-500 dark:text-gray-400">
          {{ $t('auth.hasAccount') }}
          <router-link to="/login" class="text-orange-500 hover:text-orange-600 font-medium">{{ $t('auth.login') }}</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
