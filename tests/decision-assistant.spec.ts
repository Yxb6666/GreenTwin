import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DecisionAssistant from '@/shared/assistant/DecisionAssistant.vue'
import { requestDecisionAssistant } from '@/shared/assistant/assistant'
import {
  AI_ASSISTANT_POSITION_KEY,
  clampPanelPosition,
} from '@/shared/composables/useDraggablePanel'

function pointerEvent(
  type: string,
  { clientX, clientY, pointerId = 1 }: PointerEventInit,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX,
    clientY,
  })
  Object.defineProperties(event, {
    isPrimary: { value: true },
    pointerId: { value: pointerId },
    pointerType: { value: 'mouse' },
  })
  return event
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

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

  it('将拖拽位置限制在带安全边距的可视区域内', () => {
    expect(
      clampPanelPosition(
        { x: 2000, y: -100 },
        { width: 410, height: 600 },
        { width: 1024, height: 768 },
      ),
    ).toEqual({ x: 598, y: 16 })
  })

  it('通过标题栏拖动并记忆位置，交互按钮不会触发拖动', async () => {
    localStorage.setItem(
      AI_ASSISTANT_POSITION_KEY,
      JSON.stringify({ x: 100, y: 100 }),
    )
    const wrapper = mount(DecisionAssistant, {
      attachTo: document.body,
      props: {
        endpoint: '/api/assistant/decision',
        timeoutMs: 1000,
        context: {
          module: '三生模拟',
          scopeLabel: '方案 A',
          updatedAt: '2026-08-11T00:00:00Z',
          data: { composite: 82.3 },
        },
        prompts: ['评估当前方案'],
      },
    })
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(410)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600)

    document.body
      .querySelector<HTMLButtonElement>('.assistant-launcher')
      ?.click()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const panel = document.body.querySelector<HTMLElement>('.assistant-panel')
    const header = document.body.querySelector<HTMLElement>('.assistant-header')
    const closeButton = header?.querySelector<HTMLButtonElement>('button')
    await vi.waitFor(() => expect(panel?.style.left).toBe('100px'))
    expect(panel?.style.top).toBe('100px')
    expect(panel).not.toBeNull()
    expect(header).not.toBeNull()

    Object.defineProperties(panel!, {
      offsetHeight: { configurable: true, value: 600 },
      offsetWidth: { configurable: true, value: 410 },
    })
    panel!.getBoundingClientRect = () =>
      ({
        bottom: 700,
        height: 600,
        left: 100,
        right: 510,
        top: 100,
        width: 410,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect

    closeButton?.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 120, clientY: 120 }),
    )
    expect(panel?.classList.contains('is-dragging')).toBe(false)

    header?.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 120, clientY: 120 }),
    )
    header?.dispatchEvent(
      pointerEvent('pointermove', { clientX: 2000, clientY: 2000 }),
    )
    header?.dispatchEvent(
      pointerEvent('pointerup', { clientX: 2000, clientY: 2000 }),
    )
    await wrapper.vm.$nextTick()

    expect(panel?.style.left).toBe(`${window.innerWidth - 426}px`)
    expect(panel?.style.top).toBe(`${window.innerHeight - 616}px`)
    expect(
      JSON.parse(localStorage.getItem(AI_ASSISTANT_POSITION_KEY)!),
    ).toEqual({
      x: window.innerWidth - 426,
      y: window.innerHeight - 616,
    })

    header?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(panel?.style.left).toBe('')
    expect(localStorage.getItem(AI_ASSISTANT_POSITION_KEY)).toBeNull()

    wrapper.unmount()
  })
})
