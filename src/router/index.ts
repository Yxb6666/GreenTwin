import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/features/auth/auth'
import MasterView from '@/features/master/MasterView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/master' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginView.vue'),
      meta: { publicOnly: true },
    },
    {
      path: '/master',
      name: 'master',
      component: MasterView,
      meta: { label: '三生空间', requiresAuth: true },
    },
    {
      path: '/sansheng',
      name: 'sansheng',
      component: () => import('@/features/sansheng/SanshengView.vue'),
      meta: { label: '三生评估', requiresAuth: true },
    },
    {
      path: '/twin',
      name: 'twin',
      component: () => import('@/features/twin/TwinView.vue'),
      meta: { label: '三生模拟', requiresAuth: true },
    },
    {
      path: '/governance',
      name: 'governance',
      component: () => import('@/features/governance/GovernanceView.vue'),
      meta: { label: '三生治理', requiresAuth: true },
    },
    {
      path: '/governance/scene/:issueId',
      name: 'governance-scene',
      component: () => import('@/features/twin/TwinView.vue'),
      meta: {
        label: '三生治理 · 三维场景',
        modulePath: '/governance',
        requiresAuth: true,
      },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/features/not-found/NotFoundView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  auth.restoreSession()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.publicOnly && auth.isAuthenticated) return { name: 'master' }
  return true
})

export default router
