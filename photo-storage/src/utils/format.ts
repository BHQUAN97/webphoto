export function formatVnd(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

export function formatBytes(bytes: string | number): string {
  const b = typeof bytes === 'string' ? Number(bytes) : bytes
  if (!b || isNaN(b) || b <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatGB(bytes: string | number): string {
  const b = typeof bytes === 'string' ? Number(bytes) : bytes
  return `${(b / (1024 ** 3)).toFixed(2)} GB`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ngày trước`
  return formatDate(dateStr)
}

export function cdnUrl(key: string | null): string {
  if (!key) return '/placeholder-avatar.svg'
  if (key.startsWith('http')) return key
  return `${import.meta.env.VITE_CDN_URL || ''}/${key}`
}

export function storagePercent(used: string | number, limit: string | number): number {
  const u = typeof used === 'string' ? Number(used) : used
  const l = typeof limit === 'string' ? Number(limit) : limit
  if (l === 0) return 0
  return Math.round((u / l) * 100)
}
