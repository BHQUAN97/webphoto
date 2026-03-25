<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useNotify } from '@/composables/useNotify'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'

useAuthStore()
useNotify()

// Auth refresh is handled by router guard before first navigation
</script>

<template>
  <ToastContainer />
  <div class="min-h-screen flex flex-col">
    <router-view v-slot="{ Component, route }">
      <template v-if="route.path.startsWith('/dashboard') || route.path.startsWith('/admin')">
        <component :is="Component" class="flex-1" />
      </template>
      <template v-else-if="route.path === '/login' || route.path === '/register'">
        <component :is="Component" class="flex-1" />
      </template>
      <template v-else>
        <AppHeader />
        <component :is="Component" class="flex-1" />
      </template>
    </router-view>
    <AppFooter v-if="!$route.path.startsWith('/login') && !$route.path.startsWith('/register') && !$route.path.startsWith('/admin')" />
  </div>
</template>
