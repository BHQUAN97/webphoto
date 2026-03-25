<script setup lang="ts">
import { reactive } from 'vue'
import { debounce } from '@/utils/debounce'

interface Filters {
  liked: boolean
  status: string
  dateFrom: string
  dateTo: string
  sortBy: string
  search: string
}

const emit = defineEmits<{ filter: [filters: Filters] }>()

const filters = reactive<Filters>({
  liked: false,
  status: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'newest',
  search: '',
})

function apply() {
  emit('filter', { ...filters })
}

// Debounce search input — avoid API call per keystroke
const applyDebounced = debounce(apply, 400)

function reset() {
  Object.assign(filters, {
    liked: false, status: '', dateFrom: '', dateTo: '',
    sortBy: 'newest', search: '',
  })
  apply()
}
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 p-4 mb-4">
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <input
        v-model="filters.search"
        type="text"
        placeholder="Tìm theo tên file..."
        class="col-span-2 sm:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        @input="applyDebounced"
      />
      <select
        v-model="filters.status"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
        @change="apply"
      >
        <option value="">Tất cả trạng thái</option>
        <option value="ready">Đã xử lý</option>
        <option value="processing">Đang xử lý</option>
        <option value="failed">Lỗi</option>
      </select>
      <select
        v-model="filters.sortBy"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
        @change="apply"
      >
        <option value="newest">Mới nhất</option>
        <option value="oldest">Cũ nhất</option>
        <option value="most_liked">Nhiều like nhất</option>
        <option value="largest">Dung lượng lớn nhất</option>
      </select>
      <input v-model="filters.dateFrom" type="date" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" @change="apply" />
      <input v-model="filters.dateTo" type="date" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" @change="apply" />
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">
          <input v-model="filters.liked" type="checkbox" class="rounded border-gray-300 text-orange-500" @change="apply" />
          Yêu thích
        </label>
        <button class="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap" @click="reset">Xóa lọc</button>
      </div>
    </div>
  </div>
</template>
