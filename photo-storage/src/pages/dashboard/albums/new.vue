<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import AlbumForm from '@/components/album/AlbumForm.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const router = useRouter()
const loading = ref(false)

async function handleSubmit(data: { title: string; description: string; isPublic: boolean }) {
  loading.value = true
  try {
    const res = await api.post('/albums', data)
    router.push(`/dashboard/albums/${res.data.id}`)
  } catch {
    toast.error('Tạo album thất bại')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-lg">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Tạo album mới</h1>
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <AlbumForm :loading="loading" @submit="handleSubmit" @cancel="router.back()" />
    </div>
  </div>
</template>
