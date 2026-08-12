import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
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

describe('主控页面地形分析抽屉', () => {
  it('默认折叠并显示真实抽样概况', () => {
    const wrapper = mount(TerrainAnalysisDrawer, {
      props: { summary, loading: false, error: '' },
    })

    expect(wrapper.classes()).not.toContain('is-expanded')
    expect(wrapper.get('.terrain-drawer__summary').attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).toContain('抽样平均高程68.4 m')
    expect(wrapper.text()).toContain('抽样高程范围54–77 m')
    expect(wrapper.text()).toContain('抽样最大高差23 m')
  })

  it('支持展开、切换待接入分析并收起', async () => {
    const wrapper = mount(TerrainAnalysisDrawer, {
      props: { summary, loading: false, error: '' },
    })

    await wrapper.get('.terrain-drawer__summary').trigger('click')
    expect(wrapper.classes()).toContain('is-expanded')
    expect(wrapper.text()).toContain('暂无真实高程频数统计')
    expect(wrapper.text()).toContain('Lankao_Dem.tif · 2069×1015 · EPSG:4326')

    await wrapper.get('.terrain-drawer__tabs button:nth-child(2)').trigger('click')
    expect(wrapper.text()).toContain('尚未生成坡度分析结果')

    await wrapper.get('.terrain-drawer__summary').trigger('click')
    expect(wrapper.classes()).not.toContain('is-expanded')
  })
})
