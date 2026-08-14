import { describe, expect, it } from 'vitest'
import { isLineOfSightBlocked } from '@/features/twin/visibilityAnalysis'

describe('三生模拟通视判定', () => {
  it('识别观察点与目标点之间的遮挡', () => {
    expect(isLineOfSightBlocked(100, 42)).toBe(true)
  })

  it('忽略观察点附近的误拾取', () => {
    expect(isLineOfSightBlocked(100, 1.5)).toBe(false)
  })

  it('忽略目标点端点容差内的命中', () => {
    expect(isLineOfSightBlocked(100, 99.5)).toBe(false)
  })

  it('没有有效命中时判定为可见', () => {
    expect(isLineOfSightBlocked(100)).toBe(false)
    expect(isLineOfSightBlocked(100, Number.POSITIVE_INFINITY)).toBe(false)
  })
})
