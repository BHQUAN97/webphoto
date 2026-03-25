<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-auto">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Brand -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
            <span class="text-lg font-bold text-gray-900 dark:text-white">PhotoStorage</span>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Lưu trữ ảnh chuyên nghiệp cho nhiếp ảnh gia.
          </p>
        </div>

        <!-- Info -->
        <div>
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Thông tin</h3>
          <ul class="space-y-2 text-sm text-gray-500 dark:text-gray-400">
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Vietnam
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
              <a href="mailto:buihongquan28041997@gmail.com" class="hover:text-orange-500 transition-colors">
                buihongquan28041997@gmail.com
              </a>
            </li>
            <li>
              <span class="text-xs text-gray-400 dark:text-gray-500">
                Phát triển bởi BHQuan
              </span>
            </li>
          </ul>
        </div>

        <!-- Contact -->
        <div>
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Liên hệ</h3>
          <div class="flex items-center gap-3">
            <!-- Zalo -->
            <a
              href="https://zalo.me/0904280497"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 8.16c-.18-.27-.504-.378-.81-.27-.234.09-.378.27-.468.504-.36.99-.828 1.944-1.404 2.826-.09.144-.198.27-.324.378a.465.465 0 01-.324.126.394.394 0 01-.27-.108c-.09-.09-.144-.198-.162-.324-.054-.504-.09-1.008-.09-1.512 0-.504.018-1.008.054-1.512.018-.27-.054-.522-.216-.738-.234-.306-.594-.468-.972-.45-.378.018-.72.198-.918.504-.054.09-.09.18-.108.27-.036.108-.054.234-.054.36 0 .756-.018 1.512-.072 2.268-.018.252-.054.504-.108.756a.85.85 0 01-.27.45c-.144.126-.306.198-.486.216-.18.018-.36-.036-.504-.162-.306-.252-.54-.576-.72-.936-.378-.756-.648-1.566-.81-2.394-.054-.27-.234-.468-.486-.558-.306-.108-.63-.018-.846.216-.162.18-.234.396-.198.63.18 1.116.522 2.178 1.026 3.168.306.594.702 1.134 1.188 1.584.36.342.792.576 1.278.648.486.072.954-.018 1.368-.27.414-.252.702-.612.864-1.062.054-.162.09-.324.108-.504.036-.36.054-.72.054-1.08v-.27c.378-.504.684-1.062.936-1.656.018.378.054.756.108 1.134.072.486.234.954.504 1.368.306.468.738.81 1.26.99.378.126.774.108 1.134-.054.324-.144.576-.396.738-.702.054-.108.09-.216.108-.342.036-.198-.036-.396-.18-.54z" />
              </svg>
              Zalo
            </a>
            <!-- Messenger -->
            <a
              href="https://m.me/bhquan97"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.136 0 0 4.863 0 10.986c0 3.46 1.426 6.467 3.773 8.548.196.174.314.42.324.684l.066 2.134a.875.875 0 001.23.776l2.38-1.05a.878.878 0 01.588-.048c1.158.32 2.393.492 3.639.492 6.864 0 12-4.863 12-10.986C24 4.863 18.864 0 12 0zm1.198 14.79l-3.063-3.268-5.974 3.268 6.57-6.974 3.139 3.268 5.898-3.268-6.57 6.974z" />
              </svg>
              Messenger
            </a>
          </div>
        </div>
      </div>

      <!-- Copyright -->
      <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <p class="text-center text-xs text-gray-400 dark:text-gray-500">
          &copy; {{ currentYear }} PhotoStorage. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</template>
