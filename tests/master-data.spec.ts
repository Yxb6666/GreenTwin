import { describe, expect, it } from 'vitest'
import {
  calculatePopulationChangeRate,
  gdpTrend,
  getPopulationTrendLabel,
  latestDensityRecord,
  latestPopulation,
  latestPopulationDensity,
  latestPopulationGrowth,
  populationTrend,
} from '@/features/master/data'

describe('主控大屏人口与 GDP 数据', () => {
  it('使用 Excel 中最新的县域人口与密度数据', () => {
    expect(latestPopulation).toMatchObject({ year: 2025, populationWan: 76 })
    expect(latestPopulationGrowth).toBe(0)
    expect(latestDensityRecord).toMatchObject({ year: 2024, areaKm2: 1103 })
    expect(latestPopulationDensity).toBe(689)
  })

  it('仅展示 2020 至 2025 年的真实人口序列', () => {
    expect(populationTrend.map((item) => item.year)).toEqual([
      2020, 2021, 2022, 2023, 2024, 2025,
    ])
    expect(populationTrend.map((item) => item.populationWan)).toEqual([
      78, 76, 76, 76, 76, 76,
    ])
  })

  it('根据县域历史数据计算变化率与趋势标签', () => {
    expect(calculatePopulationChangeRate(populationTrend)).toBe(-2.6)
    expect(getPopulationTrendLabel(-2.6)).toBe('总体稳定')
    expect(getPopulationTrendLabel(4)).toBe('小幅增长')
    expect(getPopulationTrendLabel(-4)).toBe('小幅下降')
  })

  it('将 Excel 中以万元计的 GDP 转换为亿元并按最大值绘图', () => {
    expect(gdpTrend.at(-1)).toMatchObject({
      year: 2025,
      gdpYiYuan: 475.28,
      barPercent: 100,
    })
    expect(gdpTrend.map((item) => item.year)).toEqual([
      2020, 2021, 2022, 2023, 2024, 2025,
    ])
    expect(gdpTrend[0]?.gdpYiYuan).toBeCloseTo(383.2374)
  })
})
