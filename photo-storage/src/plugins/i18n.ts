import { createI18n } from 'vue-i18n'
import vi from '@/locales/vi.json'
import en from '@/locales/en.json'

const savedLocale = localStorage.getItem('locale') || 'vi'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'vi',
  globalInjection: true,
  missingWarn: false,
  fallbackWarn: false,
  messages: { vi, en },
})

export function setLocale(locale: 'vi' | 'en') {
  i18n.global.locale.value = locale
  localStorage.setItem('locale', locale)
  document.documentElement.lang = locale
}

export function getLocale(): string {
  return i18n.global.locale.value
}

export default i18n
