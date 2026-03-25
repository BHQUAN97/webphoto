<script setup lang="ts">
interface Column {
  key: string
  label: string
  sortable?: boolean
  class?: string
}

interface Props {
  columns: Column[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

defineEmits<{ sort: [key: string] }>()
</script>

<template>
  <div class="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :class="[
              'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
              col.class,
              col.sortable ? 'cursor-pointer hover:text-gray-700' : '',
            ]"
            @click="col.sortable && $emit('sort', col.key)"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <tr v-if="loading">
          <td :colspan="columns.length" class="px-4 py-8 text-center text-gray-400">
            <svg class="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Đang tải...
          </td>
        </tr>
        <slot v-else />
      </tbody>
    </table>
  </div>
</template>
