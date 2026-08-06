import { describe, expect, it } from 'vitest'
import { enhanceTownshipOverlayPixels } from '@/gis/leaflet/enhanceOverlayPixels'

describe('乡镇叠加层色彩增强', () => {
  it('保留透明区域并增强面填充和边界对比度', () => {
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 0,
      215, 227, 188, 61,
      89, 100, 73, 255,
    ])

    expect(Array.from(enhanceTownshipOverlayPixels(pixels))).toEqual([
      255, 255, 255, 0,
      20, 111, 84, 116,
      214, 237, 159, 255,
    ])
  })
})
