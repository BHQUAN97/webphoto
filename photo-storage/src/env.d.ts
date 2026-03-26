/// <reference types="vite/client" />

declare module 'vue' {
  interface ComponentCustomProperties {
    $t: (key: string, params?: Record<string, unknown>) => string
  }
}

export {}
