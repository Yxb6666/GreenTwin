import type L from 'leaflet'
import type { GeographicBounds } from './serviceBounds'

type MapFocusController = Pick<L.Map, 'flyTo' | 'flyToBounds'>
type TownshipFocusController = Pick<L.Map, 'flyToBounds' | 'getContainer'>
type TownshipLayer = Pick<L.Polygon, 'getBounds'>

export const TOWNSHIP_FOCUS_OPTIONS: L.FitBoundsOptions = {
  duration: 0.7,
  padding: [40, 40],
  maxZoom: 13,
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

export function focusMapOnTownship(map: TownshipFocusController, layer: TownshipLayer) {
  if (map.getContainer().classList.contains('map-is-measuring')) return false

  const bounds = layer.getBounds()
  if (!bounds.isValid()) return false

  map.flyToBounds(bounds, TOWNSHIP_FOCUS_OPTIONS)
  return true
}
