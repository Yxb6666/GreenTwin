import { nextTick, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import L from 'leaflet'
import { loadSuperMapLeaflet } from './loadSdk'

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
