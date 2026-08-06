import { describe, expect, it } from 'vitest'
import { isTownshipAdministrativeCode, parseTownshipFeatures } from '@/gis/leaflet/townshipFeatures'

function feature(code: string, parts = [4]) {
  return {
    fieldValues: [code, '测试乡镇'],
    geometry: {
      parts,
      points: [
        { x: 114.8, y: 34.8 },
        { x: 114.9, y: 34.8 },
        { x: 114.9, y: 34.9 },
        { x: 114.8, y: 34.8 },
      ],
    },
  }
}

describe('乡镇要素筛选', () => {
  it('保留街道、镇、乡并排除林场等类似乡级单位', () => {
    expect(isTownshipAdministrativeCode('410225101')).toBe(true)
    expect(isTownshipAdministrativeCode('410225210')).toBe(true)
    expect(isTownshipAdministrativeCode('410225402')).toBe(false)
  })

  it('将 iServer 坐标转换为 Leaflet 纬经度坐标', () => {
    const result = parseTownshipFeatures({
      recordsets: [{ features: [feature('410225101'), feature('410225402')] }],
    })

    expect(result).toEqual([
      {
        code: '410225101',
        name: '测试乡镇',
        rings: [
          [
            [34.8, 114.8],
            [34.8, 114.9],
            [34.9, 114.9],
            [34.8, 114.8],
          ],
        ],
      },
    ])
  })

  it('丢弃点数与分段信息不一致的损坏几何', () => {
    expect(parseTownshipFeatures({ recordsets: [{ features: [feature('410225101', [5])] }] })).toEqual([])
  })
})
