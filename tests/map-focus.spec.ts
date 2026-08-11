import type L from 'leaflet'
import { describe, expect, it, vi } from 'vitest'
import { focusMapOnLayer, focusMapOnTownship, TOWNSHIP_FOCUS_OPTIONS } from '@/gis/leaflet/mapFocus'

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

describe('乡镇行政区点击聚焦', () => {
  function townshipFocusController(measuring = false) {
    const container = document.createElement('div')
    if (measuring) container.classList.add('map-is-measuring')
    return {
      flyToBounds: vi.fn(),
      getContainer: vi.fn(() => container),
    } as unknown as Pick<L.Map, 'flyToBounds' | 'getContainer'>
  }

  function townshipLayer(valid = true) {
    const bounds = { isValid: vi.fn(() => valid) }
    return {
      layer: { getBounds: vi.fn(() => bounds) } as unknown as Pick<L.Polygon, 'getBounds'>,
      bounds,
    }
  }

  it('使用行政区自身范围平滑聚焦且限制最大层级', () => {
    const map = townshipFocusController()
    const { layer, bounds } = townshipLayer()

    expect(focusMapOnTownship(map, layer)).toBe(true)
    expect(layer.getBounds).toHaveBeenCalledOnce()
    expect(map.flyToBounds).toHaveBeenCalledWith(bounds, TOWNSHIP_FOCUS_OPTIONS)
    expect(TOWNSHIP_FOCUS_OPTIONS).toEqual({ duration: 0.7, padding: [40, 40], maxZoom: 13 })
  })

  it('测量模式中不触发行政区聚焦', () => {
    const map = townshipFocusController(true)
    const { layer } = townshipLayer()

    expect(focusMapOnTownship(map, layer)).toBe(false)
    expect(layer.getBounds).not.toHaveBeenCalled()
    expect(map.flyToBounds).not.toHaveBeenCalled()
  })

  it('行政区范围无效时安全退出', () => {
    const map = townshipFocusController()
    const { layer } = townshipLayer(false)

    expect(focusMapOnTownship(map, layer)).toBe(false)
    expect(map.flyToBounds).not.toHaveBeenCalled()
  })
})
