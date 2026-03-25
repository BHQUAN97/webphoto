<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { debounce } from '@/utils/debounce'

const { t } = useI18n()

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
        :placeholder="t('filter.searchPlaceholder')"
        class="col-span-2 sm:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        @input="applyDebounced"
      />
      <select
        v-model="filters.status"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
        @change="apply"
      >
        <option value="">{{ $t('filter.allStatus') }}</option>
        <option value="ready">{{ $t('filter.processed') }}</option>
        <option value="processing">{{ $t('filter.processing') }}</option>
        <option value="failed">{{ $t('filter.failed') }}</option>
      </select>
      <select
        v-model="filters.sortBy"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
        @change="apply"
      >
        <option value="newest">{{ $t('filter.newest') }}</option>
        <option value="oldest">{{ $t('filter.oldest') }}</option>
        <option value="most_liked">{{ $t('filter.mostLiked') }}</option>
        <option value="largest">{{ $t('filter.largestSize') }}</option>
      </select>
      <input v-model="filters.dateFrom" type="date" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" @change="apply" />
      <input v-model="filters.dateTo" type="date" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" @change="apply" />
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">
          <input v-model="filters.liked" type="checkbox" class="rounded border-gray-300 text-orange-500" @change="apply" />
          {{ $t('filter.favorite') }}
        </label>
        <button class="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap" @click="reset">{{ $t('filter.clearFilter') }}</button>
      </div>
    </div>
  </div>
</template>
