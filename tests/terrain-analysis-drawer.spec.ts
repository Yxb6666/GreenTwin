import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TerrainAnalysisDrawer from '@/features/master/TerrainAnalysisDrawer.vue'
import type { DemSummary } from '@/features/master/demService'

const summary: DemSummary = {
  collectionId: 'Lankao-DEM',
  crs: 'EPSG:4326',
  fileName: 'Lankao_Dem.tif',
  width: 2069,
  height: 1015,
  pixelSizeDegrees: 0.000277777778,
  thumbnailUrl: 'https://example.test/dem.png',
  averageElevationM: 68.4,
  minimumElevationM: 54,
  maximumElevationM: 77,
  validSampleCount: 20,
}

function dispatchPointerEvent(type: string, init: { clientY: number; pointerId: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    clientY: { value: init.clientY },
    pointerId: { value: init.pointerId },
  })
  window.dispatchEvent(event)
}

describe('主控页面地形分析抽屉', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('innerHeight', 1000)
  })

  afterEach(() => {
    document.body.classList.remove('terrain-resizing')
    vi.unstubAllGlobals()
  })

  it('默认折叠并显示真实抽样概况', () => {
    const wrapper = mount(TerrainAnalysisDrawer, {
      props: { summary, loading: false, error: '' },
    })

    expect(wrapper.classes()).not.toContain('is-expanded')
    expect(wrapper.get('.terrain-drawer__summary').attributes('aria-expanded')).toBe('false')
    const summaryText = wrapper.get('.terrain-drawer__summary').text().replace(/\s+/g, '')
    expect(summaryText).toContain('抽样平均68.4m')
    expect(summaryText).toContain('抽样范围54–77m')
    expect(summaryText).toContain('抽样高差23m')
    wrapper.unmount()
  })

  it('展开后只显示完整 DEM、四项指标与真实数据说明', async () => {
    const wrapper = mount(TerrainAnalysisDrawer, {
      props: { summary, loading: false, error: '' },
    })

    await wrapper.get('.terrain-drawer__summary').trigger('click')
    expect(wrapper.classes()).toContain('is-expanded')
    expect(wrapper.get('.terrain-drawer__summary').text()).not.toContain('抽样平均')
    expect(wrapper.get('.terrain-drawer__summary').text()).not.toContain('DEM 地形数据概览')
    expect(wrapper.findAll('.terrain-stat-grid article')).toHaveLength(4)
    expect(wrapper.get('.terrain-indicators p').text().replace(/\s+/g, '')).toContain('当前统计基于20个有效抽样点')
    expect(wrapper.text()).toContain('Lankao_Dem.tif · 2069×1015 · EPSG:4326')
    expect(wrapper.text()).not.toContain('坡度分析')
    expect(wrapper.text()).not.toContain('地形晕渲')
    expect(wrapper.text()).not.toContain('地形统计')
    expect(wrapper.text()).not.toContain('高程分布')

    await wrapper.get('.terrain-drawer__summary').trigger('click')
    expect(wrapper.classes()).not.toContain('is-expanded')
    wrapper.unmount()
  })

  it('通过顶部 handle 调整高度、限制范围并在重新展开后保留高度', async () => {
    const wrapper = mount(TerrainAnalysisDrawer, {
      props: { summary, loading: false, error: '' },
      attachTo: document.body,
    })

    await wrapper.get('.terrain-drawer__summary').trigger('click')
    const handle = wrapper.get('.terrain-resize-handle')
    const handleElement = handle.element as HTMLElement
    handleElement.setPointerCapture = vi.fn()
    handleElement.hasPointerCapture = vi.fn(() => true)
    handleElement.releasePointerCapture = vi.fn()

    await handle.trigger('pointerdown', { button: 0, clientY: 500, pointerId: 7 })
    expect(wrapper.classes()).toContain('is-resizing')
    expect(document.body.classList.contains('terrain-resizing')).toBe(true)
    expect(handleElement.setPointerCapture).toHaveBeenCalledWith(7)

    dispatchPointerEvent('pointermove', { clientY: 420, pointerId: 7 })
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('style')).toContain('--terrain-drawer-height: 510px')

    dispatchPointerEvent('pointermove', { clientY: 900, pointerId: 7 })
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('style')).toContain('--terrain-drawer-height: 320px')

    dispatchPointerEvent('pointermove', { clientY: 0, pointerId: 7 })
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('style')).toContain('--terrain-drawer-height: 600px')

    dispatchPointerEvent('pointerup', { clientY: 0, pointerId: 7 })
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('is-resizing')
    expect(document.body.classList.contains('terrain-resizing')).toBe(false)
    expect(window.localStorage.getItem('greentwin.master.terrain.height')).toBe('600')

    await wrapper.get('.terrain-drawer__summary').trigger('click')
    await wrapper.get('.terrain-drawer__summary').trigger('click')
    expect(wrapper.attributes('style')).toContain('--terrain-drawer-height: 600px')

    vi.stubGlobal('innerHeight', 720)
    window.dispatchEvent(new Event('resize'))
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('style')).toContain('--terrain-drawer-height: 446px')

    await wrapper.get('.terrain-resize-handle').trigger('dblclick')
    expect(wrapper.attributes('style')).toContain('--terrain-drawer-height: 430px')

    const currentHandle = wrapper.get('.terrain-resize-handle')
    const currentHandleElement = currentHandle.element as HTMLElement
    currentHandleElement.setPointerCapture = vi.fn()
    currentHandleElement.hasPointerCapture = vi.fn(() => true)
    currentHandleElement.releasePointerCapture = vi.fn()
    await currentHandle.trigger('pointerdown', { button: 0, clientY: 500, pointerId: 8 })
    dispatchPointerEvent('pointercancel', { clientY: 500, pointerId: 8 })
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('is-resizing')
    expect(document.body.classList.contains('terrain-resizing')).toBe(false)
    wrapper.unmount()
  })

  it('从 localStorage 恢复经过安全校验的用户高度', async () => {
    window.localStorage.setItem('greentwin.master.terrain.height', '580')
    const wrapper = mount(TerrainAnalysisDrawer, {
      props: { summary, loading: false, error: '' },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('style')).toContain('--terrain-drawer-height: 580px')
    wrapper.unmount()
  })
})
