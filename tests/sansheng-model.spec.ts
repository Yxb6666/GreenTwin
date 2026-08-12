import { describe, expect, it } from 'vitest'
import { calculateCompositeScore, calculateDimensionScore, normalizeIndicator, normalizeWeights, scoreTown, towns } from '@/features/sansheng/model'

describe('三生空间评价模型', () => {
  it('将权重归一化为 1', () => {
    const weights = normalizeWeights({ ecology: 40, life: 30, production: 30 })
    expect(weights.ecology + weights.life + weights.production).toBeCloseTo(1)
  })

  it('在权重全为零时恢复默认比例', () => {
    expect(normalizeWeights({ ecology: 0, life: 0, production: 0 })).toEqual({ ecology: 0.34, life: 0.33, production: 0.33 })
  })

  it('正确处理负向和适中最优指标', () => {
    expect(normalizeIndicator(20, 'negative')).toBe(80)
    expect(normalizeIndicator(35, 'balanced')).toBe(100)
    expect(normalizeIndicator(70, 'balanced')).toBe(47.5)
  })

  it('输出范围有效且固定一位小数的综合得分', () => {
    const town = towns[0]!
    const dimension = calculateDimensionScore(town, 'ecology')
    const score = scoreTown(town, { ecology: 34, life: 33, production: 33 })
    expect(dimension).toBeGreaterThanOrEqual(0)
    expect(dimension).toBeLessThanOrEqual(100)
    expect(score.composite).toBeGreaterThanOrEqual(0)
    expect(score.composite).toBeLessThanOrEqual(100)
    expect(Number(score.composite.toFixed(1))).toBe(score.composite)
  })

  it('使用相同权重计算给定维度分数的综合得分', () => {
    expect(
      calculateCompositeScore(
        { ecology: 88, life: 82, production: 90 },
        { ecology: 34, life: 33, production: 33 },
      ),
    ).toBe(86.7)
  })
})
