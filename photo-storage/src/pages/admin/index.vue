<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import AdminSidebar from '@/components/layout/AdminSidebar.vue'

const sidebarOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900">
    <AppHeader has-sidebar @toggle-sidebar="sidebarOpen = !sidebarOpen" />
    <div class="flex">
      <!-- Mobile overlay -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 bg-black/50 z-30 md:hidden"
        @click="sidebarOpen = false"
      />
      <!-- Sidebar -->
      <AdminSidebar
        :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
        class="fixed left-0 md:sticky top-16 z-30 transition-transform duration-200"
        @navigate="sidebarOpen = false"
      />
      <main class="flex-1 min-w-0 p-4 md:p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>
