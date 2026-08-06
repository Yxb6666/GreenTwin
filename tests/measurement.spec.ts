import { describe, expect, it } from 'vitest'
import { calculateGeodesicArea, formatArea, formatDistance } from '@/gis/leaflet/measurement'

describe('地图测量结果', () => {
  it('根据量级格式化距离', () => {
    expect(formatDistance(386.4)).toBe('386 米')
    expect(formatDistance(1_286)).toBe('1.29 千米')
    expect(formatDistance(12_860)).toBe('12.9 千米')
  })

  it('根据量级格式化面积', () => {
    expect(formatArea(8_640)).toBe('8640 平方米')
    expect(formatArea(86_400)).toBe('8.64 公顷')
    expect(formatArea(2_860_000)).toBe('2.86 平方千米')
  })

  it('计算地理多边形面积并忽略少于三个点的输入', () => {
    expect(calculateGeodesicArea([{ lat: 34.8, lng: 114.8 }])).toBe(0)
    const area = calculateGeodesicArea([
      { lat: 34.8, lng: 114.8 },
      { lat: 34.8, lng: 114.81 },
      { lat: 34.81, lng: 114.81 },
      { lat: 34.81, lng: 114.8 },
    ])
    expect(area).toBeGreaterThan(1_000_000)
    expect(area).toBeLessThan(1_100_000)
  })
})
