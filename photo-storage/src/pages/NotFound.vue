<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <h1 class="text-6xl font-bold text-gray-300 dark:text-gray-600 mb-4">404</h1>
      <p class="text-lg text-gray-500 dark:text-gray-400 mb-6">Trang bạn tìm không tồn tại</p>
      <router-link to="/">
        <BaseButton>Về trang chủ</BaseButton>
      </router-link>
    </div>
  </div>
</template>
