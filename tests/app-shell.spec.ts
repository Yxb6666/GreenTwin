import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import AppShell from '@/app/AppShell.vue'

function fragmentPage(label: string) {
  return defineComponent({
    setup: () => () => [h('main', label), h('aside', `${label}助手`)],
  })
}

describe('应用模块路由切换', () => {
  it('多根节点页面切换后仍能完成挂载', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/master', component: fragmentPage('三生空间') },
        { path: '/governance', component: fragmentPage('三生治理') },
        { path: '/twin', component: fragmentPage('三生模拟') },
        { path: '/sansheng', component: fragmentPage('三生评估') },
      ],
    })

    await router.push('/master')
    await router.isReady()
    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: { plugins: [createPinia(), router] },
    })

    expect(wrapper.text()).toContain('三生空间')
    await router.push('/governance')
    await new Promise((resolve) => window.setTimeout(resolve, 200))
    await nextTick()

    expect(wrapper.text()).toContain('三生治理')
    expect(wrapper.find('main').exists()).toBe(true)
    wrapper.unmount()
  })
})
