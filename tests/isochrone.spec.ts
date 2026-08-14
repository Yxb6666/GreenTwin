import { describe, expect, it, vi } from 'vitest'
import {
  buildIsochroneUrl,
  normalizeIsochroneMinutes,
  requestIsochrones,
  resolveIsochroneRenderStyle,
} from '@/features/twin/isochrone'

describe('Mapbox 公园等时圈分析', () => {
  it('清理时长并构造步行等时圈请求', () => {
    expect(normalizeIsochroneMinutes([15, 5, 10, 10, 99])).toEqual([5, 10, 15])
    const url = new URL(
      buildIsochroneUrl({
        accessToken: 'pk.test',
        longitude: 114.965,
        latitude: 34.95,
        profile: 'walking',
        minutes: [15, 5, 10],
      }),
    )
    expect(url.pathname).toBe('/isochrone/v1/mapbox/walking/114.965,34.95')
    expect(url.searchParams.get('contours_minutes')).toBe('5,10,15')
    expect(url.searchParams.get('polygons')).toBe('true')
  })

  it('缺少令牌时不发送请求', () => {
    expect(() =>
      buildIsochroneUrl({
        accessToken: '',
        longitude: 114.965,
        latitude: 34.95,
        profile: 'walking',
        minutes: [5],
      }),
    ).toThrow('Mapbox Access Token')
  })

  it('使用高对比半透明圈层且不回退为白色', () => {
    expect(resolveIsochroneRenderStyle(0)).toEqual({
      fill: [41 / 255, 78 / 255, 128 / 255, 0.78],
      outline: [32 / 255, 63 / 255, 108 / 255, 1],
    })
    expect(resolveIsochroneRenderStyle(2).fill).toEqual([
      218 / 255,
      220 / 255,
      136 / 255,
      0.82,
    ])
    expect(resolveIsochroneRenderStyle(99)).toEqual(
      resolveIsochroneRenderStyle(3),
    )
    expect(resolveIsochroneRenderStyle(0).fill.slice(0, 3)).not.toEqual([
      1, 1, 1,
    ])
  })

  it('返回 Mapbox 错误信息', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Not Authorized' }),
      }),
    )
    await expect(
      requestIsochrones({
        accessToken: 'bad-token',
        longitude: 114.965,
        latitude: 34.95,
        profile: 'walking',
        minutes: [5],
      }),
    ).rejects.toThrow('Not Authorized')
    vi.unstubAllGlobals()
  })
})
