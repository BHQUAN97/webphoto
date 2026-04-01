<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import BaseButton from '@/components/ui/BaseButton.vue'

interface LogItem {
  id: string
  level: string
  message: string
  context: Record<string, unknown> | null
  stack: string | null
  createdAt: string
}

const logs = ref<LogItem[]>([])
const loading = ref(true)
const nextCursor = ref<string>()
const loadingMore = ref(false)

// Filters
const minLevel = ref('WARN')
const search = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const expandedId = ref<string | null>(null)

const LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']

const levelBadge: Record<string, string> = {
  TRACE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  DEBUG: 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300',
  INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  WARN: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  FATAL: 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200 font-bold',
}

const levelRowBg: Record<string, string> = {
  TRACE: '',
  DEBUG: '',
  INFO: '',
  WARN: 'bg-yellow-50/50 dark:bg-yellow-900/10',
  ERROR: 'bg-red-50/50 dark:bg-red-900/10',
  FATAL: 'bg-red-100/50 dark:bg-red-900/20',
}

async function fetchLogs(append = false) {
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
    logs.value = []
  }

  try {
    const params: Record<string, string> = { limit: '50' }
    if (minLevel.value) params.minLevel = minLevel.value
    if (search.value.trim()) params.search = search.value.trim()
    if (dateFrom.value) params.from = dateFrom.value
    if (dateTo.value) params.to = dateTo.value
    if (append && nextCursor.value) params.cursor = nextCursor.value

    const res = await api.get('/admin/logs', { params })
    const items: LogItem[] = res.data.items ?? []

    if (append) {
      logs.value.push(...items)
    } else {
      logs.value = items
    }
    nextCursor.value = res.data.nextCursor
  } catch (err) {
    console.error('[Logs] Failed to fetch', err)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function applyFilters() {
  nextCursor.value = undefined
  fetchLogs()
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { hour12: false })
}

function getPath(log: LogItem): string | null {
  if (!log.context) return null
  const method = log.context.method as string | undefined
  const url = log.context.url as string | undefined
  if (method && url) return `${method} ${url}`
  if (url) return url
  return null
}

function getStatusClass(code: number | undefined): string {
  if (!code) return 'text-gray-500'
  if (code >= 500) return 'text-red-600 font-semibold'
  if (code >= 400) return 'text-yellow-600 font-semibold'
  if (code >= 300) return 'text-blue-600'
  return 'text-green-600'
}

onMounted(() => fetchLogs())
</script>

<template>
  <div>
    <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Nhật ký hệ thống</h1>

    <!-- Filters -->
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Mức tối thiểu</label>
          <select v-model="minLevel" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200">
            <option value="">Tất cả</option>
            <option v-for="l in LEVELS" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tìm kiếm</label>
          <input
            v-model="search"
            type="text"
            placeholder="Tìm trong nội dung..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
            @keyup.enter="applyFilters"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Từ ngày</label>
          <input v-model="dateFrom" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Đến ngày</label>
          <input v-model="dateTo" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" />
        </div>
        <div class="flex items-end">
          <BaseButton variant="primary" size="sm" class="w-full" @click="applyFilters">Lọc</BaseButton>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Đang tải...</div>

    <!-- Log list -->
    <div v-else-if="logs.length > 0" class="space-y-1">
      <div
        v-for="log in logs"
        :key="log.id"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        :class="levelRowBg[log.level] ?? ''"
      >
        <!-- Log header row -->
        <div
          class="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          @click="toggleExpand(log.id)"
        >
          <!-- Level badge -->
          <span
            :class="['text-xs font-mono px-2 py-0.5 rounded-md shrink-0 leading-5', levelBadge[log.level] ?? 'bg-gray-100 text-gray-500']"
          >
            {{ log.level }}
          </span>

          <!-- Timestamp -->
          <span class="text-xs text-gray-400 shrink-0 hidden sm:block tabular-nums leading-5">{{ formatTime(log.createdAt) }}</span>

          <!-- Main content area -->
          <div class="flex-1 min-w-0">
            <!-- Message -->
            <p class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ log.message }}</p>
            <!-- Path (URL) inline preview -->
            <p v-if="getPath(log)" class="text-xs text-gray-400 dark:text-gray-500 font-mono truncate mt-0.5">
              {{ getPath(log) }}
              <span v-if="log.context?.statusCode" :class="getStatusClass(log.context.statusCode as number)" class="ml-1">
                {{ log.context.statusCode }}
              </span>
              <span v-if="log.context?.durationMs" class="text-gray-400 ml-1">{{ log.context.durationMs }}ms</span>
            </p>
          </div>

          <!-- Stack indicator -->
          <span v-if="log.stack" class="text-xs text-red-400 shrink-0 hidden sm:block" title="Has stack trace">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>

          <!-- Expand chevron -->
          <svg
            class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200"
            :class="{ 'rotate-180': expandedId === log.id }"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <!-- Mobile time -->
        <div v-if="expandedId !== log.id" class="px-3 pb-1 sm:hidden">
          <span class="text-xs text-gray-400">{{ formatTime(log.createdAt) }}</span>
        </div>

        <!-- Expanded detail -->
        <div v-if="expandedId === log.id" class="border-t border-gray-100 dark:border-gray-700 px-4 py-4 bg-gray-50 dark:bg-gray-900 space-y-3">
          <!-- Metadata grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <div><span class="text-gray-500">ID:</span> <span class="font-mono text-gray-700 dark:text-gray-300">{{ log.id }}</span></div>
            <div><span class="text-gray-500">Time:</span> <span class="text-gray-700 dark:text-gray-300">{{ formatTime(log.createdAt) }}</span></div>
            <div v-if="log.context?.requestId">
              <span class="text-gray-500">Request ID:</span>
              <span class="font-mono text-gray-700 dark:text-gray-300">{{ log.context.requestId }}</span>
            </div>
            <div v-if="log.context?.userId">
              <span class="text-gray-500">User:</span>
              <span class="font-mono text-gray-700 dark:text-gray-300">{{ log.context.userId }}</span>
            </div>
          </div>

          <!-- Path / URL -->
          <div v-if="getPath(log)" class="text-xs">
            <span class="text-gray-500">Path:</span>
            <span class="font-mono text-gray-700 dark:text-gray-300 ml-1">{{ getPath(log) }}</span>
            <span v-if="log.context?.statusCode" :class="getStatusClass(log.context.statusCode as number)" class="ml-2 font-semibold">
              {{ log.context.statusCode }}
            </span>
            <span v-if="log.context?.durationMs" class="text-gray-400 ml-2">{{ log.context.durationMs }}ms</span>
          </div>

          <!-- Message (full, non-truncated) -->
          <div class="text-xs">
            <span class="text-gray-500">Message:</span>
            <p class="mt-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-2.5 font-mono">{{ log.message }}</p>
          </div>

          <!-- Stack trace (shown directly for ERROR/FATAL, collapsible for others) -->
          <div v-if="log.stack">
            <div v-if="log.level === 'ERROR' || log.level === 'FATAL'">
              <span class="text-xs text-red-500 font-medium">Stack Trace:</span>
              <pre class="mt-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-md border border-red-200 dark:border-red-800 overflow-x-auto max-h-64 whitespace-pre-wrap break-words">{{ log.stack }}</pre>
            </div>
            <details v-else class="group">
              <summary class="text-xs text-red-500 cursor-pointer hover:text-red-700 dark:hover:text-red-400 select-none">
                Stack Trace
                <span class="text-gray-400 group-open:hidden">(click to expand)</span>
              </summary>
              <pre class="mt-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-md border border-red-200 dark:border-red-800 overflow-x-auto max-h-64 whitespace-pre-wrap break-words">{{ log.stack }}</pre>
            </details>
          </div>

          <!-- Full context JSON -->
          <details v-if="log.context" class="group">
            <summary class="text-xs text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-400 select-none">
              Full Context JSON
              <span class="text-gray-400 group-open:hidden">(click to expand)</span>
            </summary>
            <pre class="mt-1 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 p-3 rounded-md border border-gray-200 dark:border-gray-700 overflow-x-auto max-h-64 whitespace-pre-wrap break-words">{{ JSON.stringify(log.context, null, 2) }}</pre>
          </details>
        </div>
      </div>

      <!-- Load more -->
      <div v-if="nextCursor" class="text-center py-4">
        <BaseButton variant="secondary" size="sm" :loading="loadingMore" @click="fetchLogs(true)">
          Tải thêm
        </BaseButton>
      </div>
    </div>

    <div v-else class="text-center py-12 text-gray-400">Không có nhật ký nào</div>
  </div>
</template>
