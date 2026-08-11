import { nextTick, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import L from 'leaflet'
import { loadSuperMapLeaflet } from './loadSdk'
import { buildArcGisTileUrl, getBaseMapOption, requiresArcGisAccessToken, type BaseMapMode } from './baseMaps'
import { focusMapOnTownship } from './mapFocus'
import { loadIServerMapBounds, type GeographicBounds } from './serviceBounds'
import { getTownshipLabel, loadTownshipFeatures, resolveTownshipMapServiceUrl } from './townshipFeatures'

const TOWNSHIP_STYLE: L.PathOptions = {
  pane: 'townshipOverlayPane',
  color: '#d6ed9f',
  fillColor: '#146f54',
  fillOpacity: 0.48,
  opacity: 0.95,
  weight: 1.4,
}

const TOWNSHIP_HOVER_STYLE: L.PathOptions = {
  color: '#efffc7',
  opacity: 1,
  weight: 2.1,
}

const TOWNSHIP_SELECTED_STYLE: L.PathOptions = {
  color: '#f7ffdb',
  opacity: 1,
  weight: 3,
}

const TOWNSHIP_NORMAL_BORDER_STYLE: L.PathOptions = {
  color: TOWNSHIP_STYLE.color,
  opacity: TOWNSHIP_STYLE.opacity,
  weight: TOWNSHIP_STYLE.weight,
}

export interface DemRasterOverlay {
  serviceUrl: string
  collectionId: string
  renderingRule: Record<string, unknown>
}

export interface LeafletMapInteractionOptions {
  townshipFocus?: boolean
}

export function useLeafletMap(container: Ref<HTMLElement | null>) {
  const map = shallowRef<L.Map | null>(null)
  const focusBounds = shallowRef<GeographicBounds | null>(null)
  const selectedTownship = ref<string | null>(null)
  const activeBaseMap = ref<BaseMapMode>('natural')
  const arcgisAvailable = ref(false)
  const error = ref('')
  let resizeObserver: ResizeObserver | null = null
  let superMapBaseLayer: L.TileLayer | null = null
  let activeBaseLayer: L.TileLayer | null = null
  let arcgisAccessToken = ''
  const arcgisLayers = new Map<BaseMapMode, L.TileLayer>()
  let selectedTownshipLayer: L.Polygon | null = null
  let disposed = false

  function clearSelectedTownship() {
    selectedTownshipLayer?.setStyle(TOWNSHIP_NORMAL_BORDER_STYLE)
    selectedTownshipLayer = null
    selectedTownship.value = null
  }

  function selectTownship(instance: L.Map, polygon: L.Polygon, name: string) {
    if (!focusMapOnTownship(instance, polygon)) return false

    if (selectedTownshipLayer !== polygon) {
      selectedTownshipLayer?.setStyle(TOWNSHIP_NORMAL_BORDER_STYLE)
      selectedTownshipLayer = polygon
    }
    selectedTownship.value = name
    polygon.setStyle(TOWNSHIP_SELECTED_STYLE)
    polygon.bringToFront()
    return true
  }

  function activateBaseLayer(layer: L.TileLayer, mode: BaseMapMode) {
    if (!map.value) return false
    if (activeBaseLayer && activeBaseLayer !== layer) map.value.removeLayer(activeBaseLayer)
    if (!map.value.hasLayer(layer)) layer.addTo(map.value)
    activeBaseLayer = layer
    activeBaseMap.value = mode
    return true
  }

  function setBaseMap(mode: BaseMapMode) {
    const option = getBaseMapOption(mode)
    if (!option || !map.value) return false

    if (option.source === 'supermap') {
      activeBaseMap.value = mode
      return superMapBaseLayer ? activateBaseLayer(superMapBaseLayer, mode) : true
    }

    if (requiresArcGisAccessToken(option) && !arcgisAccessToken) {
      error.value = 'ArcGIS 底图尚未配置 accessToken，请更新运行时配置后重试。'
      return false
    }

    let layer = arcgisLayers.get(mode)
    if (!layer) {
      const tileUrl =
        option.tileUrl ?? (option.arcgisStyle ? buildArcGisTileUrl(option.arcgisStyle, arcgisAccessToken) : '')
      if (!tileUrl) return false
      layer = L.tileLayer(tileUrl, {
        pane: 'baseMapPane',
        maxZoom: 20,
        crossOrigin: true,
        attribution: '&copy; Esri and data providers',
      })
      layer.on('tileerror', () => {
        if (!disposed) error.value = `${option.name}加载失败，请检查 accessToken、域名限制与网络连接。`
      })
      arcgisLayers.set(mode, layer)
    }
    return activateBaseLayer(layer, mode)
  }

  async function initialize(
    sdkUrl: string,
    serviceUrl: string,
    center: [number, number],
    zoom: number,
    crsCode: 'EPSG4326' | 'EPSG3857',
    overlayServiceUrls: string[] = [],
    arcgisToken = '',
    demOverlay?: DemRasterOverlay,
    interactionOptions: LeafletMapInteractionOptions = {},
  ) {
    await nextTick()
    if (!container.value || map.value) return

    try {
      const instance = L.map(container.value, {
        zoomControl: false,
        attributionControl: true,
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
      arcgisAccessToken = arcgisToken.trim()
      arcgisAvailable.value = Boolean(arcgisAccessToken)

      const baseMapPane = instance.createPane('baseMapPane')
      baseMapPane.style.zIndex = '200'
      baseMapPane.style.pointerEvents = 'none'

      const townshipPane = instance.createPane('townshipOverlayPane')
      townshipPane.style.zIndex = '410'
      townshipPane.style.pointerEvents = interactionOptions.townshipFocus ? 'auto' : 'none'

      const townshipLabelPane = instance.createPane('townshipLabelPane')
      townshipLabelPane.style.zIndex = '430'
      townshipLabelPane.style.pointerEvents = 'none'

      const demOverlayPane = instance.createPane('demOverlayPane')
      demOverlayPane.style.zIndex = '220'
      demOverlayPane.style.pointerEvents = 'none'

      resizeObserver = new ResizeObserver(() => instance.invalidateSize({ animate: false }))
      resizeObserver.observe(container.value)
      window.setTimeout(() => instance.invalidateSize({ animate: false }), 80)

      void loadSuperMapLeaflet(sdkUrl)
        .then((superMapLeaflet) => {
          if (disposed) return
          superMapBaseLayer = superMapLeaflet.supermap!.tiledMapLayer(serviceUrl, {
            transparent: false,
            crossOrigin: true,
            pane: 'baseMapPane',
          })
          superMapBaseLayer.on('tileerror', () => {
            error.value = '二维底图服务响应异常，请检查 iServer 地址、坐标系与跨域配置。'
          })
          if (getBaseMapOption(activeBaseMap.value)?.source === 'supermap') {
            activateBaseLayer(superMapBaseLayer, activeBaseMap.value)
          }

          const addDemLayer = () => {
            if (!demOverlay || disposed) return
            const collectionUrl = `${demOverlay.serviceUrl.replace(/\/+$/, '')}/collections/${encodeURIComponent(demOverlay.collectionId)}`
            const tileQuery = new URLSearchParams({
              transparent: 'true',
              cacheEnabled: 'true',
              renderingRule: JSON.stringify(demOverlay.renderingRule),
            }).toString()
            const imageTileLayer = L.tileLayer(`${collectionUrl}/tile.png?${tileQuery}&z={z}&x={x}&y={y}`, {
              pane: 'demOverlayPane',
              zoomOffset: 1,
              opacity: 0.68,
              crossOrigin: true,
            })
            imageTileLayer.on('tileerror', () => {
              if (!disposed) error.value = 'DEM 栅格瓦片加载失败，请检查影像服务与跨域配置。'
            })
            imageTileLayer.addTo(instance)
          }

          overlayServiceUrls.forEach((overlayServiceUrl) => {
            void loadTownshipFeatures(overlayServiceUrl)
              .then((features) => {
                if (disposed) return
                features.forEach((feature) => {
                  const label = getTownshipLabel(feature)
                  const townshipIsInteractive = Boolean(interactionOptions.townshipFocus && label)
                  const polygon = L.polygon(feature.rings, {
                    ...TOWNSHIP_STYLE,
                    className: townshipIsInteractive ? 'township-map-region' : undefined,
                    interactive: townshipIsInteractive,
                  }).addTo(instance)
                  if (label) {
                    polygon.bindTooltip(label, {
                      permanent: true,
                      direction: 'center',
                      className: 'township-map-label',
                      pane: 'townshipLabelPane',
                      interactive: false,
                      opacity: 1,
                    })
                  }
                  if (townshipIsInteractive && label) {
                    polygon.on('mouseover', () => {
                      if (instance.getContainer().classList.contains('map-is-measuring')) return
                      instance.getContainer().style.cursor = 'pointer'
                      if (selectedTownshipLayer !== polygon) polygon.setStyle(TOWNSHIP_HOVER_STYLE)
                    })
                    polygon.on('mouseout', () => {
                      instance.getContainer().style.cursor = ''
                      if (selectedTownshipLayer !== polygon) polygon.setStyle(TOWNSHIP_NORMAL_BORDER_STYLE)
                    })
                    polygon.on('click', (event) => {
                      if (selectTownship(instance, polygon, label)) L.DomEvent.stopPropagation(event)
                    })
                  }
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
                focusBounds.value = bounds
                instance.fitBounds(bounds, {
                  animate: false,
                  padding: [20, 20],
                  maxZoom: 11.5,
                })
                addDemLayer()
              })
              .catch(() => {
                if (!disposed) {
                  error.value = '乡镇图层范围读取失败，地图已使用默认中心点与缩放级别。'
                  addDemLayer()
                }
              })
          } else {
            addDemLayer()
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
    focusBounds.value = null
    selectedTownship.value = null
    selectedTownshipLayer = null
    superMapBaseLayer = null
    activeBaseLayer = null
    arcgisLayers.clear()
  }

  onBeforeUnmount(dispose)
  return {
    map,
    focusBounds,
    selectedTownship,
    activeBaseMap,
    arcgisAvailable,
    error,
    initialize,
    setBaseMap,
    clearSelectedTownship,
    dispose,
  }
}
