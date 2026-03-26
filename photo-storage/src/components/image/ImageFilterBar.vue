<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useI18n } from '@/plugins/i18n'
import { debounce } from '@/utils/debounce'

const { t } = useI18n()

interface Filters {
  search: string
  status: string
  sortBy: string
  dateFrom: string
  dateTo: string
  liked: boolean
}

const emit = defineEmits<{ filter: [filters: Filters] }>()

const filters = reactive<Filters>({
  search: '', status: '', sortBy: 'newest', dateFrom: '', dateTo: '', liked: false,
})

const expanded = ref(false)

const applyDebounced = debounce(() => emit('filter', { ...filters }), 300)
function apply() { emit('filter', { ...filters }) }
function reset() {
  Object.assign(filters, { search: '', status: '', sortBy: 'newest', dateFrom: '', dateTo: '', liked: false })
  apply()
}

const hasActiveFilters = computed(() => {
  return filters.status !== '' || filters.sortBy !== 'newest' || filters.dateFrom !== '' || filters.dateTo !== '' || filters.liked
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-4">
    <!-- Mobile: search + toggle button -->
    <div class="flex gap-2 items-center">
      <input
        v-model="filters.search"
        type="text"
        :placeholder="t('filter.searchPlaceholder')"
        class="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        @input="applyDebounced"
      />
      <!-- Filter toggle button (mobile) -->
      <button
        class="sm:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border transition-colors"
        :class="expanded || hasActiveFilters
          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600'
          : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'"
        @click="expanded = !expanded"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      </button>
      <!-- Desktop: inline controls -->
      <select
        v-model="filters.status"
        class="hidden sm:block min-w-[120px] px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
        @change="apply"
      >
        <option value="">{{ $t('filter.allStatus') }}</option>
        <option value="ready">{{ $t('filter.processed') }}</option>
        <option value="processing">{{ $t('filter.processing') }}</option>
        <option value="failed">{{ $t('filter.failed') }}</option>
      </select>
      <select
        v-model="filters.sortBy"
        class="hidden sm:block min-w-[120px] px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
        @change="apply"
      >
        <option value="newest">{{ $t('filter.newest') }}</option>
        <option value="oldest">{{ $t('filter.oldest') }}</option>
        <option value="most_liked">{{ $t('filter.mostLiked') }}</option>
        <option value="largest">{{ $t('filter.largestSize') }}</option>
      </select>
      <input v-model="filters.dateFrom" type="date" class="hidden sm:block px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" @change="apply" />
      <input v-model="filters.dateTo" type="date" class="hidden sm:block px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" @change="apply" />
      <div class="hidden sm:flex items-center gap-3">
        <label class="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
          <input v-model="filters.liked" type="checkbox" class="rounded border-gray-300 text-orange-500" @change="apply" />
          {{ $t('filter.favorite') }}
        </label>
        <button class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 whitespace-nowrap" @click="reset">{{ $t('filter.clearFilter') }}</button>
      </div>
    </div>

    <!-- Mobile expanded filter panel -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-60"
      leave-from-class="opacity-100 max-h-60"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-if="expanded" class="sm:hidden overflow-hidden mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <div class="grid grid-cols-2 gap-2">
          <select
            v-model="filters.status"
            class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
            @change="apply"
          >
            <option value="">{{ $t('filter.allStatus') }}</option>
            <option value="ready">{{ $t('filter.processed') }}</option>
            <option value="processing">{{ $t('filter.processing') }}</option>
            <option value="failed">{{ $t('filter.failed') }}</option>
          </select>
          <select
            v-model="filters.sortBy"
            class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
            @change="apply"
          >
            <option value="newest">{{ $t('filter.newest') }}</option>
            <option value="oldest">{{ $t('filter.oldest') }}</option>
            <option value="most_liked">{{ $t('filter.mostLiked') }}</option>
            <option value="largest">{{ $t('filter.largestSize') }}</option>
          </select>
          <input v-model="filters.dateFrom" type="date" class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" @change="apply" />
          <input v-model="filters.dateTo" type="date" class="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" @change="apply" />
        </div>
        <div class="flex items-center justify-between">
          <label class="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <input v-model="filters.liked" type="checkbox" class="rounded border-gray-300 text-orange-500" @change="apply" />
            {{ $t('filter.favorite') }}
          </label>
          <button class="text-xs text-orange-500 hover:text-orange-600" @click="reset">{{ $t('filter.clearFilter') }}</button>
        </div>
      </div>
    </Transition>
  </div>
</template>
