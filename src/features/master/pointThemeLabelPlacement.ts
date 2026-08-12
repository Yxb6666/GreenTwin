import type { GeographicBounds } from '@/gis/leaflet/serviceBounds'
import type { TownshipPoint } from '@/gis/leaflet/townshipFeatures'

export type PointThemeLabelDirection = 'top' | 'right' | 'left' | 'bottom'

export interface PointThemeLabelPlacement {
  direction: PointThemeLabelDirection
  offset: [number, number]
  clusterTooltipDirection: PointThemeLabelDirection
}

const EDGE_RATIO = 0.2
const LABEL_GAP = 16
const CLUSTER_LABEL_HALF_SIZE = 16

export function getPointThemeLabelPlacement(
  point: TownshipPoint,
  countyBounds: GeographicBounds,
  clusterRadius: number,
  preferredDirection?: PointThemeLabelDirection,
): PointThemeLabelPlacement {
  const [[south, west], [north, east]] = countyBounds
  const latitudeRatio =
    (point[0] - south) / Math.max(north - south, Number.EPSILON)
  const longitudeRatio =
    (point[1] - west) / Math.max(east - west, Number.EPSILON)
  const distance = Math.ceil(Math.max(clusterRadius, CLUSTER_LABEL_HALF_SIZE) + LABEL_GAP)
  const placementByDirection: Record<PointThemeLabelDirection, PointThemeLabelPlacement> = {
    top: { direction: 'top', offset: [0, -distance], clusterTooltipDirection: 'right' },
    right: { direction: 'right', offset: [distance, 0], clusterTooltipDirection: 'left' },
    left: { direction: 'left', offset: [-distance, 0], clusterTooltipDirection: 'right' },
    bottom: { direction: 'bottom', offset: [0, distance], clusterTooltipDirection: 'top' },
  }

  if (preferredDirection) return placementByDirection[preferredDirection]

  if (latitudeRatio >= 1 - EDGE_RATIO) {
    return placementByDirection.bottom
  }
  if (longitudeRatio <= EDGE_RATIO) {
    return placementByDirection.right
  }
  if (longitudeRatio >= 1 - EDGE_RATIO) {
    return placementByDirection.left
  }
  return placementByDirection.top
}
