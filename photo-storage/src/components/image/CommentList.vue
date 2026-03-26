<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { cdnUrl, timeAgo } from '@/utils/format'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const toast = useToast()

const props = defineProps<{ imageId: string }>()
const auth = useAuthStore()

interface CommentItem {
  id: string
  content: string
  createdAt: string
  userId?: string
  guestName?: string
  displayName?: string
  avatarKey?: string | null
  user?: { displayName: string; avatarKey: string | null }
}

const comments = ref<CommentItem[]>([])
const newComment = ref('')
const loading = ref(false)
const posting = ref(false)

function getDisplayName(c: CommentItem): string {
  return c.displayName ?? c.user?.displayName ?? c.guestName ?? 'Khách'
}

function getAvatarKey(c: CommentItem): string | null {
  return c.avatarKey ?? c.user?.avatarKey ?? null
}

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
  } catch (err: any) {
    const msg = err?.response?.data?.message
    toast.error(msg || t('comment.sendFailed'))
  } finally {
    posting.value = false
  }
}
</script>

<template>
  <div>
    <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ $t('comment.title') }}</h4>

    <div v-if="loading" class="text-center py-4 text-gray-400 text-sm">{{ $t('common.loading') }}</div>

    <div v-else class="space-y-3 mb-4 max-h-64 overflow-y-auto">
      <div v-for="c in comments" :key="c.id" class="flex gap-2">
        <img
          :src="cdnUrl(getAvatarKey(c))"
          class="w-7 h-7 rounded-full object-cover bg-gray-200 dark:bg-gray-700 shrink-0"
          alt=""
        />
        <div>
          <p class="text-xs">
            <span class="font-medium text-gray-900 dark:text-white">{{ getDisplayName(c) }}</span>
            <span class="text-gray-400 ml-2">{{ timeAgo(c.createdAt) }}</span>
          </p>
          <p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ c.content }}</p>
        </div>
      </div>
      <p v-if="comments.length === 0" class="text-sm text-gray-400">{{ $t('comment.noComments') }}</p>
    </div>

    <!-- Input -->
    <div v-if="auth.isAuthenticated" class="flex gap-2">
      <input
        v-model="newComment"
        type="text"
        maxlength="2000"
        :placeholder="$t('comment.placeholder')"
        class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        @keyup.enter="postComment"
      />
      <button
        class="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 shrink-0"
        :disabled="!newComment.trim() || posting"
        @click="postComment"
      >
        {{ $t('common.send') }}
      </button>
    </div>
  </div>
</template>
