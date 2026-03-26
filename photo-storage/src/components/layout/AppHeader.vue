<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import { cdnUrl } from '@/utils/format'
import { useTheme } from '@/composables/useTheme'
import NotificationBell from './NotificationBell.vue'

useI18n()
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
          <router-link to="/" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">{{ $t('nav.home') }}</router-link>
          <template v-if="auth.isAuthenticated">
            <router-link to="/dashboard" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">{{ $t('nav.dashboard') }}</router-link>
            <router-link to="/dashboard/albums" class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">{{ $t('nav.album') }}</router-link>
            <router-link v-if="auth.isAdmin" to="/admin" class="text-sm text-orange-500 hover:text-orange-400 font-medium">{{ $t('nav.admin') }}</router-link>
          </template>
        </nav>

        <!-- Right -->
        <div class="flex items-center gap-1.5 sm:gap-3">
          <!-- Theme toggle (hidden on mobile, shown in mobile nav) -->
          <button
            class="hidden sm:flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            title="Đổi giao diện sáng/tối"
            @click="toggleTheme"
          >
            <svg v-if="isDark" class="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>

          <template v-if="auth.isAuthenticated">
            <NotificationBell />
            <div class="relative">
              <button
                class="flex items-center gap-1 sm:gap-2 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 rounded-full p-0.5 sm:pl-1 sm:pr-3 sm:py-1 border border-orange-200 dark:border-orange-700 transition-colors"
                @click="menuOpen = !menuOpen"
              >
                <img
                  :src="cdnUrl(auth.user?.avatarKey ?? null)"
                  class="w-7 h-7 rounded-full object-cover bg-gray-200 ring-2 ring-orange-300 dark:ring-orange-600"
                  alt=""
                />
                <span class="hidden sm:block text-sm font-medium text-orange-700 dark:text-orange-300">{{ auth.user?.displayName }}</span>
                <svg class="w-4 h-4 text-orange-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <Transition
                enter-active-class="transition duration-100 ease-out"
                leave-active-class="transition duration-75 ease-in"
                enter-from-class="opacity-0 scale-95"
                leave-to-class="opacity-0 scale-95"
              >
                <div
                  v-if="menuOpen"
                  class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-2 z-50"
                  @click="menuOpen = false"
                >
                  <!-- User info -->
                  <div class="px-4 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                    <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ auth.user?.displayName }}</p>
                    <p class="text-xs text-gray-400 truncate">{{ auth.user?.email }}</p>
                  </div>
                  <router-link to="/dashboard/albums" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {{ $t('nav.album') }}
                  </router-link>
                  <router-link to="/dashboard/profile" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {{ $t('nav.profile') }}
                  </router-link>
                  <router-link to="/dashboard/referral" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                    Gi&#x1EDB;i thi&#x1EC7;u nh&#x1EAD;n th&#x01B0;&#x1EDF;ng
                  </router-link>
                  <router-link to="/upgrade" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <svg class="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                    </svg>
                    <span class="text-yellow-600 dark:text-yellow-400 font-medium">G&#xF3;i VIP</span>
                  </router-link>
                  <hr class="my-1.5 border-gray-100 dark:border-gray-700" />
                  <button class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" @click="handleLogout">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {{ $t('nav.logout') }}
                  </button>
                </div>
              </Transition>
            </div>
          </template>
          <template v-else>
            <router-link to="/login" class="hidden sm:block text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">{{ $t('auth.login') }}</router-link>
            <router-link
              to="/register"
              class="text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg"
            >
              {{ $t('auth.register') }}
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
        <div v-if="mobileNavOpen && !hasSidebar" class="md:hidden pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
          <router-link to="/" class="block py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" @click="mobileNavOpen = false">{{ $t('nav.home') }}</router-link>
          <template v-if="auth.isAuthenticated">
            <router-link to="/dashboard" class="block py-2 text-sm text-gray-600 dark:text-gray-300" @click="mobileNavOpen = false">{{ $t('nav.dashboard') }}</router-link>
            <router-link to="/dashboard/albums" class="block py-2 text-sm text-gray-600 dark:text-gray-300" @click="mobileNavOpen = false">{{ $t('nav.album') }}</router-link>
            <router-link to="/dashboard/profile" class="block py-2 text-sm text-gray-600 dark:text-gray-300" @click="mobileNavOpen = false">{{ $t('nav.profile') }}</router-link>
            <router-link to="/dashboard/settings" class="block py-2 text-sm text-gray-600 dark:text-gray-300" @click="mobileNavOpen = false">{{ $t('nav.settings') }}</router-link>
            <router-link v-if="auth.isAdmin" to="/admin" class="block py-2 text-sm text-orange-500 font-medium" @click="mobileNavOpen = false">{{ $t('nav.admin') }}</router-link>
            <hr class="my-1 border-gray-200 dark:border-gray-600" />
            <button class="block w-full text-left py-2 text-sm text-red-600 dark:text-red-400" @click="handleLogout">{{ $t('nav.logout') }}</button>
          </template>
          <template v-else>
            <router-link to="/login" class="block py-2 text-sm text-gray-600 dark:text-gray-300" @click="mobileNavOpen = false">{{ $t('auth.login') }}</router-link>
            <router-link to="/register" class="block py-2 text-sm text-orange-500 font-medium" @click="mobileNavOpen = false">{{ $t('auth.register') }}</router-link>
          </template>
          <!-- Mobile-only: theme + language toggles -->
          <hr class="my-1 border-gray-200 dark:border-gray-600 sm:hidden" />
          <div class="flex items-center gap-4 sm:hidden py-2">
            <button
              class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
              @click="toggleTheme"
            >
              <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              {{ isDark ? 'Light' : 'Dark' }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </header>
</template>
