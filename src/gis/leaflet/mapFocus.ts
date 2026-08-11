import type L from 'leaflet'
import type { GeographicBounds } from './serviceBounds'

type MapFocusController = Pick<L.Map, 'flyTo' | 'flyToBounds'>
type TownshipFocusController = Pick<L.Map, 'flyToBounds' | 'getContainer'>
type TownshipLayer = Pick<L.Polygon, 'getBounds'>

const MAP_TOOL_ACTIVE_CLASSES = [
  'map-is-measuring',
  'map-is-drawing',
  'map-is-selecting',
  'map-is-spatial-querying',
  'leaflet-draw-drawing',
]

export const TOWNSHIP_FOCUS_START_EVENT = 'townshipfocusstart'

export const TOWNSHIP_FOCUS_OPTIONS: L.FitBoundsOptions = {
  duration: 0.7,
  padding: [60, 60],
  maxZoom: 13,
}

export function isTownshipInteractionBlocked(map: Pick<L.Map, 'getContainer'>) {
  const container = map.getContainer()
  return MAP_TOOL_ACTIVE_CLASSES.some((className) => container.classList.contains(className))
}

export function focusMapOnLayer(
  map: MapFocusController,
  layerBounds: GeographicBounds | null,
  fallbackCenter: [number, number],
  fallbackZoom: number,
) {
  if (layerBounds) {
    map.flyToBounds(layerBounds, { duration: 0.8, padding: [20, 20], maxZoom: 11.5 })
    return
  }

  map.flyTo(fallbackCenter, fallbackZoom, { duration: 0.8 })
}

export function focusMapOnTownship(map: TownshipFocusController, layer: TownshipLayer, beforeFocus?: () => void) {
  if (isTownshipInteractionBlocked(map)) return false

  const bounds = layer.getBounds()
  if (!bounds.isValid()) return false

  beforeFocus?.()
  map.flyToBounds(bounds, TOWNSHIP_FOCUS_OPTIONS)
  return true
}
