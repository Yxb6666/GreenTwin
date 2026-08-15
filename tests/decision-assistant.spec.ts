import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DecisionAssistant from '@/shared/assistant/DecisionAssistant.vue'
import { requestDecisionAssistant } from '@/shared/assistant/assistant'
import {
  AI_ASSISTANT_LAUNCHER_KEY,
  AI_ASSISTANT_PANEL_KEY,
  clampPanelPosition,
  clampPanelRect,
  resizePanelRect,
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

  it('隐藏图片按钮文字并支持从剪贴板粘贴图片附件', async () => {
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
    document.body
      .querySelector<HTMLButtonElement>('.assistant-launcher')
      ?.click()
    await wrapper.vm.$nextTick()

    const attachButton = document.body.querySelector<HTMLButtonElement>(
      '.assistant-attach-button',
    )!
    expect(attachButton.textContent?.trim()).toBe('＋')
    expect(attachButton.getAttribute('aria-label')).toBe('添加图片')

    const image = new File([new Uint8Array([137, 80, 78, 71])], '截图.png', {
      type: 'image/png',
    })
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        files: [image],
        items: [
          {
            type: 'image/png',
            getAsFile: () => image,
          },
        ],
      },
    })
    document.body.querySelector('textarea')?.dispatchEvent(pasteEvent)

    expect(pasteEvent.defaultPrevented).toBe(true)
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('图片已就绪：截图.png'),
    )
    expect(
      document.body.querySelector<HTMLImageElement>(
        '.assistant-attachment-status img',
      )?.src,
    ).toMatch(/^data:image\/png;base64,/)
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
    expect(
      clampPanelRect(
        { x: -20, y: -20, width: 360, height: 420 },
        { width: 320, height: 400 },
      ),
    ).toEqual({ x: 16, y: 16, width: 288, height: 368 })
  })

  it('从不同方向缩放时保持对边固定并遵守最小尺寸', () => {
    const start = { x: 100, y: 100, width: 410, height: 500 }
    const viewport = { width: 1024, height: 768 }

    expect(resizePanelRect(start, 'e', { x: 100, y: 0 }, viewport)).toEqual({
      ...start,
      width: 510,
    })
    expect(resizePanelRect(start, 'w', { x: 200, y: 0 }, viewport)).toEqual({
      x: 150,
      y: 100,
      width: 360,
      height: 500,
    })
    expect(resizePanelRect(start, 'n', { x: 0, y: 300 }, viewport)).toEqual({
      x: 100,
      y: 180,
      width: 410,
      height: 420,
    })
    expect(
      resizePanelRect(start, 'se', { x: 2000, y: 2000 }, viewport),
    ).toEqual({ x: 100, y: 100, width: 908, height: 652 })
  })

  it('区分入口按钮点击和拖动，并记忆受边界限制的位置', async () => {
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
    const launcher = document.body.querySelector<HTMLButtonElement>(
      '.assistant-launcher',
    )!
    Object.defineProperties(launcher, {
      offsetHeight: { configurable: true, value: 42 },
      offsetLeft: { configurable: true, value: 800 },
      offsetTop: { configurable: true, value: 680 },
      offsetWidth: { configurable: true, value: 120 },
    })

    launcher.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 850, clientY: 700 }),
    )
    launcher.dispatchEvent(
      pointerEvent('pointermove', { clientX: 853, clientY: 704 }),
    )
    launcher.dispatchEvent(
      pointerEvent('pointerup', { clientX: 853, clientY: 704 }),
    )
    launcher.click()
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.assistant-panel')).not.toBeNull()

    document.body
      .querySelector<HTMLButtonElement>('[aria-label="关闭 AI 助手"]')
      ?.click()
    await wrapper.vm.$nextTick()

    launcher.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 850, clientY: 700 }),
    )
    launcher.dispatchEvent(
      pointerEvent('pointermove', { clientX: -100, clientY: -100 }),
    )
    launcher.dispatchEvent(
      pointerEvent('pointerup', { clientX: -100, clientY: -100 }),
    )
    launcher.click()
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('.assistant-panel')).toBeNull()
    expect(launcher.style.left).toBe('16px')
    expect(launcher.style.top).toBe('16px')
    expect(
      JSON.parse(localStorage.getItem(AI_ASSISTANT_LAUNCHER_KEY)!),
    ).toEqual({ x: 16, y: 16 })

    launcher.click()
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.assistant-panel')).not.toBeNull()
    wrapper.unmount()
  })

  it('通过标题栏拖动并记忆位置，交互按钮不会触发拖动', async () => {
    localStorage.setItem(
      AI_ASSISTANT_PANEL_KEY,
      JSON.stringify({ x: 100, y: 100, width: 410, height: 600 }),
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
    expect(JSON.parse(localStorage.getItem(AI_ASSISTANT_PANEL_KEY)!)).toEqual({
      x: window.innerWidth - 426,
      y: window.innerHeight - 616,
      width: 410,
      height: 600,
    })

    header?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(localStorage.getItem(AI_ASSISTANT_PANEL_KEY)).toBeNull()

    wrapper.unmount()
  })

  it('通过缩放热区调整并记忆面板尺寸', async () => {
    localStorage.setItem(
      AI_ASSISTANT_PANEL_KEY,
      JSON.stringify({ x: 100, y: 100, width: 410, height: 500 }),
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
    document.body
      .querySelector<HTMLButtonElement>('.assistant-launcher')
      ?.click()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const panel = document.body.querySelector<HTMLElement>('.assistant-panel')!
    const southeastHandle = panel.querySelector<HTMLElement>(
      '.assistant-resize-handle.is-se',
    )!
    expect(panel.querySelectorAll('.assistant-resize-handle')).toHaveLength(8)

    southeastHandle.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 510, clientY: 600 }),
    )
    southeastHandle.dispatchEvent(
      pointerEvent('pointermove', { clientX: 2000, clientY: 2000 }),
    )
    window.dispatchEvent(
      pointerEvent('pointerup', { clientX: 2000, clientY: 2000 }),
    )
    await wrapper.vm.$nextTick()

    expect(document.body.style.userSelect).toBe('')
    expect(panel.style.width).toBe(`${window.innerWidth - 116}px`)
    expect(panel.style.height).toBe(`${window.innerHeight - 116}px`)
    expect(JSON.parse(localStorage.getItem(AI_ASSISTANT_PANEL_KEY)!)).toEqual({
      x: 100,
      y: 100,
      width: window.innerWidth - 116,
      height: window.innerHeight - 116,
    })

    wrapper.unmount()
  })
})
