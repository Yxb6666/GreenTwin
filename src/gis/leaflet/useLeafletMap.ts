import { nextTick, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import L from 'leaflet'
import { loadSuperMapLeaflet } from './loadSdk'

export interface MapPoint {
  id: string
  name: string
  lat: number
  lng: number
  color: string
  value?: string | number
}

export function useLeafletMap(container: Ref<HTMLElement | null>) {
  const map = shallowRef<L.Map | null>(null)
  const markerLayer = shallowRef<L.LayerGroup | null>(null)
  const error = ref('')
  let resizeObserver: ResizeObserver | null = null
  let disposed = false

  async function initialize(
    sdkUrl: string,
    serviceUrl: string,
    center: [number, number],
    zoom: number,
    crsCode: 'EPSG4326' | 'EPSG3857',
  ) {
    await nextTick()
    if (!container.value || map.value) return

    try {
      const instance = L.map(container.value, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        crs: crsCode === 'EPSG4326' ? L.CRS.EPSG4326 : L.CRS.EPSG3857,
      }).setView(center, zoom)

      if (disposed) {
        instance.remove()
        return
      }

      markerLayer.value = L.layerGroup().addTo(instance)
      map.value = instance

      resizeObserver = new ResizeObserver(() => instance.invalidateSize({ animate: false }))
      resizeObserver.observe(container.value)
      window.setTimeout(() => instance.invalidateSize({ animate: false }), 80)

      void loadSuperMapLeaflet(sdkUrl)
        .then((superMapLeaflet) => {
          if (disposed) return
          const baseLayer = superMapLeaflet.supermap!.tiledMapLayer(serviceUrl, { transparent: false })
          baseLayer.on('tileerror', () => {
            error.value = '二维地图服务响应异常，请检查 iServer 地址、坐标系与跨域配置。'
          })
          baseLayer.addTo(instance)
        })
        .catch((cause: unknown) => {
          error.value = cause instanceof Error ? cause.message : 'SuperMap iClient Leaflet SDK 加载失败'
        })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '二维地图初始化失败'
    }
  }

  function setPoints(points: MapPoint[], onSelect?: (id: string) => void) {
    if (!map.value || !markerLayer.value) return
    markerLayer.value.clearLayers()
    for (const point of points) {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 7,
        color: '#f4fffd',
        weight: 1.5,
        fillColor: point.color,
        fillOpacity: 0.88,
      })
      marker.bindTooltip(
        `<strong>${point.name}</strong>${point.value === undefined ? '' : `<br>${point.value}`}`,
        { direction: 'top', opacity: 0.92 },
      )
      if (onSelect) marker.on('click', () => onSelect(point.id))
      marker.addTo(markerLayer.value)
    }
  }

  function dispose() {
    disposed = true
    resizeObserver?.disconnect()
    resizeObserver = null
    markerLayer.value?.clearLayers()
    map.value?.remove()
    markerLayer.value = null
    map.value = null
  }

  onBeforeUnmount(dispose)
  return { map, error, initialize, setPoints, dispose }
}
