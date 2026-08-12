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
    const summaryText = wrapper.get('.terrain-drawer__summary').text().replace(/\s+/g, '')
    expect(summaryText).toContain('抽样平均68.4m')
    expect(summaryText).toContain('抽样范围54–77m')
    expect(summaryText).toContain('抽样高差23m')
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
  })
})
