<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import { debounce } from '@/utils/debounce'
import { formatBytes } from '@/utils/format'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseConfirm from '@/components/ui/BaseConfirm.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const albums = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const deleteTarget = ref<string | null>(null)
const deleting = ref(false)
const debouncedFetch = debounce(fetchAlbums, 300)

async function fetchAlbums() {
  loading.value = true
  try {
    const res = await api.get('/admin/albums', { params: { search: search.value } })
    albums.value = res.data.items ?? res.data.data ?? res.data
  } catch { /* */ } finally {
    loading.value = false
  }
}

async function toggleVisibility(album: any) {
  await api.patch(`/admin/albums/${album.id}`, { isPublic: !album.isPublic })
  album.isPublic = !album.isPublic
}

async function deleteAlbum() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.delete(`/admin/albums/${deleteTarget.value}`)
    albums.value = albums.value.filter((a) => a.id !== deleteTarget.value)
    deleteTarget.value = null
    toast.success('Xóa thành công')
  } catch { toast.error('Xóa thất bại') }
  finally { deleting.value = false }
}

onMounted(fetchAlbums)
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Quản lý Album</h1>
    <div class="mb-4">
      <input v-model="search" type="text" placeholder="Tìm tên album / user..." class="px-3 py-2 border border-gray-300 rounded-lg text-sm w-80" @input="debouncedFetch" />
    </div>
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Album</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ảnh</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dung lượng</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading"><td colspan="6" class="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
          <tr v-for="a in albums" :key="a.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ a.title }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ a.ownerName ?? a.userId }}</td>
            <td class="px-4 py-3 text-sm">{{ a.imageCount }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ formatBytes(a.totalBytes) }}</td>
            <td class="px-4 py-3">
              <BaseBadge :variant="a.isPublic ? 'success' : 'default'">{{ a.isPublic ? 'Public' : 'Private' }}</BaseBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex gap-2">
                <BaseButton size="sm" variant="ghost" @click="toggleVisibility(a)">{{ a.isPublic ? 'Ẩn' : 'Hiện' }}</BaseButton>
                <BaseButton size="sm" variant="ghost" class="!text-red-500" @click="deleteTarget = a.id">Xóa</BaseButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <BaseConfirm :show="!!deleteTarget" title="Xóa album" message="Album và tất cả ảnh sẽ bị xóa vĩnh viễn." :loading="deleting" @confirm="deleteAlbum" @cancel="deleteTarget = null" />
  </div>
</template>
