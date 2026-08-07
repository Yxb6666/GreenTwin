import { nextTick, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import L from 'leaflet'
import { loadSuperMapLeaflet } from './loadSdk'
import { loadIServerMapBounds } from './serviceBounds'
import { loadTownshipFeatures, resolveTownshipMapServiceUrl } from './townshipFeatures'

const TOWNSHIP_STYLE: L.PathOptions = {
  color: '#d6ed9f',
  fillColor: '#146f54',
  fillOpacity: 0.48,
  opacity: 0.95,
  weight: 1.4,
}

export function useLeafletMap(container: Ref<HTMLElement | null>) {
  const map = shallowRef<L.Map | null>(null)
  const error = ref('')
  let resizeObserver: ResizeObserver | null = null
  let disposed = false

  async function initialize(
    sdkUrl: string,
    serviceUrl: string,
    center: [number, number],
    zoom: number,
    crsCode: 'EPSG4326' | 'EPSG3857',
    overlayServiceUrls: string[] = [],
  ) {
    await nextTick()
    if (!container.value || map.value) return

    try {
      const instance = L.map(container.value, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        crs: crsCode === 'EPSG4326' ? L.CRS.EPSG4326 : L.CRS.EPSG3857,
      }).setView(center, zoom)

      if (disposed) {
        instance.remove()
        return
      }

      map.value = instance

      resizeObserver = new ResizeObserver(() => instance.invalidateSize({ animate: false }))
      resizeObserver.observe(container.value)
      window.setTimeout(() => instance.invalidateSize({ animate: false }), 80)

      void loadSuperMapLeaflet(sdkUrl)
        .then((superMapLeaflet) => {
          if (disposed) return
          const baseLayer = superMapLeaflet.supermap!.tiledMapLayer(serviceUrl, {
            transparent: false,
            crossOrigin: true,
          })
          baseLayer.on('tileerror', () => {
            error.value = '二维底图服务响应异常，请检查 iServer 地址、坐标系与跨域配置。'
          })
          baseLayer.addTo(instance)

          overlayServiceUrls.forEach((overlayServiceUrl) => {
            void loadTownshipFeatures(overlayServiceUrl)
              .then((features) => {
                if (disposed) return
                features.forEach((feature) => {
                  L.polygon(feature.rings, TOWNSHIP_STYLE).addTo(instance)
                })
              })
              .catch(() => {
                if (!disposed) error.value = '二维乡镇叠加层加载失败，请检查 iServer 查询接口与跨域配置。'
              })
          })

          const focusServiceUrl = overlayServiceUrls[0]
          if (focusServiceUrl) {
            void loadIServerMapBounds(resolveTownshipMapServiceUrl(focusServiceUrl))
              .then((bounds) => {
                if (disposed) return
                instance.fitBounds(bounds, { animate: false, padding: [20, 20], maxZoom: 11.5 })
              })
              .catch(() => {
                if (!disposed) error.value = '乡镇图层范围读取失败，地图已使用默认中心点与缩放级别。'
              })
          }
        })
        .catch((cause: unknown) => {
          error.value = cause instanceof Error ? cause.message : 'SuperMap iClient Leaflet SDK 加载失败'
        })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '二维地图初始化失败'
    }
  }

  function dispose() {
    disposed = true
    resizeObserver?.disconnect()
    resizeObserver = null
    map.value?.remove()
    map.value = null
  }

  onBeforeUnmount(dispose)
  return { map, error, initialize, dispose }
}
