<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import api from '@/utils/api'
import type { AdminStats, ChartData, TopStorageUser } from '@/types'
import { formatVnd, formatGB } from '@/utils/format'
import StatCard from '@/components/admin/StatCard.vue'
import AlertBanner from '@/components/admin/AlertBanner.vue'
import { Line, Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

useI18n()
const adminStore = useAdminStore()
const stats = ref<AdminStats>({ totalUsers: 0, newUsers30d: 0, totalImages: 0, processingImages: 0, failedImages: 0, totalAlbums: 0, revenue30d: 0 })
const chartData = ref<ChartData>({ snapshots: [], visits: [], revenueMonthly: [], planDistribution: [] })
const topUsers = ref<TopStorageUser[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [statsRes, chartsRes, topRes] = await Promise.all([
      api.get('/admin/dashboard/stats'),
      api.get('/admin/dashboard/charts'),
      api.get('/admin/dashboard/top-users'),
    ])
    stats.value = statsRes.data
    chartData.value = chartsRes.data
    topUsers.value = topRes.data
  } catch {
    // silently fail
  } finally {
    loading.value = false
  }
})

function dismiss(id: string) {
  adminStore.dismiss(id)
}
</script>

<template>
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-8">{{ $t('adminDashboard.title') }}</h1>

    <!-- Alerts -->
    <div v-for="a in adminStore.alerts.filter(a => !a.dismissedAt)" :key="a.id" class="mb-2">
      <AlertBanner :level="a.level" :message="a.message" @dismiss="dismiss(a.id)" />
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span class="ml-3 text-gray-400">{{ $t('common.loading') }}</span>
    </div>

    <template v-else>
      <!-- Stat Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
        <StatCard
          :label="$t('adminDashboard.totalUsers')"
          :value="stats.totalUsers"
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          icon="users"
        />
        <StatCard
          :label="$t('adminDashboard.newUsers30d')"
          :value="stats.newUsers30d"
          gradient="bg-gradient-to-br from-emerald-400 to-emerald-600"
          icon="user-plus"
        />
        <StatCard
          :label="$t('adminDashboard.revenue')"
          :value="formatVnd(stats.revenue30d)"
          gradient="bg-gradient-to-br from-orange-400 to-orange-600"
          icon="currency"
        />
        <StatCard
          :label="$t('adminDashboard.totalImages')"
          :value="stats.totalImages"
          gradient="bg-gradient-to-br from-purple-500 to-purple-700"
          icon="photo"
        />
        <StatCard
          :label="$t('adminDashboard.processing')"
          :value="stats.processingImages"
          gradient="bg-gradient-to-br from-amber-400 to-yellow-600"
          icon="clock"
        />
        <StatCard
          :label="$t('adminDashboard.failed')"
          :value="stats.failedImages"
          :alert="stats.failedImages > 0"
          gradient="bg-gradient-to-br from-red-500 to-red-700"
          icon="alert"
        />
        <StatCard
          :label="$t('adminDashboard.albums')"
          :value="stats.totalAlbums"
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
          icon="folder"
        />
      </div>

      <!-- Charts Row 1 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700 transition-shadow hover:shadow-lg">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">{{ $t('adminDashboard.visits30d') }}</h3>
          <Line
            :data="{
              labels: chartData.visits.map(v => v.date),
              datasets: [{
                label: $t('adminDashboard.visits'),
                data: chartData.visits.map(v => v.count),
                borderColor: '#F97316',
                backgroundColor: 'rgba(249,115,22,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 5,
              }],
            }"
            :options="{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }"
          />
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700 transition-shadow hover:shadow-lg">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">{{ $t('adminDashboard.newUsers30dChart') }}</h3>
          <Line
            :data="{
              labels: chartData.snapshots.map(s => s.snapshotAt.slice(5, 10)),
              datasets: [{
                label: $t('adminDashboard.newUsers'),
                data: chartData.snapshots.map(s => s.newUsersToday),
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 5,
              }],
            }"
            :options="{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }"
          />
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700 transition-shadow hover:shadow-lg">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">{{ $t('adminDashboard.revenueMonthly') }}</h3>
          <Bar
            :data="{
              labels: chartData.revenueMonthly.map(r => r.month),
              datasets: [{
                label: $t('adminDashboard.revenueVnd'),
                data: chartData.revenueMonthly.map(r => r.total),
                backgroundColor: 'rgba(249,115,22,0.8)',
                hoverBackgroundColor: '#F97316',
                borderRadius: 6,
              }],
            }"
            :options="{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }"
          />
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700 transition-shadow hover:shadow-lg">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">{{ $t('adminDashboard.storage30d') }}</h3>
          <Line
            :data="{
              labels: chartData.snapshots.map(s => s.snapshotAt.slice(5, 10)),
              datasets: [{
                label: $t('adminDashboard.privateGb'),
                data: chartData.snapshots.map(s => Number(s.totalBytesPrivate) / 1e9),
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239,68,68,0.05)',
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 5,
              }, {
                label: $t('adminDashboard.publicGb'),
                data: chartData.snapshots.map(s => Number(s.totalBytesPublic) / 1e9),
                borderColor: '#10B981',
                backgroundColor: 'rgba(16,185,129,0.05)',
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 5,
              }],
            }"
            :options="{ responsive: true, scales: { y: { beginAtZero: true } } }"
          />
        </div>
      </div>

      <!-- Charts Row 3 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700 transition-shadow hover:shadow-lg">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">{{ $t('adminDashboard.planDistribution') }}</h3>
          <div class="max-w-xs mx-auto">
            <Doughnut
              :data="{
                labels: chartData.planDistribution.map(p => p.planName),
                datasets: [{
                  data: chartData.planDistribution.map(p => p.userCount),
                  backgroundColor: ['#9CA3AF', '#3B82F6', '#F97316'],
                  borderWidth: 2,
                  borderColor: 'transparent',
                  hoverBorderColor: '#fff',
                }],
              }"
              :options="{ responsive: true, plugins: { legend: { position: 'bottom' } } }"
            />
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700 transition-shadow hover:shadow-lg">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">{{ $t('adminDashboard.r2StorageUsage') }}</h3>
          <div class="max-w-xs mx-auto relative">
            <Doughnut
              :data="{
                datasets: [{
                  data: [65, 35],
                  backgroundColor: ['#F97316', '#E5E7EB'],
                  borderWidth: 0,
                }],
              }"
              :options="{ circumference: 180, rotation: -90, responsive: true, cutout: '70%', plugins: { tooltip: { enabled: false }, legend: { display: false } } }"
            />
          </div>
        </div>
      </div>

      <!-- Top Users -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800">
          <h3 class="text-sm font-bold text-gray-900 dark:text-white">{{ $t('adminDashboard.topUsersTitle') }}</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-700/50">
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ $t('adminDashboard.rank') }}</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ $t('adminDashboard.user') }}</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ $t('adminDashboard.storage') }}</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ $t('adminDashboard.images') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(u, i) in topUsers"
                :key="u.userId"
                :class="[
                  'transition-colors duration-150 hover:bg-blue-50/50 dark:hover:bg-gray-700/50',
                  i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750',
                ]"
              >
                <td class="px-6 py-3.5">
                  <span
                    :class="[
                      'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                      i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      i === 1 ? 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300' :
                      i === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                    ]"
                  >
                    {{ i + 1 }}
                  </span>
                </td>
                <td class="px-6 py-3.5">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {{ u.displayName?.charAt(0)?.toUpperCase() || '?' }}
                    </div>
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ u.displayName }}</p>
                      <p class="text-xs text-gray-400">{{ u.email }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-3.5">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ formatGB(u.totalBytes) }}</span>
                </td>
                <td class="px-6 py-3.5">
                  <span class="inline-flex items-center bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-medium px-2.5 py-1 rounded-full">
                    {{ u.imageCount }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
