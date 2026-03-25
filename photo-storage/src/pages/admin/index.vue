<script setup lang="ts">
import AppHeader from '@/components/layout/AppHeader.vue'
import AdminSidebar from '@/components/layout/AdminSidebar.vue'
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <AppHeader />
    <div class="flex">
      <AdminSidebar />
      <main class="flex-1 p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>
