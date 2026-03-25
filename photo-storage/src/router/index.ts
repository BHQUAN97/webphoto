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
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/login.vue'),
      meta: { guest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/register.vue'),
      meta: { guest: true },
    },
    {
      path: '/upgrade',
      name: 'upgrade',
      component: () => import('@/pages/upgrade.vue'),
      meta: { auth: true },
    },
    {
      path: '/dashboard',
      component: () => import('@/pages/dashboard/index.vue'),
      meta: { auth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/pages/dashboard/DashboardHome.vue'),
        },
        {
          path: 'albums',
          name: 'albums',
          component: () => import('@/pages/dashboard/albums/index.vue'),
        },
        {
          path: 'albums/new',
          name: 'album-new',
          component: () => import('@/pages/dashboard/albums/new.vue'),
        },
        {
          path: 'albums/:id',
          name: 'album-detail',
          component: () => import('@/pages/dashboard/albums/[id].vue'),
        },
        {
          path: 'favorites',
          name: 'favorites',
          component: () => import('@/pages/dashboard/favorites.vue'),
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/pages/dashboard/profile.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/pages/dashboard/settings.vue'),
        },
      ],
    },
    {
      path: '/admin',
      component: () => import('@/pages/admin/index.vue'),
      meta: { auth: true, admin: true },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('@/pages/admin/AdminDashboard.vue'),
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/pages/admin/users/index.vue'),
        },
        {
          path: 'users/:id',
          name: 'admin-user-detail',
          component: () => import('@/pages/admin/users/[id].vue'),
        },
        {
          path: 'albums',
          name: 'admin-albums',
          component: () => import('@/pages/admin/albums/index.vue'),
        },
        {
          path: 'payments',
          name: 'admin-payments',
          component: () => import('@/pages/admin/payments/index.vue'),
        },
        {
          path: 'plans',
          name: 'admin-plans',
          component: () => import('@/pages/admin/plans/index.vue'),
        },
        {
          path: 'payment-methods',
          name: 'admin-payment-methods',
          component: () => import('@/pages/admin/payment-methods/index.vue'),
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: () => import('@/pages/admin/settings/index.vue'),
        },
      ],
    },
    {
      path: '/share/:token',
      name: 'shared-album',
      component: () => import('@/pages/share/[token].vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFound.vue'),
    },
  ],
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
