import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type L from 'leaflet'
import MapToolbox from '@/shared/components/MapToolbox.vue'

function createFakeMap() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    getPane: vi.fn(() => null),
    getContainer: vi.fn(() => ({
      classList: { add: vi.fn(), remove: vi.fn() },
      style: {},
    })),
    doubleClickZoom: { enable: vi.fn(), disable: vi.fn() },
    flyTo: vi.fn(),
    flyToBounds: vi.fn(),
  }
}

function mountToolbox(map: ReturnType<typeof createFakeMap>, extraProps: Record<string, unknown> = {}) {
  return mount(MapToolbox, {
    props: {
      map: map as unknown as L.Map,
      focusBounds: null,
      initialCenter: [34.82, 114.82] as [number, number],
      initialZoom: 11,
      activeBaseMap: 'natural',
      arcgisAvailable: false,
      changeBaseMap: () => true,
      resetSelection: vi.fn(),
      ...extraProps,
    },
  })
}

describe('地图工具栏行政区划复位', () => {
  it('提供 resetToAdministrative 时优先退出专题并复位视野', async () => {
    const map = createFakeMap()
    const resetSelection = vi.fn()
    const resetToAdministrative = vi.fn()
    const wrapper = mountToolbox(map, { resetSelection, resetToAdministrative })

    await wrapper.get('button[aria-label="以行政区划图层为中心"]').trigger('click')

    expect(resetToAdministrative).toHaveBeenCalledOnce()
    expect(resetSelection).not.toHaveBeenCalled()
    expect(map.flyTo).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('未提供 resetToAdministrative 时回退到 resetSelection 语义', async () => {
    const map = createFakeMap()
    const resetSelection = vi.fn()
    const wrapper = mountToolbox(map, { resetSelection })

    await wrapper.get('button[aria-label="以行政区划图层为中心"]').trigger('click')

    expect(resetSelection).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
