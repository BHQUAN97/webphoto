import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

let authReady: Promise<void> | null = null

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/index.vue'),
      meta: { title: 'PhotoStorage — Lưu trữ ảnh RAW chuyên nghiệp' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/login.vue'),
      meta: { guest: true, title: 'Đăng nhập — PhotoStorage' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/register.vue'),
      meta: { guest: true, title: 'Đăng ký — PhotoStorage' },
    },
    {
      path: '/upgrade',
      name: 'upgrade',
      component: () => import('@/pages/upgrade.vue'),
      meta: { auth: true, title: 'Nâng cấp gói — PhotoStorage' },
    },
    {
      path: '/dashboard',
      component: () => import('@/pages/dashboard/index.vue'),
      meta: { auth: true, title: 'Dashboard — PhotoStorage' },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/pages/dashboard/DashboardHome.vue'),
          meta: { title: 'Tổng quan — PhotoStorage' },
        },
        {
          path: 'albums',
          name: 'albums',
          component: () => import('@/pages/dashboard/albums/index.vue'),
          meta: { title: 'Album của tôi — PhotoStorage' },
        },
        {
          path: 'albums/new',
          name: 'album-new',
          component: () => import('@/pages/dashboard/albums/new.vue'),
          meta: { title: 'Tạo album — PhotoStorage' },
        },
        {
          path: 'albums/:id',
          name: 'album-detail',
          component: () => import('@/pages/dashboard/albums/[id].vue'),
          meta: { title: 'Chi tiết album — PhotoStorage' },
        },
        {
          path: 'favorites',
          name: 'favorites',
          component: () => import('@/pages/dashboard/favorites.vue'),
          meta: { title: 'Yêu thích — PhotoStorage' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/pages/dashboard/profile.vue'),
          meta: { title: 'Hồ sơ — PhotoStorage' },
        },
        {
          path: 'referral',
          name: 'referral',
          component: () => import('@/pages/dashboard/referral.vue'),
          meta: { title: 'Giới thiệu bạn bè — PhotoStorage' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/pages/dashboard/settings.vue'),
          meta: { title: 'Cài đặt — PhotoStorage' },
        },
      ],
    },
    {
      path: '/admin',
      component: () => import('@/pages/admin/index.vue'),
      meta: { auth: true, admin: true, title: 'Admin — PhotoStorage' },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('@/pages/admin/AdminDashboard.vue'),
          meta: { title: 'Admin Dashboard — PhotoStorage' },
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/pages/admin/users/index.vue'),
          meta: { title: 'Quản lý người dùng — PhotoStorage' },
        },
        {
          path: 'users/:id',
          name: 'admin-user-detail',
          component: () => import('@/pages/admin/users/[id].vue'),
          meta: { title: 'Chi tiết người dùng — PhotoStorage' },
        },
        {
          path: 'albums',
          name: 'admin-albums',
          component: () => import('@/pages/admin/albums/index.vue'),
          meta: { title: 'Quản lý album — PhotoStorage' },
        },
        {
          path: 'payments',
          name: 'admin-payments',
          component: () => import('@/pages/admin/payments/index.vue'),
          meta: { title: 'Quản lý thanh toán — PhotoStorage' },
        },
        {
          path: 'plans',
          name: 'admin-plans',
          component: () => import('@/pages/admin/plans/index.vue'),
          meta: { title: 'Quản lý gói — PhotoStorage' },
        },
        {
          path: 'payment-methods',
          name: 'admin-payment-methods',
          component: () => import('@/pages/admin/payment-methods/index.vue'),
          meta: { title: 'Phương thức thanh toán — PhotoStorage' },
        },
        {
          path: 'vouchers',
          name: 'admin-vouchers',
          component: () => import('@/pages/admin/vouchers/index.vue'),
          meta: { title: 'Quản lý Voucher — PhotoStorage' },
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: () => import('@/pages/admin/settings/index.vue'),
          meta: { title: 'Cài đặt hệ thống — PhotoStorage' },
        },
        {
          path: 'logs',
          name: 'admin-logs',
          component: () => import('@/pages/admin/logs/index.vue'),
          meta: { title: 'Nhật ký hệ thống — PhotoStorage' },
        },
      ],
    },
    {
      path: '/share/:token',
      name: 'shared-album',
      component: () => import('@/pages/share/[token].vue'),
      meta: { title: 'Album chia sẻ — PhotoStorage' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFound.vue'),
      meta: { title: 'Không tìm thấy — PhotoStorage' },
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title || 'PhotoStorage — Lưu trữ ảnh RAW chuyên nghiệp'
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // On first navigation (page refresh), wait for token refresh to complete
  if (!authReady) {
    authReady = auth.refresh().catch(() => {})
  }
  await authReady

  if (!auth.isAuthenticated && auth.accessToken) {
    await auth.fetchMe()
  }

  if (to.meta.auth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  if (to.meta.admin && !auth.isAdmin) {
    return { name: 'dashboard' }
  }
})

export default router
