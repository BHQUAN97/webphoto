<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNotificationStore } from '@/stores/notification'
import { timeAgo } from '@/utils/format'
import type { Notification } from '@/types'

const store = useNotificationStore()
const open = ref(false)

const visibleItems = computed(() => store.items.slice(0, 20))

function getIcon(type: Notification['type']) {
  switch (type) {
    case 'photo:liked':
      return 'heart'
    case 'image:ready':
      return 'image'
    case 'image:failed':
    case 'storage:warning':
    case 'admin:storage:alert':
    case 'admin:worker:stuck':
    case 'admin:image:error:spike':
      return 'warning'
    case 'payment:success':
    case 'admin:new:payment':
      return 'payment'
    case 'photo:commented':
      return 'comment'
    case 'admin:user:registered':
      return 'user'
    default:
      return 'default'
  }
}

function getTitle(type: Notification['type']) {
  switch (type) {
    case 'photo:liked':
      return 'Lượt thích mới'
    case 'image:ready':
      return 'Ảnh đã sẵn sàng'
    case 'image:failed':
      return 'Xử lý ảnh thất bại'
    case 'storage:warning':
    case 'admin:storage:alert':
      return 'Cảnh báo dung lượng'
    case 'admin:worker:stuck':
      return 'Worker gặp sự cố'
    case 'admin:image:error:spike':
      return 'Lỗi xử lý ảnh tăng đột biến'
    case 'payment:success':
      return 'Thanh toán thành công'
    case 'admin:new:payment':
      return 'Thanh toán mới'
    case 'photo:commented':
      return 'Bình luận mới'
    case 'admin:user:registered':
      return 'Người dùng mới'
    default:
      return 'Thông báo'
  }
}
</script>

<template>
  <div class="relative">
    <button
      class="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      @click="open = !open"
    >
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
        class="fixed right-2 top-14 sm:absolute sm:top-auto sm:right-0 mt-0 sm:mt-2 w-[calc(100vw-1rem)] sm:w-80 md:w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50"
        style="max-width: min(24rem, calc(100vw - 1rem))"
        @touchmove.stop
        @wheel.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h4 class="text-sm font-bold text-gray-900 dark:text-white">{{ $t('notification.title') }}</h4>
          <button
            v-if="store.unreadCount > 0"
            class="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors"
            @click.stop="store.markAllRead()"
          >
            {{ $t('notification.markAllRead') }}
          </button>
        </div>

        <!-- Notification list -->
        <div class="max-h-[50vh] sm:max-h-[400px] overflow-y-auto overscroll-contain" style="-webkit-overflow-scrolling: touch">
          <div
            v-for="n in visibleItems"
            :key="n.id"
            class="flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            @click="store.markRead(n.id)"
          >
            <!-- Icon -->
            <div class="shrink-0 mt-0.5">
              <!-- Heart icon (like) -->
              <div v-if="getIcon(n.type) === 'heart'" class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <!-- Image icon (ready) -->
              <div v-else-if="getIcon(n.type) === 'image'" class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <!-- Warning icon -->
              <div v-else-if="getIcon(n.type) === 'warning'" class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <!-- Payment icon -->
              <div v-else-if="getIcon(n.type) === 'payment'" class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <!-- Comment icon -->
              <div v-else-if="getIcon(n.type) === 'comment'" class="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <!-- User icon -->
              <div v-else-if="getIcon(n.type) === 'user'" class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <!-- Default icon -->
              <div v-else class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                  {{ getTitle(n.type) }}
                </p>
                <!-- Unread indicator -->
                <span v-if="!n.read" class="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-blue-500"></span>
              </div>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{{ n.message }}</p>
              <p class="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{{ timeAgo(n.createdAt) }}</p>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="store.items.length === 0" class="px-4 py-10 text-center">
            <svg class="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p class="text-sm text-gray-400 dark:text-gray-500">Kh&ocirc;ng c&oacute; th&ocirc;ng b&aacute;o m&#x1EDB;i</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Backdrop to close -->
    <Teleport to="body">
      <div
        v-if="open"
        class="fixed inset-0 z-40"
        @click="open = false"
      ></div>
    </Teleport>
  </div>
</template>
