<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import type { Comment } from '@/types'
import { cdnUrl, timeAgo } from '@/utils/format'

const props = defineProps<{ imageId: string }>()
const auth = useAuthStore()

const comments = ref<Comment[]>([])
const newComment = ref('')
const loading = ref(false)
const posting = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.get(`/images/${props.imageId}/comments`)
    comments.value = res.data.comments ?? res.data.data ?? res.data
  } catch {
    // fail silently
  } finally {
    loading.value = false
  }
})

async function postComment() {
  if (!newComment.value.trim() || posting.value) return
  posting.value = true
  try {
    const res = await api.post(`/images/${props.imageId}/comments`, { content: newComment.value })
    comments.value.push(res.data)
    newComment.value = ''
  } catch {
    alert('Không thể gửi bình luận')
  } finally {
    posting.value = false
  }
}
</script>

<template>
  <div>
    <h4 class="text-sm font-semibold text-gray-900 mb-3">Bình luận</h4>

    <div v-if="loading" class="text-center py-4 text-gray-400 text-sm">Đang tải...</div>

    <div v-else class="space-y-3 mb-4 max-h-64 overflow-y-auto">
      <div v-for="c in comments" :key="c.id" class="flex gap-2">
        <img
          :src="cdnUrl(c.user?.avatarKey ?? null)"
          class="w-7 h-7 rounded-full object-cover bg-gray-200 shrink-0"
          alt=""
        />
        <div>
          <p class="text-xs">
            <span class="font-medium text-gray-900">{{ c.user?.displayName ?? 'User' }}</span>
            <span class="text-gray-400 ml-2">{{ timeAgo(c.createdAt) }}</span>
          </p>
          <p class="text-sm text-gray-700 mt-0.5">{{ c.content }}</p>
        </div>
      </div>
      <p v-if="comments.length === 0" class="text-sm text-gray-400">Chưa có bình luận</p>
    </div>

    <!-- Input -->
    <div v-if="auth.isAuthenticated" class="flex gap-2">
      <input
        v-model="newComment"
        type="text"
        maxlength="2000"
        placeholder="Viết bình luận..."
        class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        @keyup.enter="postComment"
      />
      <button
        class="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50"
        :disabled="!newComment.trim() || posting"
        @click="postComment"
      >
        Gửi
      </button>
    </div>
  </div>
</template>
