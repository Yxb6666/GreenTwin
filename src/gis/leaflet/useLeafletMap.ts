import { nextTick, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import L from 'leaflet'
import { enhanceTownshipOverlayPixels } from './enhanceOverlayPixels'
import { loadSuperMapLeaflet } from './loadSdk'

class IServerGeographicOverlay extends L.GridLayer {
  private readonly serviceUrl: string
  private readonly onTileError: () => void

  constructor(serviceUrl: string, onTileError: () => void) {
    super({ tileSize: 256, pane: 'overlayPane' })
    this.serviceUrl = serviceUrl.replace(/\/+$/, '')
    this.onTileError = onTileError
  }

  protected createTile(coords: L.Coords, done: L.DoneCallback) {
    const tileSize = this.getTileSize()
    const northWest = this._map.unproject(L.point(coords.x * tileSize.x, coords.y * tileSize.y), coords.z)
    const southEast = this._map.unproject(
      L.point((coords.x + 1) * tileSize.x, (coords.y + 1) * tileSize.y),
      coords.z,
    )
    const canvas = document.createElement('canvas')
    canvas.width = tileSize.x
    canvas.height = tileSize.y
    canvas.setAttribute('role', 'presentation')
    const image = new Image(tileSize.x, tileSize.y)
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.addEventListener('load', () => {
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        this.onTileError()
        done(new Error('浏览器无法创建乡镇叠加图层画布'), canvas)
        return
      }

      context.drawImage(image, 0, 0, tileSize.x, tileSize.y)
      try {
        const imageData = context.getImageData(0, 0, tileSize.x, tileSize.y)
        enhanceTownshipOverlayPixels(imageData.data)
        context.putImageData(imageData, 0, 0)
      } catch {
        // 跨域策略不允许读取像素时，仍显示 iServer 返回的原始透明图层。
      }
      done(undefined, canvas)
    })
    image.addEventListener('error', () => {
      this.onTileError()
      done(new Error('iServer 乡镇叠加图层加载失败'), canvas)
    })

    const params = new URLSearchParams({
      width: String(tileSize.x),
      height: String(tileSize.y),
      redirect: 'false',
      transparent: 'true',
      cacheEnabled: 'false',
      viewBounds: JSON.stringify({
        left: northWest.lng,
        bottom: southEast.lat,
        right: southEast.lng,
        top: northWest.lat,
      }),
    })
    image.src = `${this.serviceUrl}/image.png?${params.toString()}`
    return canvas
  }
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
            error.value = '二维底图服务响应异常，请检查 iServer 地址、坐标系与跨域配置。'
          })
          baseLayer.addTo(instance)

          overlayServiceUrls.forEach((overlayServiceUrl) => {
            const overlayLayer = new IServerGeographicOverlay(overlayServiceUrl, () => {
              error.value = '二维叠加图层响应异常，请检查 iServer 地址、动态投影与跨域配置。'
            })
            overlayLayer.addTo(instance)
          })
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
