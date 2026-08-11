import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DecisionAssistant from '@/shared/assistant/DecisionAssistant.vue'
import { requestDecisionAssistant } from '@/shared/assistant/assistant'

describe('通用 AI 决策助手前端请求', () => {
  it('发送模块上下文并解析结构化回答', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: '建议优先优化生活空间。',
          evidence: ['生活空间得分为 62。'],
          suggestions: ['核验公共服务设施可达性。'],
          disclaimer: '仅基于当前页面数据。',
          scopeLabel: '仪封镇 · 生活空间',
          meta: {
            model: 'deepseek-v4-flash',
            generatedAt: '2026-08-11T00:00:00Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await requestDecisionAssistant(
      '/api/assistant/decision',
      1000,
      {
        question: '短板是什么？',
        history: [],
        context: {
          module: '三生评估',
          scopeLabel: '仪封镇 · 生活空间',
          updatedAt: '2026-08-11T00:00:00Z',
          data: { scores: { ecology: 80, life: 62, production: 85 } },
        },
      },
    )

    expect(result.suggestions).toEqual(['核验公共服务设施可达性。'])
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      question: '短板是什么？',
      context: { module: '三生评估' },
    })
  })

  it('展示模块入口并在弹层中标明实时上下文', async () => {
    const wrapper = mount(DecisionAssistant, {
      attachTo: document.body,
      props: {
        endpoint: '/api/assistant/decision',
        timeoutMs: 1000,
        context: {
          module: '三生模拟',
          scopeLabel: '道路积水治理 · 方案 A',
          updatedAt: '2026-08-11T00:00:00Z',
          data: { composite: 82.3, risk: '低' },
        },
        prompts: ['评估当前方案'],
      },
    })

    const launcher = document.body.querySelector<HTMLButtonElement>(
      '.assistant-launcher',
    )
    expect(launcher?.textContent).toContain('AI 决策助手')
    launcher?.click()
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('三生模拟决策助手')
    expect(document.body.textContent).toContain('道路积水治理 · 方案 A')
    wrapper.unmount()
  })
})
