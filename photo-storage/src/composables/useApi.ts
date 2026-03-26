import { ref } from 'vue'

export function useApi<T = unknown>() {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const execute = async (fn: () => Promise<T>): Promise<T | null> => {
    loading.value = true
    error.value = null
    try {
      const result = await fn()
      data.value = result
      return result
    } catch (e: any) {
      error.value =
        e?.response?.data?.message ??
        e?.message ??
        'Đã có lỗi xảy ra, vui lòng thử lại'
      return null
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    data.value = null
    loading.value = false
    error.value = null
  }

  return { data, loading, error, execute, reset }
}

export function useApiList<T = unknown>() {
  const items = ref<T[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)
  const hasMore = ref(false)
  const cursor = ref<string | null>(null)

  const fetch = async (fn: () => Promise<{ items: T[]; total?: number; nextCursor?: string | null }>) => {
    loading.value = true
    error.value = null
    try {
      const result = await fn()
      items.value = result.items ?? []
      total.value = result.total ?? items.value.length
      cursor.value = result.nextCursor ?? null
      hasMore.value = !!result.nextCursor
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Không thể tải dữ liệu'
      items.value = []
    } finally {
      loading.value = false
    }
  }

  const fetchMore = async (fn: () => Promise<{ items: T[]; nextCursor?: string | null }>) => {
    if (!hasMore.value || loading.value) return
    loading.value = true
    try {
      const result = await fn()
      items.value = [...items.value, ...(result.items ?? [])] as T[]
      cursor.value = result.nextCursor ?? null
      hasMore.value = !!result.nextCursor
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Không thể tải thêm'
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    items.value = []
    total.value = 0
    cursor.value = null
    hasMore.value = false
    error.value = null
  }

  return { items, loading, error, total, hasMore, cursor, fetch, fetchMore, reset }
}
