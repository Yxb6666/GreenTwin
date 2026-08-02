import { createRouter, createWebHistory } from 'vue-router'
import MasterView from '@/features/master/MasterView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/master' },
    { path: '/master', name: 'master', component: MasterView, meta: { label: '主控大屏' } },
    {
      path: '/sansheng',
      name: 'sansheng',
      component: () => import('@/features/sansheng/SanshengView.vue'),
      meta: { label: '三生空间' },
    },
    {
      path: '/twin',
      name: 'twin',
      component: () => import('@/features/twin/TwinView.vue'),
      meta: { label: '数字孪生' },
    },
    {
      path: '/governance',
      name: 'governance',
      component: () => import('@/features/governance/GovernanceView.vue'),
      meta: { label: '乡村治理' },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/features/not-found/NotFoundView.vue'),
    },
  ],
})

export default router
