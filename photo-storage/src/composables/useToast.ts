import { useToastStore } from '@/stores/toast'

export function useToast() {
  const store = useToastStore()

  return {
    success: (msg: string, duration = 3000) => store.add(msg, 'success', duration),
    error: (msg: string, duration = 4000) => store.add(msg, 'error', duration),
    warning: (msg: string, duration = 3500) => store.add(msg, 'warning', duration),
    info: (msg: string, duration = 3000) => store.add(msg, 'info', duration),
  }
}
