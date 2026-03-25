import { ref, watch } from 'vue'

const isDark = ref(localStorage.getItem('theme') === 'dark')

function applyTheme() {
  document.documentElement.classList.toggle('dark', isDark.value)
}

// Apply on load
applyTheme()

watch(isDark, () => {
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  applyTheme()
})

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value
  }

  return { isDark, toggle }
}
