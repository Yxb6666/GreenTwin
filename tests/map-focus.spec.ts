import type L from 'leaflet'
import { describe, expect, it, vi } from 'vitest'
import { focusMapOnLayer } from '@/gis/leaflet/mapFocus'

function mapController() {
  return {
    flyTo: vi.fn(),
    flyToBounds: vi.fn(),
  } as unknown as Pick<L.Map, 'flyTo' | 'flyToBounds'>
}

describe('地图视图复位', () => {
  it('优先以行政区划图层范围居中', () => {
    const map = mapController()
    const bounds: [[number, number], [number, number]] = [
      [34.744, 114.687],
      [35.026, 115.261],
    ]

    focusMapOnLayer(map, bounds, [34.82, 114.82], 10)

    expect(map.flyToBounds).toHaveBeenCalledWith(bounds, {
      duration: 0.8,
      padding: [20, 20],
      maxZoom: 11.5,
    })
    expect(map.flyTo).not.toHaveBeenCalled()
  })

  it('图层范围不可用时回退到运行时默认视图', () => {
    const map = mapController()

    focusMapOnLayer(map, null, [34.82, 114.82], 10)

    expect(map.flyTo).toHaveBeenCalledWith([34.82, 114.82], 10, { duration: 0.8 })
    expect(map.flyToBounds).not.toHaveBeenCalled()
  })
})
