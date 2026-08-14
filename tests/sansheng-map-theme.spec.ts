import { describe, expect, it } from 'vitest'
import {
  SANSHENG_MAP_METRICS,
  SANSHENG_SCORE_LEVELS,
  resolveSanshengScoreLevel,
} from '@/features/sansheng/mapTheme'

describe('三生评估地图分级设色', () => {
  it('提供综合与三类空间评价维度', () => {
    expect(SANSHENG_MAP_METRICS.map((item) => item.key)).toEqual([
      'composite',
      'ecology',
      'life',
      'production',
    ])
  })

  it.each([
    [100, '优秀'],
    [80, '优秀'],
    [79.9, '良好'],
    [60, '良好'],
    [40, '中等'],
    [20, '较低'],
    [0, '低'],
  ])('将 %s 分归入%s等级', (score, label) => {
    expect(resolveSanshengScoreLevel(score).label).toBe(label)
  })

  it('图例等级从高到低连续覆盖 0 到 100 分', () => {
    expect(SANSHENG_SCORE_LEVELS.map((item) => item.minimum)).toEqual([
      80, 60, 40, 20, 0,
    ])
    expect(SANSHENG_SCORE_LEVELS[0]?.range).toBe('80–100')
    expect(SANSHENG_SCORE_LEVELS.at(-1)?.range).toBe('0–19')
  })
})
