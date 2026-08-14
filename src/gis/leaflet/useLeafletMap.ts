import { nextTick, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import L from 'leaflet'
import { GREENTWIN_MAP_COLORS } from '@/features/master/mapThemeColors'
import { loadSuperMapLeaflet, type LeafletSuperMapNamespace } from './loadSdk'
import { ReprojectedImageTileLayer } from './reprojectedImageTileLayer'
import {
  buildArcGisTileUrl,
  DEFAULT_BASE_MAP_MODE,
  getBaseMapOption,
  requiresArcGisAccessToken,
  type BaseMapMode,
} from './baseMaps'
import { buildCountyBoundaryRings, filterCountyBoundaryArtifacts, getCountyOuterBoundaryRings, mergeTownshipFeatures } from './countyFocusGeometry'
import { focusMapOnTownship, isTownshipInteractionBlocked, TOWNSHIP_FOCUS_START_EVENT } from './mapFocus'
import { loadIServerMapBounds, type GeographicBounds } from './serviceBounds'
import { getTownshipLabelOpacity, getTownshipPathStyle, resolveTownshipVisualState, TOWNSHIP_NORMAL_STYLE, type TownshipVisualState } from './townshipFocusStyle'
import {
  getTownshipLabel,
  loadCountyFeatures,
  loadTownshipFeatures,
  orderTownshipRingParts,
  resolveTownshipMapServiceUrl,
  type TownshipFeature,
} from './townshipFeatures'

interface TownshipLayerEntry {
  name: string
  parts: L.Polygon[]
  labelPart: L.Polygon
  bounds: L.LatLngBounds
  baseStyle: L.PathOptions
  defaultTooltipOptions: L.TooltipOptions
}

const TOWNSHIP_LABEL_STATE_CLASSES = ['township-map-label--normal', 'township-map-label--hover', 'township-map-label--selected', 'township-map-label--dimmed'] as const

const TOWNSHIP_LEGACY_STYLE: L.PathOptions = {
  pane: 'townshipOverlayPane',
  color: '#d6ed9f',
  fillColor: '#146f54',
  fillOpacity: 0.48,
  opacity: 0.95,
  weight: 1.4,
}

export interface DemRasterOverlay {
  serviceUrl: string
  collectionId: string
  renderingRule: Record<string, unknown>
}

export interface LandUseRasterOverlay {
  serviceUrl: string
  collectionId: string
  opacity: number
  renderingRule: Record<string, unknown>
}

export interface TownshipThemePresentation {
  style: L.PathOptions
  tooltip?: string
}

export type TownshipThemeResolver = (
  name: string,
) => TownshipThemePresentation | null

export interface LeafletMapInteractionOptions {
  townshipFocus?: boolean
}

export function useLeafletMap(container: Ref<HTMLElement | null>) {
  const map = shallowRef<L.Map | null>(null)
  const focusBounds = shallowRef<GeographicBounds | null>(null)
  const selectedTownship = ref<string | null>(null)
  const hoveredTownship = ref<string | null>(null)
  const townshipFeatures = shallowRef<TownshipFeature[]>([])
  const activeBaseMap = ref<BaseMapMode>(DEFAULT_BASE_MAP_MODE)
  const arcgisAvailable = ref(false)
  const error = ref('')
  let resizeObserver: ResizeObserver | null = null
  let superMapBaseLayer: L.TileLayer | null = null
  let activeBaseLayer: L.TileLayer | null = null
  let landUseRasterLayer: L.GridLayer | null = null
  let countyOutlineLayer: L.Polyline | null = null
  let superMapNamespace: LeafletSuperMapNamespace | null = null
  let arcgisAccessToken = ''
  const arcgisLayers = new Map<BaseMapMode, L.TileLayer>()
  const townshipLayers: TownshipLayerEntry[] = []
  let townshipThemeResolver: TownshipThemeResolver | null = null
  let countyFocusContextAdded = false
  let countyFocusContextLoading = false
  let rawTownshipFeatures: TownshipFeature[] = []
  let disposed = false

  function getTownshipVisualState(entry: TownshipLayerEntry) {
    return resolveTownshipVisualState(entry.name, selectedTownship.value, hoveredTownship.value)
  }

  function refreshTownshipLabel(entry: TownshipLayerEntry, state: TownshipVisualState) {
    const tooltip = entry.labelPart.getTooltip()
    tooltip?.setOpacity(getTownshipLabelOpacity(state))
    const element = tooltip?.getElement()
    if (!element) return
    element.classList.remove(...TOWNSHIP_LABEL_STATE_CLASSES)
    element.classList.add(`township-map-label--${state}`)
  }

  function refreshTownshipStyles() {
    townshipLayers.forEach((entry) => {
      const state = getTownshipVisualState(entry)
      const presentation = townshipThemeResolver?.(entry.name)
      const baseStyle = presentation?.style ?? entry.baseStyle
      const pathStyle = getTownshipPathStyle(state, baseStyle)
      if (presentation && state === 'dimmed') {
        Object.assign(pathStyle, {
          fillColor: baseStyle.fillColor,
          fillOpacity: 0.38,
        })
      }
      entry.parts.forEach((part) => part.setStyle(pathStyle))
      refreshTownshipLabel(entry, state)
    })

    const foregroundName = selectedTownship.value ?? hoveredTownship.value
    townshipLayers
      .find((entry) => entry.name === foregroundName)
      ?.parts.forEach((part) => part.bringToFront())
  }

  function refreshTownshipTheme() {
    townshipLayers.forEach((entry) => {
      entry.labelPart.setTooltipContent(entry.name)
    })
    refreshTownshipStyles()
  }

  function setTownshipTheme(resolver: TownshipThemeResolver | null) {
    townshipThemeResolver = resolver
    refreshTownshipTheme()
  }

  function clearSelectedTownship() {
    selectedTownship.value = null
    hoveredTownship.value = null
    if (map.value) map.value.getContainer().style.cursor = ''
    refreshTownshipStyles()
  }

  function selectTownship(instance: L.Map, name: string) {
    const entry = townshipLayers.find((item) => item.name === name)
    if (!entry) return false
    return focusMapOnTownship(instance, { getBounds: () => entry.bounds }, () => {
      selectedTownship.value = name
      hoveredTownship.value = null
      refreshTownshipStyles()
      instance.fire(TOWNSHIP_FOCUS_START_EVENT)
    })
  }

  function focusTownshipByName(name: string) {
    const instance = map.value
    return instance ? selectTownship(instance, name) : false
  }

  function addCountyFocusContext(instance: L.Map, features: Awaited<ReturnType<typeof loadTownshipFeatures>>) {
    const boundaryRings = filterCountyBoundaryArtifacts(buildCountyBoundaryRings(features))
    const outlineRings = getCountyOuterBoundaryRings(boundaryRings)
    if (outlineRings.length === 0) return false

    countyOutlineLayer = L.polyline(outlineRings, {
      pane: 'countyOutlinePane',
      interactive: false,
      color: GREENTWIN_MAP_COLORS.admin.countyStroke,
      weight: 2.05,
      opacity: 0.92,
      lineCap: 'round',
      lineJoin: 'round',
      className: 'county-map-outline',
    }).addTo(instance)

    return true
  }

  function setCountyOutlineStyle(style: Pick<L.PathOptions, 'color' | 'weight' | 'opacity'>) {
    countyOutlineLayer?.setStyle(style)
  }

  function setTownshipLabelPlacement(name: string, options: Pick<L.TooltipOptions, 'direction' | 'offset' | 'className'>, position?: L.LatLngExpression) {
    const entry = townshipLayers.find((item) => item.name === name)
    const content = entry?.labelPart.getTooltip()?.getContent()
    if (!entry || content == null) return false
    entry.labelPart.unbindTooltip().bindTooltip(content, {
      ...entry.defaultTooltipOptions,
      ...options,
    })
    entry.labelPart.openTooltip(position)
    refreshTownshipLabel(entry, getTownshipVisualState(entry))
    return true
  }

  function resetTownshipLabelPlacements() {
    townshipLayers.forEach((entry) => {
      const content = entry.labelPart.getTooltip()?.getContent()
      if (content == null) return
      entry.labelPart.unbindTooltip().bindTooltip(content, entry.defaultTooltipOptions)
      entry.labelPart.openTooltip()
      refreshTownshipLabel(entry, getTownshipVisualState(entry))
    })
  }

  function renderTownshipFeatures(instance: L.Map, features: TownshipFeature[], interactionOptions: LeafletMapInteractionOptions) {
    townshipLayers.splice(0).forEach((entry) => entry.parts.forEach((part) => part.remove()))
    const displayFeatures = interactionOptions.townshipFocus ? features.filter((feature) => getTownshipLabel(feature)) : features
    const defaultTooltipOptions: L.TooltipOptions = {
      permanent: true,
      direction: 'center',
      className: 'township-map-label',
      pane: 'townshipLabelPane',
      interactive: false,
      opacity: 1,
    }
    const entriesByName = new Map<string, TownshipLayerEntry>()
    const labelCandidates = new Map<string, { polygon: L.Polygon; area: number }>()

    orderTownshipRingParts(displayFeatures).forEach(({ feature, ring, area }) => {
      const label = getTownshipLabel(feature)
      const townshipIsInteractive = Boolean(interactionOptions.townshipFocus && label)
      const townshipBaseStyle = townshipIsInteractive ? TOWNSHIP_NORMAL_STYLE : TOWNSHIP_LEGACY_STYLE
      const townshipTheme = label ? townshipThemeResolver?.(label) : null
      const polygon = L.polygon([ring], {
        ...townshipBaseStyle,
        ...townshipTheme?.style,
        className: townshipIsInteractive ? 'township-map-region' : undefined,
        interactive: townshipIsInteractive,
      })

      if (townshipIsInteractive && label) {
        let entry = entriesByName.get(label)
        if (!entry) {
          entry = {
            name: label,
            parts: [],
            labelPart: polygon,
            bounds: L.latLngBounds(feature.rings.flat()),
            baseStyle: { ...townshipBaseStyle },
            defaultTooltipOptions,
          }
          entriesByName.set(label, entry)
          townshipLayers.push(entry)
        }
        entry.parts.push(polygon)
        const previousCandidate = labelCandidates.get(label)
        if (!previousCandidate || area > previousCandidate.area) {
          labelCandidates.set(label, { polygon, area })
        }
        polygon.on('tooltipopen', () => refreshTownshipLabel(entry, getTownshipVisualState(entry)))
        polygon.on('mouseover', () => {
          if (isTownshipInteractionBlocked(instance)) return
          hoveredTownship.value = label
          const themeTooltip = townshipThemeResolver?.(label)?.tooltip
          if (themeTooltip) entry.labelPart.setTooltipContent(themeTooltip)
          instance.getContainer().style.cursor = 'pointer'
          refreshTownshipStyles()
        })
        polygon.on('mouseout', () => {
          if (hoveredTownship.value === label) hoveredTownship.value = null
          entry.labelPart.setTooltipContent(entry.name)
          instance.getContainer().style.cursor = ''
          refreshTownshipStyles()
        })
        polygon.on('click', (event) => {
          if (selectTownship(instance, label)) L.DomEvent.stopPropagation(event)
        })
      }
      polygon.addTo(instance)
    })

    townshipLayers.forEach((entry) => {
      const candidate = labelCandidates.get(entry.name)
      if (!candidate) return
      entry.labelPart = candidate.polygon
      candidate.polygon.bindTooltip(entry.name, entry.defaultTooltipOptions)
    })
    refreshTownshipStyles()
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
      const tileUrl = option.tileUrl ?? (option.arcgisStyle ? buildArcGisTileUrl(option.arcgisStyle, arcgisAccessToken) : '')
      if (!tileUrl) return false
      layer = L.tileLayer(tileUrl, {
        pane: 'baseMapPane',
        maxZoom: 20,
        crossOrigin: true,
      })
      layer.on('tileerror', () => {
        if (!disposed) error.value = `${option.name}加载失败，请检查 accessToken、域名限制与网络连接。`
      })
      arcgisLayers.set(mode, layer)
    }
    return activateBaseLayer(layer, mode)
  }

  function setLandUseRaster(active: boolean, overlay: LandUseRasterOverlay) {
    const instance = map.value
    if (!instance) return false
    if (!active) {
      landUseRasterLayer?.remove()
      landUseRasterLayer = null
      return true
    }
    if (landUseRasterLayer) return true

    landUseRasterLayer = new ReprojectedImageTileLayer({
      serviceUrl: overlay.serviceUrl,
      collectionId: overlay.collectionId,
      renderingRule: overlay.renderingRule,
      pane: 'landUseRasterPane',
      opacity: overlay.opacity,
      maxZoom: 20,
      className: 'landuse-raster-tile',
    })
    landUseRasterLayer.on('tileerror', () => {
      if (!disposed) error.value = '土地利用栅格加载失败，请检查 LankaoLand 影像服务与跨域配置。'
    })
    landUseRasterLayer.addTo(instance)
    return true
  }

  async function initialize(sdkUrl: string, serviceUrl: string, center: [number, number], zoom: number, crsCode: 'EPSG4326' | 'EPSG3857', overlayServiceUrls: string[] = [], arcgisToken = '', demOverlay?: DemRasterOverlay, interactionOptions: LeafletMapInteractionOptions = {}) {
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

      if (interactionOptions.townshipFocus) instance.getContainer().classList.add('map--township-focus')

      const landUseRasterPane = instance.createPane('landUseRasterPane')
      landUseRasterPane.style.zIndex = '280'
      landUseRasterPane.style.pointerEvents = 'none'

      const townshipPane = instance.createPane('townshipOverlayPane')
      townshipPane.style.zIndex = '410'
      townshipPane.style.pointerEvents = interactionOptions.townshipFocus ? 'auto' : 'none'

      const countyOutlinePane = instance.createPane('countyOutlinePane')
      countyOutlinePane.style.zIndex = '425'
      countyOutlinePane.style.pointerEvents = 'none'

      const townshipLabelPane = instance.createPane('townshipLabelPane')
      townshipLabelPane.style.zIndex = '430'
      townshipLabelPane.style.pointerEvents = 'none'

      const demOverlayPane = instance.createPane('demOverlayPane')
      demOverlayPane.style.zIndex = '220'
      demOverlayPane.style.pointerEvents = 'none'

      setBaseMap(DEFAULT_BASE_MAP_MODE)

      resizeObserver = new ResizeObserver(() => instance.invalidateSize({ animate: false }))
      resizeObserver.observe(container.value)
      window.setTimeout(() => instance.invalidateSize({ animate: false }), 80)

      void loadSuperMapLeaflet(sdkUrl)
        .then((superMapLeaflet) => {
          if (disposed) return
          superMapNamespace = superMapLeaflet.supermap!
          superMapBaseLayer = superMapNamespace.tiledMapLayer(serviceUrl, {
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
                rawTownshipFeatures = [...rawTownshipFeatures, ...features]
                const mergedFeatures = interactionOptions.townshipFocus ? mergeTownshipFeatures(rawTownshipFeatures) : rawTownshipFeatures
                townshipFeatures.value = mergedFeatures
                if (interactionOptions.townshipFocus && !countyFocusContextAdded && !countyFocusContextLoading) {
                  countyFocusContextLoading = true
                  void loadCountyFeatures(overlayServiceUrl)
                    .then((countyFeatures) => {
                      if (!disposed && !countyFocusContextAdded) {
                        countyFocusContextAdded = addCountyFocusContext(instance, countyFeatures)
                      }
                    })
                    .catch(() => {
                      if (!disposed && !countyFocusContextAdded) {
                        countyFocusContextAdded = addCountyFocusContext(instance, mergedFeatures)
                      }
                    })
                    .finally(() => {
                      countyFocusContextLoading = false
                    })
                }
                renderTownshipFeatures(instance, mergedFeatures, interactionOptions)
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
    hoveredTownship.value = null
    townshipLayers.length = 0
    rawTownshipFeatures = []
    countyFocusContextAdded = false
    countyFocusContextLoading = false
    townshipFeatures.value = []
    landUseRasterLayer = null
    superMapNamespace = null
    superMapBaseLayer = null
    activeBaseLayer = null
    arcgisLayers.clear()
  }

  onBeforeUnmount(dispose)
  return {
    map,
    focusBounds,
    selectedTownship,
    hoveredTownship,
    townshipFeatures,
    activeBaseMap,
    arcgisAvailable,
    error,
    initialize,
    setBaseMap,
    setLandUseRaster,
    setCountyOutlineStyle,
    clearSelectedTownship,
    focusTownshipByName,
    setTownshipLabelPlacement,
    resetTownshipLabelPlacements,
    setTownshipTheme,
    dispose,
  }
}
