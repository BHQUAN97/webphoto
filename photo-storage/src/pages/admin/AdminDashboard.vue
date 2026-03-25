<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Admin Dashboard</h1>

    <!-- Alerts -->
    <div v-for="a in adminStore.alerts.filter(a => !a.dismissedAt)" :key="a.id">
      <AlertBanner :level="a.level" :message="a.message" @dismiss="dismiss(a.id)" />
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Đang tải...</div>

    <template v-else>
      <!-- Stat Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <StatCard label="Tổng người dùng" :value="stats.totalUsers" />
        <StatCard label="Người dùng mới 30d" :value="stats.newUsers30d" />
        <StatCard label="Doanh thu tháng" :value="formatVnd(stats.revenue30d)" />
        <StatCard label="Tổng ảnh" :value="stats.totalImages" />
        <StatCard label="Ảnh lỗi" :value="stats.failedImages" :alert="stats.failedImages > 0" />
      </div>

      <!-- Charts Row 1 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Lượt truy cập 30 ngày</h3>
          <Line
            :data="{
              labels: chartData.visits.map(v => v.date),
              datasets: [{
                label: 'Lượt truy cập',
                data: chartData.visits.map(v => v.count),
                borderColor: '#F97316',
                backgroundColor: 'rgba(249,115,22,0.1)',
                fill: true,
                tension: 0.3,
              }],
            }"
            :options="{ responsive: true, plugins: { legend: { display: false } } }"
          />
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Người dùng mới 30 ngày</h3>
          <Line
            :data="{
              labels: chartData.snapshots.map(s => s.snapshotAt.slice(5, 10)),
              datasets: [{
                label: 'Người dùng mới',
                data: chartData.snapshots.map(s => s.newUsersToday),
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                fill: true,
                tension: 0.3,
              }],
            }"
            :options="{ responsive: true, plugins: { legend: { display: false } } }"
          />
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Doanh thu theo tháng</h3>
          <Bar
            :data="{
              labels: chartData.revenueMonthly.map(r => r.month),
              datasets: [{
                label: 'Doanh thu (VNĐ)',
                data: chartData.revenueMonthly.map(r => r.total),
                backgroundColor: '#F97316',
                borderRadius: 4,
              }],
            }"
            :options="{ responsive: true, plugins: { legend: { display: false } } }"
          />
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Storage 30 ngày (GB)</h3>
          <Line
            :data="{
              labels: chartData.snapshots.map(s => s.snapshotAt.slice(5, 10)),
              datasets: [{
                label: 'Private (GB)',
                data: chartData.snapshots.map(s => Number(s.totalBytesPrivate) / 1e9),
                borderColor: '#EF4444',
                tension: 0.3,
              }, {
                label: 'Public (GB)',
                data: chartData.snapshots.map(s => Number(s.totalBytesPublic) / 1e9),
                borderColor: '#10B981',
                tension: 0.3,
              }],
            }"
            :options="{ responsive: true }"
          />
        </div>
      </div>

      <!-- Charts Row 3 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Phân bổ theo gói</h3>
          <div class="max-w-xs mx-auto">
            <Doughnut
              :data="{
                labels: chartData.planDistribution.map(p => p.planName),
                datasets: [{
                  data: chartData.planDistribution.map(p => p.userCount),
                  backgroundColor: ['#9CA3AF', '#3B82F6', '#F97316'],
                }],
              }"
              :options="{ responsive: true }"
            />
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">R2 Storage Usage</h3>
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
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Top 10 user dung storage nhieu nhat</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Storage</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Anh</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="(u, i) in topUsers" :key="u.userId" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ i + 1 }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ u.displayName }}</span>
                    <span class="text-xs text-gray-400">{{ u.email }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ formatGB(u.totalBytes) }}</td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ u.imageCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
