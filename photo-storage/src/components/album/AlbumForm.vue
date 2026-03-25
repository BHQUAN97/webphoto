<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Album } from '@/types'
import BaseButton from '@/components/ui/BaseButton.vue'

interface Props {
  album?: Album | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  album: null,
  loading: false,
})

const emit = defineEmits<{
  submit: [data: { title: string; description: string; isPublic: boolean }]
  cancel: []
}>()

const form = ref({
  title: '',
  description: '',
  isPublic: true,
})

watch(
  () => props.album,
  (a) => {
    if (a) {
      form.value = {
        title: a.title,
        description: a.description || '',
        isPublic: a.isPublic,
      }
    }
  },
  { immediate: true },
)

function handleSubmit() {
  if (!form.value.title.trim()) return
  emit('submit', { ...form.value })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Tên album</label>
      <input
        v-model="form.title"
        type="text"
        required
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
        placeholder="Ví dụ: Wedding 2024"
      />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
      <textarea
        v-model="form.description"
        rows="3"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
        placeholder="Mô tả ngắn gọn về album..."
      />
    </div>
    <div class="flex items-center gap-2">
      <input v-model="form.isPublic" type="checkbox" id="isPublic" class="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
      <label for="isPublic" class="text-sm text-gray-700">Công khai album</label>
    </div>
    <div class="flex justify-end gap-3 pt-2">
      <BaseButton variant="secondary" type="button" @click="emit('cancel')">Hủy</BaseButton>
      <BaseButton type="submit" :loading="loading">
        {{ album ? 'Cập nhật' : 'Tạo album' }}
      </BaseButton>
    </div>
  </form>
</template>
