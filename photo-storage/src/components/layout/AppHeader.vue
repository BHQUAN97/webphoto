<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { cdnUrl } from '@/utils/format'
import { useTheme } from '@/composables/useTheme'
import NotificationBell from './NotificationBell.vue'

const props = defineProps<{ hasSidebar?: boolean }>()
const emit = defineEmits<{ 'toggle-sidebar': [] }>()
const auth = useAuthStore()
const router = useRouter()
const { isDark, toggle: toggleTheme } = useTheme()
const menuOpen = ref(false)
const mobileNavOpen = ref(false)

function handleLogout() {
  auth.logout()
  router.push('/login')
  menuOpen.value = false
}

function handleHamburger() {
  if (props.hasSidebar) {
    emit('toggle-sidebar')
  } else {
    mobileNavOpen.value = !mobileNavOpen.value
  }
}
</script>

<template>
  <header class="bg-white border-b border-gray-200 sticky top-0 z-40 dark:bg-gray-800 dark:border-gray-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-2">
          <svg class="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
          </svg>
          <span class="text-xl font-bold text-gray-900 dark:text-white">PhotoStorage</span>
        </router-link>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-6">
          <router-link to="/" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Trang chủ</router-link>
          <template v-if="auth.isAuthenticated">
            <router-link to="/dashboard" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Dashboard</router-link>
            <router-link to="/dashboard/albums" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Album</router-link>
            <router-link v-if="auth.isAdmin" to="/admin" class="text-sm text-orange-500 hover:text-orange-400 font-medium">Admin</router-link>
          </template>
        </nav>

        <!-- Right -->
        <div class="flex items-center gap-2 sm:gap-3">
          <!-- Theme toggle -->
          <button
            class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            title="Đổi giao diện sáng/tối"
            @click="toggleTheme"
          >
            <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>

          <template v-if="auth.isAuthenticated">
            <NotificationBell />
            <div class="relative">
              <button
                class="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-2 py-1"
                @click="menuOpen = !menuOpen"
              >
                <img
                  :src="cdnUrl(auth.user?.avatarKey ?? null)"
                  class="w-8 h-8 rounded-full object-cover bg-gray-200"
                  alt=""
                />
                <span class="hidden sm:block text-sm text-gray-700 dark:text-gray-300">{{ auth.user?.displayName }}</span>
              </button>
              <Transition
                enter-active-class="transition duration-100 ease-out"
                leave-active-class="transition duration-75 ease-in"
                enter-from-class="opacity-0 scale-95"
                leave-to-class="opacity-0 scale-95"
              >
                <div
                  v-if="menuOpen"
                  class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 z-50"
                  @click="menuOpen = false"
                >
                  <router-link to="/dashboard/profile" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Hồ sơ</router-link>
                  <router-link to="/dashboard/settings" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cài đặt</router-link>
                  <router-link to="/upgrade" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Nâng cấp</router-link>
                  <hr class="my-1 border-gray-200 dark:border-gray-600" />
                  <button class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700" @click="handleLogout">
                    Đăng xuất
                  </button>
                </div>
              </Transition>
            </div>
          </template>
          <template v-else>
            <router-link to="/login" class="hidden sm:block text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Đăng nhập</router-link>
            <router-link
              to="/register"
              class="text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg"
            >
              Đăng ký
            </router-link>
          </template>

          <!-- Mobile hamburger -->
          <button class="md:hidden p-2" @click="handleHamburger">
            <svg class="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!mobileNavOpen || hasSidebar" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile nav dropdown (for public pages without sidebar) -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        leave-active-class="transition duration-100 ease-in"
        enter-from-class="opacity-0 -translate-y-2"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="mobileNavOpen && !hasSidebar" class="md:hidden pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1" @click="mobileNavOpen = false">
          <router-link to="/" class="block py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Trang chủ</router-link>
          <template v-if="auth.isAuthenticated">
            <router-link to="/dashboard" class="block py-2 text-sm text-gray-600 dark:text-gray-300">Dashboard</router-link>
            <router-link to="/dashboard/albums" class="block py-2 text-sm text-gray-600 dark:text-gray-300">Album</router-link>
            <router-link v-if="auth.isAdmin" to="/admin" class="block py-2 text-sm text-orange-500 font-medium">Admin</router-link>
          </template>
          <template v-else>
            <router-link to="/login" class="block py-2 text-sm text-gray-600 dark:text-gray-300">Đăng nhập</router-link>
            <router-link to="/register" class="block py-2 text-sm text-orange-500 font-medium">Đăng ký</router-link>
          </template>
        </div>
      </Transition>
    </div>
  </header>
</template>
