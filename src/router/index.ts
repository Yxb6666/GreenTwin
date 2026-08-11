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
      meta: { label: '主控大屏', requiresAuth: true },
    },
    {
      path: '/sansheng',
      name: 'sansheng',
      component: () => import('@/features/sansheng/SanshengView.vue'),
      meta: { label: '三生空间', requiresAuth: true },
    },
    {
      path: '/twin',
      name: 'twin',
      component: () => import('@/features/twin/TwinView.vue'),
      meta: { label: '数字孪生', requiresAuth: true },
    },
    {
      path: '/governance',
      name: 'governance',
      component: () => import('@/features/governance/GovernanceView.vue'),
      meta: { label: '乡村治理', requiresAuth: true },
    },
    {
      path: '/governance/mobile/login',
      name: 'governance-mobile-login',
      component: () =>
        import('@/features/governance-mobile/GovernanceMobileLoginView.vue'),
      meta: { label: '移动端登录', standalone: true },
    },
    {
      path: '/governance/mobile/home',
      name: 'governance-mobile-home',
      component: () => import('@/features/governance-mobile/HomeView.vue'),
      meta: { label: '治理工作台', standalone: true, requiresMobileAuth: true },
    },
    {
      path: '/governance/mobile/report',
      name: 'governance-mobile-report',
      component: () =>
        import('@/features/governance-mobile/GovernanceReportView.vue'),
      meta: { label: '问题上报', standalone: true, requiresMobileAuth: true },
    },
    {
      path: '/governance/mobile/profile',
      name: 'governance-mobile-profile',
      component: () => import('@/features/governance-mobile/ProfileView.vue'),
      meta: { label: '个人中心', standalone: true, requiresMobileAuth: true },
    },
    {
      path: '/governance/mobile/issues/:id',
      name: 'governance-mobile-issue-detail',
      component: () => import('@/features/governance-mobile/GovernanceIssueView.vue'),
      meta: { label: '问题详情', standalone: true, requiresMobileAuth: true },
    },
    {
      path: '/governance/mobile/report/success/:id',
      name: 'governance-mobile-success',
      component: () =>
        import('@/features/governance-mobile/GovernanceReportSuccessView.vue'),
      meta: { label: '上报成功', standalone: true, requiresMobileAuth: true },
    },
    { path: '/governance/report', redirect: '/governance/mobile/login' },
    { path: '/governance/report/form', redirect: '/governance/mobile/report' },
    {
      path: '/governance/report/success/:id',
      redirect: (to) => `/governance/mobile/report/success/${String(to.params.id)}`,
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

  if (to.meta.requiresMobileAuth && !auth.isAuthenticated) {
    return {
      name: 'governance-mobile-login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.name === 'governance-mobile-login' && auth.isAuthenticated) {
    return { name: 'governance-mobile-home' }
  }

  if (to.meta.publicOnly && auth.isAuthenticated) return { name: 'master' }
  return true
})

export default router
