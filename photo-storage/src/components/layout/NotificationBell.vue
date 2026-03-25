<script setup lang="ts">
import { ref } from 'vue'
import { useNotificationStore } from '@/stores/notification'
import { timeAgo } from '@/utils/format'

const store = useNotificationStore()
const open = ref(false)
</script>

<template>
  <div class="relative">
    <button class="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" @click="open = !open">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span
        v-if="store.unreadCount > 0"
        class="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
      >
        {{ store.unreadCount > 9 ? '9+' : store.unreadCount }}
      </span>
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      leave-active-class="transition duration-75 ease-in"
      enter-from-class="opacity-0 scale-95"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Thông báo</h4>
          <button
            v-if="store.unreadCount > 0"
            class="text-xs text-orange-500 hover:text-orange-600"
            @click="store.markAllRead()"
          >
            Đánh dấu đã đọc
          </button>
        </div>
        <div class="max-h-80 overflow-y-auto">
          <div
            v-for="n in store.items"
            :key="n.id"
            :class="['px-4 py-3 border-b border-gray-50 dark:border-gray-700 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700', !n.read ? 'bg-orange-50/50 dark:bg-orange-900/20' : '']"
            @click="store.markRead(n.id)"
          >
            <p class="text-sm text-gray-700 dark:text-gray-300">{{ n.message }}</p>
            <p class="text-xs text-gray-400 mt-1">{{ timeAgo(n.createdAt) }}</p>
          </div>
          <div v-if="store.items.length === 0" class="px-4 py-8 text-center text-sm text-gray-400">
            Không có thông báo
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
