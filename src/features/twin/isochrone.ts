import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'

export type IsochroneProfile = 'walking' | 'cycling' | 'driving'
export type IsochroneGeometry = Polygon | MultiPolygon

export interface IsochroneOptions {
  accessToken: string
  longitude: number
  latitude: number
  profile: IsochroneProfile
  minutes: number[]
  signal?: AbortSignal
}

export const ISOCHRONE_COLORS = ['3dd6c4', '4ea7ff', '9b7dff', 'f0b85c']

export function normalizeIsochroneMinutes(minutes: number[]) {
  return [...new Set(minutes.map((value) => Math.round(value)))]
    .filter((value) => value >= 1 && value <= 60)
    .sort((left, right) => left - right)
    .slice(0, 4)
}

export function buildIsochroneUrl(options: IsochroneOptions) {
  const token = options.accessToken.trim()
  if (!token) throw new Error('请先配置 Mapbox Access Token')
  const minutes = normalizeIsochroneMinutes(options.minutes)
  if (!minutes.length) throw new Error('请至少选择一个等时圈时长')
  const longitude = Number(options.longitude)
  const latitude = Number(options.latitude)
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('公园落点经度无效')
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('公园落点纬度无效')
  }
  const params = new URLSearchParams({
    contours_minutes: minutes.join(','),
    contours_colors: ISOCHRONE_COLORS.slice(0, minutes.length).join(','),
    polygons: 'true',
    denoise: '1',
    generalize: '25',
    access_token: token,
  })
  return `https://api.mapbox.com/isochrone/v1/mapbox/${options.profile}/${longitude},${latitude}?${params}`
}

export async function requestIsochrones(options: IsochroneOptions) {
  const response = await fetch(buildIsochroneUrl(options), {
    signal: options.signal,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : `HTTP ${response.status}`
    throw new Error(`Mapbox 等时圈分析失败：${message}`)
  }
  if (!payload || typeof payload !== 'object' || !('features' in payload)) {
    throw new Error('Mapbox 返回了无法识别的等时圈数据')
  }
  return payload as FeatureCollection<
    IsochroneGeometry,
    { contour?: number; color?: string }
  >
}
