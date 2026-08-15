import { describe, expect, it } from 'vitest'
import {
  clampModelScale,
  formatPointLabel,
  normalizeHeading,
  normalizePoint,
  resolveFixedScreenModelScale,
} from '@/features/twin/modelPlacement'

describe('模型落点与变换工具', () => {
  it('规范化并截断用户点坐标', () => {
    expect(
      normalizePoint(114.97012345, 34.95112345, 12.345, 400, ' 测试点 '),
    ).toEqual({
      longitude: 114.970123,
      latitude: 34.951123,
      height: 12.35,
      heading: 40,
      label: '测试点',
      accuracy: 'user-picked',
    })
  })

  it('将越界坐标收敛到合法范围', () => {
    expect(normalizePoint(200, 95).longitude).toBe(180)
    expect(normalizePoint(200, 95).latitude).toBe(90)
    expect(normalizePoint(-200, -95).longitude).toBe(-180)
    expect(normalizePoint(-200, -95).latitude).toBe(-90)
  })

  it('格式化东经北纬标签', () => {
    expect(formatPointLabel(114.970123, 34.951123)).toBe(
      '东经 114.970123° · 北纬 34.951123°',
    )
  })

  it('将朝向归一到 0-360 度', () => {
    expect(normalizeHeading(400)).toBe(40)
    expect(normalizeHeading(-30)).toBe(330)
    expect(normalizeHeading(Number.NaN)).toBe(0)
  })

  it('限制模型缩放范围', () => {
    expect(clampModelScale(0.05)).toBe(0.2)
    expect(clampModelScale(20)).toBe(8)
    expect(clampModelScale(2.4)).toBe(2.4)
    expect(clampModelScale(Number.NaN)).toBe(1)
  })

  it('根据相机距离补偿模型比例以保持屏幕尺寸', () => {
    expect(resolveFixedScreenModelScale(2.5, 100, 200)).toBe(5)
    expect(resolveFixedScreenModelScale(2.5, 100, 50)).toBe(1.25)
    expect(resolveFixedScreenModelScale(2.5, 0, 200)).toBe(2.5)
  })
})
