/**
 * Lightweight i18n plugin — Vietnamese only.
 * Replaces vue-i18n (alpha was unreliable).
 * Keeps the same API: $t() in templates, useI18n() in scripts.
 */
import { type App } from 'vue'
import vi from '@/locales/vi.json'

type Messages = Record<string, unknown>

function resolve(key: string, messages: Messages): string {
  const parts = key.split('.')
  let cur: unknown = messages
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return key
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : key
}

function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : `{${k}}`,
  )
}

/** Translate a key with optional interpolation params */
export function t(key: string, params?: Record<string, unknown>): string {
  return interpolate(resolve(key, vi as unknown as Messages), params)
}

/** Drop-in replacement for `useI18n()` from vue-i18n */
export function useI18n() {
  return { t, locale: 'vi' as const }
}

/** Vue plugin */
const i18nPlugin = {
  install(app: App) {
    app.config.globalProperties.$t = t
  },
}

export default i18nPlugin
