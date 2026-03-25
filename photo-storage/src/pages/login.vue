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

const form = ref({ email: '', password: '' })
const error = ref('')

// Validate redirect target — only allow internal paths (prevent open redirect)
function getSafeRedirect(url: string | undefined): string {
  if (!url || typeof url !== 'string') return '/dashboard'
  // Must start with / and not // (protocol-relative URL)
  if (!url.startsWith('/') || url.startsWith('//')) return '/dashboard'
  // Block javascript: and data: schemes embedded in path
  if (/^\/[^/]*:/i.test(url)) return '/dashboard'
  return url
}

async function handleSubmit() {
  error.value = ''
  try {
    await auth.login(form.value)
    const redirect = getSafeRedirect(route.query.redirect as string)
    router.push(redirect)
  } catch (e: any) {
    error.value = e.response?.data?.message || t('auth.loginFailed')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <router-link to="/" class="inline-flex items-center gap-2">
          <svg class="w-10 h-10 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
          </svg>
          <span class="text-2xl font-bold text-gray-900">PhotoStorage</span>
        </router-link>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">{{ $t('auth.login') }}</h2>

        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {{ error }}
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('auth.email') }}</label>
            <input
              v-model="form.email"
              type="email"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              :placeholder="$t('auth.emailPlaceholder')"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('auth.password') }}</label>
            <input
              v-model="form.password"
              type="password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              :placeholder="$t('auth.passwordPlaceholder')"
            />
          </div>
          <BaseButton type="submit" :loading="auth.loading" class="w-full">
            {{ $t('auth.login') }}
          </BaseButton>
        </form>

        <p class="mt-4 text-sm text-center text-gray-500">
          {{ $t('auth.noAccount') }}
          <router-link to="/register" class="text-orange-500 hover:text-orange-600 font-medium">{{ $t('auth.register') }}</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
