import { describe, expect, it } from 'vitest'
import { parseIServerMapBounds } from '@/gis/leaflet/serviceBounds'

describe('iServer 地图范围', () => {
  it('转换为 Leaflet 使用的西南与东北纬经度坐标', () => {
    expect(
      parseIServerMapBounds({
        bounds: { left: 114.687, bottom: 34.744, right: 115.261, top: 35.026 },
      }),
    ).toEqual([
      [34.744, 114.687],
      [35.026, 115.261],
    ])
  })

  it('拒绝缺失、非数值或方向颠倒的范围', () => {
    expect(parseIServerMapBounds(null)).toBeNull()
    expect(parseIServerMapBounds({ bounds: { left: '114', bottom: 34, right: 115, top: 35 } })).toBeNull()
    expect(parseIServerMapBounds({ bounds: { left: 115, bottom: 34, right: 114, top: 35 } })).toBeNull()
  })
})
