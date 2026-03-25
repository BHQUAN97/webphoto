<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BaseButton from '@/components/ui/BaseButton.vue'

const auth = useAuthStore()
const router = useRouter()

const form = ref({ email: '', password: '', displayName: '', confirmPassword: '' })
const error = ref('')

async function handleSubmit() {
  error.value = ''
  if (form.value.password !== form.value.confirmPassword) {
    error.value = 'Mật khẩu không khớp'
    return
  }
  if (form.value.password.length < 8) {
    error.value = 'Mật khẩu tối thiểu 8 ký tự'
    return
  }
  if (!/[a-z]/.test(form.value.password) || !/[A-Z]/.test(form.value.password) || !/[0-9]/.test(form.value.password)) {
    error.value = 'Mật khẩu cần có chữ hoa, chữ thường và số'
    return
  }
  try {
    await auth.register({
      email: form.value.email,
      password: form.value.password,
      displayName: form.value.displayName,
    })
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Đăng ký thất bại'
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
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Đăng ký tài khoản</h2>

        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {{ error }}
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
            <input
              v-model="form.displayName"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              placeholder="Nguyễn Văn A"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              v-model="form.email"
              type="email"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input
              v-model="form.password"
              type="password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              placeholder="Tối thiểu 8 ký tự (chữ hoa, thường, số)"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nhập lại mật khẩu</label>
            <input
              v-model="form.confirmPassword"
              type="password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              placeholder="••••••••"
            />
          </div>
          <BaseButton type="submit" :loading="auth.loading" class="w-full">
            Đăng ký
          </BaseButton>
        </form>

        <p class="mt-4 text-sm text-center text-gray-500">
          Đã có tài khoản?
          <router-link to="/login" class="text-orange-500 hover:text-orange-600 font-medium">Đăng nhập</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
