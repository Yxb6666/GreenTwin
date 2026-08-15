import type { SimulationPlacement } from './simulation'

export interface PickedPoint {
  longitude: number
  latitude: number
  height: number
  heading: number
  label: string
  accuracy: 'user-picked'
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function normalizeHeading(degrees: number) {
  const value = Number(degrees)
  if (!Number.isFinite(value)) return 0
  return ((value % 360) + 360) % 360
}

export function normalizePoint(
  longitude: number,
  latitude: number,
  height = 0,
  heading = 0,
  label = '地图自定义落点',
): PickedPoint {
  return {
    longitude: Number(clamp(Number(longitude) || 0, -180, 180).toFixed(6)),
    latitude: Number(clamp(Number(latitude) || 0, -90, 90).toFixed(6)),
    height: Number(clamp(Number(height) || 0, -1000, 10000).toFixed(2)),
    heading: normalizeHeading(heading),
    label: label.trim().slice(0, 80) || '地图自定义落点',
    accuracy: 'user-picked',
  }
}

export function formatPointLabel(longitude: number, latitude: number) {
  const longitudeSuffix = longitude >= 0 ? '东经' : '西经'
  const latitudeSuffix = latitude >= 0 ? '北纬' : '南纬'
  return `${longitudeSuffix} ${Math.abs(longitude).toFixed(6)}° · ${latitudeSuffix} ${Math.abs(latitude).toFixed(6)}°`
}

export function clampModelScale(value: number) {
  const number = Number(value)
  return Number.isFinite(number) ? clamp(number, 0.2, 8) : 1
}

export function resolveFixedScreenModelScale(
  baseScale: number,
  referenceDistance: number,
  currentDistance: number,
) {
  if (
    !Number.isFinite(baseScale) ||
    !Number.isFinite(referenceDistance) ||
    !Number.isFinite(currentDistance) ||
    baseScale <= 0 ||
    referenceDistance <= 0 ||
    currentDistance <= 0
  ) {
    return baseScale
  }

  return baseScale * (currentDistance / referenceDistance)
}

export function toSimulationPlacement(point: PickedPoint): SimulationPlacement {
  return {
    longitude: point.longitude,
    latitude: point.latitude,
    height: point.height,
    heading: point.heading,
    label: point.label,
    accuracy: 'user-picked',
  }
}
