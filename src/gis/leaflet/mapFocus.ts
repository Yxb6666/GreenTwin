import type L from 'leaflet'
import type { GeographicBounds } from './serviceBounds'

type MapFocusController = Pick<L.Map, 'flyTo' | 'flyToBounds'>

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
