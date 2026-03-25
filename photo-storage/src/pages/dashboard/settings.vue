<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import BaseButton from '@/components/ui/BaseButton.vue'

const auth = useAuthStore()

const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordError = ref('')
const passwordSuccess = ref(false)
const saving = ref(false)

async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = false

  if (passwordForm.value.newPassword.length < 8) {
    passwordError.value = 'Mật khẩu mới tối thiểu 8 ký tự'
    return
  }
  if (!/[a-z]/.test(passwordForm.value.newPassword) || !/[A-Z]/.test(passwordForm.value.newPassword) || !/[0-9]/.test(passwordForm.value.newPassword)) {
    passwordError.value = 'Mật khẩu cần có chữ hoa, chữ thường và số'
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = 'Mật khẩu mới không khớp'
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
    passwordError.value = e.response?.data?.message || 'Đổi mật khẩu thất bại'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-lg">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Cài đặt</h1>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Đổi mật khẩu</h2>

      <div v-if="passwordError" class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
        {{ passwordError }}
      </div>
      <div v-if="passwordSuccess" class="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
        Đổi mật khẩu thành công!
      </div>

      <form @submit.prevent="changePassword" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại</label>
          <input
            v-model="passwordForm.currentPassword"
            type="password"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
          <input
            v-model="passwordForm.newPassword"
            type="password"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nhập lại mật khẩu mới</label>
          <input
            v-model="passwordForm.confirmPassword"
            type="password"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <BaseButton type="submit" :loading="saving">Đổi mật khẩu</BaseButton>
      </form>
    </div>
  </div>
</template>
