export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay = 300): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as unknown as T
}
