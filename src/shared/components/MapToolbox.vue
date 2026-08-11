<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import { BASE_MAP_OPTIONS, requiresArcGisAccessToken, type BaseMapMode } from '@/gis/leaflet/baseMaps'
import { focusMapOnLayer } from '@/gis/leaflet/mapFocus'
import { calculateGeodesicArea, formatArea, formatDistance } from '@/gis/leaflet/measurement'
import type { GeographicBounds } from '@/gis/leaflet/serviceBounds'

type MeasurementType = 'distance' | 'area'

const props = defineProps<{
  map: L.Map | null
  focusBounds: GeographicBounds | null
  initialCenter: [number, number]
  initialZoom: number
  activeBaseMap: BaseMapMode
  arcgisAvailable: boolean
  changeBaseMap: (mode: BaseMapMode) => boolean
  exportName?: string
}>()

const activeMeasurement = ref<MeasurementType | null>(null)
const measurementMenuOpen = ref(false)
const baseMapMenuOpen = ref(false)
const feedback = ref('')
let feedbackTimer: number | undefined
let drawingLayer: L.FeatureGroup | null = null
let currentPath: L.Polyline | L.Polygon | null = null
let previewPath: L.Polyline | L.Polygon | null = null
let points: L.LatLng[] = []

const baseMapOptions = BASE_MAP_OPTIONS

const measurementLabel = computed(() => (activeMeasurement.value === 'distance' ? '距离测量中' : activeMeasurement.value === 'area' ? '面积测量中' : '测量工具'))

function notify(message: string) {
  feedback.value = message
  window.clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => (feedback.value = ''), 2400)
}

function getDrawingLayer() {
  if (!props.map) return null
  if (!drawingLayer) drawingLayer = L.featureGroup().addTo(props.map)
  return drawingLayer
}

function addResultLabel(position: L.LatLng, value: string) {
  const layer = getDrawingLayer()
  if (!layer) return
  L.marker(position, {
    interactive: false,
    icon: L.divIcon({
      className: 'map-measure-label',
      html: `<span>${value}</span>`,
      iconAnchor: [0, 14],
    }),
  }).addTo(layer)
}

function removePreview() {
  if (previewPath && drawingLayer) drawingLayer.removeLayer(previewPath)
  previewPath = null
}

function redrawCurrentPath(cursor?: L.LatLng) {
  const layer = getDrawingLayer()
  if (!layer || !activeMeasurement.value) return
  removePreview()
  if (currentPath) layer.removeLayer(currentPath)

  const pathOptions: L.PathOptions = {
    color: '#54e1ce',
    weight: 2,
    opacity: 0.95,
    fillColor: '#3dd6c4',
    fillOpacity: 0.15,
    dashArray: activeMeasurement.value === 'distance' ? '7 6' : undefined,
  }
  currentPath = activeMeasurement.value === 'distance' ? L.polyline(points, pathOptions).addTo(layer) : L.polygon(points, pathOptions).addTo(layer)

  if (!cursor || points.length === 0) return
  const previewPoints = [...points, cursor]
  previewPath = activeMeasurement.value === 'distance' ? L.polyline(previewPoints, { ...pathOptions, opacity: 0.55 }).addTo(layer) : L.polygon(previewPoints, { ...pathOptions, opacity: 0.55 }).addTo(layer)
}

function onMapClick(event: L.LeafletMouseEvent) {
  if (!activeMeasurement.value) return
  points.push(event.latlng)
  L.circleMarker(event.latlng, {
    radius: 3.5,
    color: '#eafffb',
    weight: 1.5,
    fillColor: '#0c8177',
    fillOpacity: 1,
  }).addTo(getDrawingLayer()!)
  redrawCurrentPath()
}

function onMapMouseMove(event: L.LeafletMouseEvent) {
  if (points.length > 0) redrawCurrentPath(event.latlng)
}

function finishMeasurement(event?: L.LeafletMouseEvent) {
  event?.originalEvent.preventDefault()
  event?.originalEvent.stopPropagation()
  if (!activeMeasurement.value || !props.map) return

  if (event?.type === 'dblclick' && points.length > 1) points.pop()
  const type = activeMeasurement.value
  removePreview()
  redrawCurrentPath()

  if (type === 'distance' && points.length >= 2) {
    const meters = points.slice(1).reduce((total, point, index) => total + props.map!.distance(points[index]!, point), 0)
    const result = formatDistance(meters)
    addResultLabel(points.at(-1)!, result)
    notify(`测量完成：${result}`)
  } else if (type === 'area' && points.length >= 3) {
    const result = formatArea(calculateGeodesicArea(points))
    addResultLabel(currentPath!.getBounds().getCenter(), result)
    notify(`测量完成：${result}`)
  } else {
    notify(type === 'distance' ? '距离测量至少需要两个点' : '面积测量至少需要三个点')
    if (currentPath && drawingLayer) drawingLayer.removeLayer(currentPath)
  }

  currentPath = null
  points = []
}

function stopMeasurement() {
  if (!props.map) return
  props.map.off('click', onMapClick)
  props.map.off('mousemove', onMapMouseMove)
  props.map.off('dblclick', finishMeasurement)
  props.map.off('contextmenu', finishMeasurement)
  props.map.doubleClickZoom.enable()
  props.map.getContainer().classList.remove('map-is-measuring')
  removePreview()
  currentPath = null
  points = []
  activeMeasurement.value = null
}

function startMeasurement(type: MeasurementType) {
  if (!props.map) return notify('地图仍在初始化，请稍后再试')
  stopMeasurement()
  activeMeasurement.value = type
  measurementMenuOpen.value = false
  props.map.doubleClickZoom.disable()
  props.map.getContainer().classList.add('map-is-measuring')
  props.map.on('click', onMapClick)
  props.map.on('mousemove', onMapMouseMove)
  props.map.on('dblclick', finishMeasurement)
  props.map.on('contextmenu', finishMeasurement)
  notify(type === 'distance' ? '单击依次取点，双击或右键完成距离测量' : '单击绘制范围，双击或右键完成面积测量')
}

function clearDrawings() {
  stopMeasurement()
  drawingLayer?.clearLayers()
  notify('临时标绘与测量结果已清除')
}

function toggleMeasurementMenu() {
  measurementMenuOpen.value = !measurementMenuOpen.value
  baseMapMenuOpen.value = false
}

function toggleBaseMapMenu() {
  baseMapMenuOpen.value = !baseMapMenuOpen.value
  measurementMenuOpen.value = false
}

function refreshMap() {
  if (!props.map) return notify('地图仍在初始化，请稍后再试')
  props.map.invalidateSize({ animate: false })
  props.map.eachLayer((layer) => {
    if (layer instanceof L.GridLayer) layer.redraw()
  })
  notify('地图图层已刷新')
}

function applyBaseMapFilter(mode: BaseMapMode) {
  if (!props.map) return
  const pane = props.map.getPane('baseMapPane')
  pane?.classList.remove('map-base--natural', 'map-base--ecology', 'map-base--planning', 'map-base--night')
  if (['natural', 'ecology', 'planning', 'night'].includes(mode)) {
    pane?.classList.add(`map-base--${mode}`)
  }
}

function setBaseMap(mode: BaseMapMode) {
  const option = baseMapOptions.find((item) => item.key === mode)
  if (!props.map || !option) return
  if (requiresArcGisAccessToken(option) && !props.arcgisAvailable) {
    notify('请先在 runtime-config.json 中配置 ArcGIS accessToken')
    return
  }
  if (!props.changeBaseMap(mode)) {
    notify(`${option.name}切换失败，请检查底图配置`)
    return
  }
  applyBaseMapFilter(mode)
  baseMapMenuOpen.value = false
  notify(`已切换为${option.name}`)
}

function resetView() {
  if (!props.map) return
  focusMapOnLayer(props.map, props.focusBounds, props.initialCenter, props.initialZoom)
  notify(props.focusBounds ? '已居中显示行政区划图层' : '图层范围不可用，已回到默认视图')
}

async function drawDomImage(context: CanvasRenderingContext2D, element: HTMLImageElement | HTMLCanvasElement, container: HTMLElement, root: DOMRect) {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0 || rect.right <= root.left || rect.bottom <= root.top || rect.left >= root.right || rect.top >= root.bottom) return

  let opacity = 1
  let current: HTMLElement | null = element
  while (current && current !== container) {
    const style = getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden') return
    opacity *= Number(style.opacity || 1)
    current = current.parentElement
  }
  if (opacity <= 0.01) return

  if (element instanceof HTMLImageElement && !element.complete) {
    await element.decode().catch(() => undefined)
  }
  context.globalAlpha = opacity
  context.drawImage(element, rect.left - root.left, rect.top - root.top, rect.width, rect.height)
  context.globalAlpha = 1
}

async function drawSvgOverlays(context: CanvasRenderingContext2D, container: HTMLElement, root: DOMRect) {
  const svgs = [...container.querySelectorAll<SVGSVGElement>('.leaflet-overlay-pane svg')]
  for (const svg of svgs) {
    const rect = svg.getBoundingClientRect()
    const data = new XMLSerializer().serializeToString(svg)
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' }))
    const image = new Image()
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('标绘图层转换失败'))
        image.src = url
      })
      context.drawImage(image, rect.left - root.left, rect.top - root.top, rect.width, rect.height)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function exportMap() {
  if (!props.map) return notify('地图仍在初始化，请稍后再试')
  const container = props.map.getContainer()
  const root = container.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(root.width * ratio)
  canvas.height = Math.round(root.height * ratio)
  const context = canvas.getContext('2d')
  if (!context) return notify('当前浏览器无法创建导出画布')

  context.scale(ratio, ratio)
  context.fillStyle = '#071313'
  context.fillRect(0, 0, root.width, root.height)

  try {
    const tiles = [...container.querySelectorAll<HTMLImageElement | HTMLCanvasElement>('.leaflet-map-pane .leaflet-tile, .leaflet-overlay-pane canvas')]
    for (const tile of tiles) await drawDomImage(context, tile, container, root)
    await drawSvgOverlays(context, container, root)

    const gradient = context.createLinearGradient(0, root.height - 62, 0, root.height)
    gradient.addColorStop(0, 'rgba(4, 14, 15, 0)')
    gradient.addColorStop(1, 'rgba(4, 14, 15, 0.88)')
    context.fillStyle = gradient
    context.fillRect(0, root.height - 62, root.width, 62)
    context.fillStyle = '#eafffb'
    context.font = '600 14px "Microsoft YaHei", sans-serif'
    context.fillText(props.exportName ?? 'GreenTwin 地图视图', 16, root.height - 20)
    context.fillStyle = '#9ab7b0'
    context.font = '10px "Segoe UI", sans-serif'
    context.textAlign = 'right'
    context.fillText(new Date().toLocaleString('zh-CN', { hour12: false }), root.width - 16, root.height - 20)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('地图画布生成失败')
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${props.exportName ?? 'GreenTwin地图'}-${new Date().toISOString().slice(0, 10)}.png`
    anchor.click()
    URL.revokeObjectURL(url)
    notify('当前地图已导出为 PNG')
  } catch {
    notify('底图服务未允许跨域导出，请检查 iServer CORS 配置')
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  stopMeasurement()
  measurementMenuOpen.value = false
  baseMapMenuOpen.value = false
}

watch(
  () => props.map,
  (map, previousMap) => {
    if (previousMap && previousMap !== map) stopMeasurement()
    if (map) applyBaseMapFilter(props.activeBaseMap)
  },
  { immediate: true },
)

watch(
  () => props.activeBaseMap,
  (mode) => applyBaseMapFilter(mode),
)

window.addEventListener('keydown', onKeyDown)

onBeforeUnmount(() => {
  window.clearTimeout(feedbackTimer)
  window.removeEventListener('keydown', onKeyDown)
  stopMeasurement()
})
</script>

<template>
  <div class="map-toolbox" aria-label="地图常用工具">
    <div class="map-toolbox__rail" role="toolbar" aria-label="地图操作">
      <button type="button" aria-label="清除临时图层" title="清除临时图层" @click="clearDrawings">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
        </svg>
        <span>清除图层</span>
      </button>
      <button type="button" :class="{ active: measurementMenuOpen || activeMeasurement }" :aria-expanded="measurementMenuOpen" aria-controls="measurement-menu" :aria-label="measurementLabel" title="测量工具" @click="toggleMeasurementMenu">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4 18 9-14 7 5-9 13H4v-4Zm9-14 2 6m-8 5 3 2m0-7 3 2" />
        </svg>
        <span>{{ activeMeasurement ? '结束测量' : '测量工具' }}</span>
      </button>
      <button type="button" aria-label="刷新地图" title="刷新地图" @click="refreshMap">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 7v5h-5M4 17v-5h5m9.2-3A7 7 0 0 0 6.6 7L4 12m16 0-2.6 5a7 7 0 0 1-11.6-1" />
        </svg>
        <span>刷新地图</span>
      </button>
      <button type="button" aria-label="导出地图" title="导出地图" @click="exportMap">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 16v4h14v-4" />
        </svg>
        <span>导出地图</span>
      </button>
      <button type="button" :class="{ active: baseMapMenuOpen }" :aria-expanded="baseMapMenuOpen" aria-controls="basemap-menu" aria-label="切换底图" title="切换底图" @click="toggleBaseMapMenu">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 9 5-9 5-9-5 9-5Zm-7 9 7 4 7-4M5 16l7 4 7-4" />
        </svg>
        <span>切换底图</span>
      </button>
    </div>

    <Transition name="tool-panel">
      <div v-if="measurementMenuOpen" id="measurement-menu" class="map-toolbox__panel measure-panel">
        <header><span>MEASURE</span><strong>选择测量方式</strong></header>
        <button type="button" @click="startMeasurement('distance')">
          <i>↗</i><span><strong>空间距离</strong><small>沿路径累计长度</small></span>
        </button>
        <button type="button" @click="startMeasurement('area')">
          <i>⌑</i><span><strong>地表面积</strong><small>闭合范围估算</small></span>
        </button>
      </div>
    </Transition>

    <Transition name="tool-panel">
      <div v-if="baseMapMenuOpen" id="basemap-menu" class="map-toolbox__panel basemap-panel">
        <header><span>BASE MAP</span><strong>底图研判风格</strong></header>
        <div class="basemap-grid">
          <button
            v-for="option in baseMapOptions"
            :key="option.key"
            type="button"
            :class="[
              `preview--${option.key}`,
              {
                active: activeBaseMap === option.key,
                unavailable: requiresArcGisAccessToken(option) && !arcgisAvailable,
              },
            ]"
            :aria-disabled="requiresArcGisAccessToken(option) && !arcgisAvailable"
            @click="setBaseMap(option.key)"
          >
            <i aria-hidden="true" :style="option.previewUrl ? { backgroundImage: `url(${option.previewUrl})` } : undefined"
              ><template v-if="!option.previewUrl"><b /><b /><b /></template
            ></i>
            <strong>{{ option.name }}</strong>
            <small>{{ requiresArcGisAccessToken(option) && !arcgisAvailable ? '需配置 ArcGIS Key' : option.meta }}</small>
          </button>
        </div>
      </div>
    </Transition>

    <div class="map-toolbox__zoom" role="group" aria-label="地图缩放">
      <button type="button" aria-label="放大地图" title="放大" @click="map?.zoomIn()">＋</button>
      <button type="button" aria-label="缩小地图" title="缩小" @click="map?.zoomOut()">−</button>
      <button type="button" aria-label="以行政区划图层为中心" title="居中显示行政区划图层" @click="resetView">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6" />
        </svg>
      </button>
    </div>

    <Transition name="tool-feedback">
      <div v-if="feedback" class="map-toolbox__feedback" role="status">
        {{ feedback }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.map-toolbox {
  position: absolute;
  z-index: 650;
  inset: 0;
  pointer-events: none;
}
.map-toolbox button {
  color: inherit;
  font: inherit;
}

.map-toolbox__rail {
  position: absolute;
  top: 12px;
  left: 12px;
  display: grid;
  gap: 6px;
  pointer-events: auto;
}

.map-toolbox__rail button {
  position: relative;
  display: grid;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid rgba(122, 203, 190, 0.25);
  border-radius: 7px;
  place-items: center;
  color: #b8d2cc;
  background: rgba(5, 20, 21, 0.9);
  box-shadow: 0 7px 20px rgba(0, 0, 0, 0.24);
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: 150ms ease;
}

.map-toolbox__rail button:hover,
.map-toolbox__rail button:focus-visible,
.map-toolbox__rail button.active {
  color: #eafffb;
  border-color: rgba(61, 214, 196, 0.7);
  background: rgba(17, 82, 76, 0.92);
  transform: translateX(2px);
}

.map-toolbox__rail svg,
.map-toolbox__zoom svg {
  width: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.map-toolbox__rail button > span {
  position: absolute;
  left: 45px;
  min-width: max-content;
  padding: 7px 9px;
  border: 1px solid rgba(122, 203, 190, 0.2);
  border-radius: 5px;
  color: #eafffb;
  background: rgba(5, 18, 19, 0.94);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  font-size: 10px;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-4px);
  transition: 140ms ease;
}

.map-toolbox__rail button:hover > span,
.map-toolbox__rail button:focus-visible > span {
  opacity: 1;
  transform: translateX(0);
}

.map-toolbox__panel {
  position: absolute;
  top: 54px;
  left: 60px;
  width: 232px;
  padding: 10px;
  border: 1px solid rgba(122, 203, 190, 0.24);
  border-radius: 9px;
  pointer-events: auto;
  background: linear-gradient(145deg, rgba(8, 28, 28, 0.96), rgba(5, 17, 18, 0.94));
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(14px);
}

.map-toolbox__panel header {
  display: grid;
  gap: 2px;
  padding: 2px 2px 9px;
  border-bottom: 1px solid rgba(122, 203, 190, 0.12);
}
.map-toolbox__panel header span {
  color: rgba(61, 214, 196, 0.72);
  font: 8px var(--font-data);
  letter-spacing: 0.18em;
}
.map-toolbox__panel header strong {
  font-size: 12px;
}

.measure-panel {
  top: 54px;
}
.measure-panel > button {
  display: flex;
  width: 100%;
  margin-top: 7px;
  padding: 8px;
  gap: 9px;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-soft);
  text-align: left;
  background: rgba(255, 255, 255, 0.025);
  cursor: pointer;
}
.measure-panel > button:hover {
  border-color: rgba(61, 214, 196, 0.35);
  background: rgba(61, 214, 196, 0.09);
}
.measure-panel i {
  display: grid;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(61, 214, 196, 0.3);
  border-radius: 5px;
  place-items: center;
  color: var(--cyan);
  font: normal 15px var(--font-data);
}
.measure-panel button span {
  display: grid;
  gap: 2px;
}
.measure-panel strong {
  color: var(--text);
  font-size: 10px;
}
.measure-panel small {
  font-size: 8px;
}

.basemap-panel {
  top: 188px;
  width: 284px;
  max-height: calc(100% - 210px);
  overflow-y: auto;
}
.basemap-grid {
  display: grid;
  gap: 8px;
  margin-top: 9px;
  grid-template-columns: repeat(2, 1fr);
}
.basemap-grid button {
  display: grid;
  padding: 5px;
  overflow: hidden;
  border: 1px solid rgba(122, 203, 190, 0.16);
  border-radius: 6px;
  color: var(--text-soft);
  text-align: left;
  background: rgba(255, 255, 255, 0.025);
  cursor: pointer;
}
.basemap-grid button:hover,
.basemap-grid button.active {
  border-color: rgba(61, 214, 196, 0.7);
  box-shadow: inset 0 0 0 1px rgba(61, 214, 196, 0.15);
}
.basemap-grid button.unavailable {
  opacity: 0.58;
}
.basemap-grid button > i {
  position: relative;
  height: 56px;
  margin-bottom: 6px;
  overflow: hidden;
  border-radius: 4px;
  background-color: #748b73;
  background-image: linear-gradient(25deg, transparent 45%, rgba(209, 229, 166, 0.8) 46% 54%, transparent 55%), linear-gradient(118deg, transparent 52%, rgba(100, 165, 183, 0.82) 53% 61%, transparent 62%), radial-gradient(circle at 28% 38%, #9fba75 0 14%, transparent 15%);
}
.basemap-grid button > i b {
  position: absolute;
  width: 3px;
  height: 130%;
  background: rgba(233, 223, 175, 0.72);
  transform: rotate(52deg);
}
.basemap-grid button > i b:nth-child(1) {
  left: 24%;
  top: -15%;
}
.basemap-grid button > i b:nth-child(2) {
  left: 62%;
  top: -10%;
  transform: rotate(-27deg);
}
.basemap-grid button > i b:nth-child(3) {
  left: 78%;
  top: -20%;
  transform: rotate(73deg);
}
.basemap-grid strong {
  padding: 0 2px;
  color: var(--text);
  font-size: 9px;
}
.basemap-grid small {
  padding: 2px;
  font-size: 7px;
}
.preview--ecology > i {
  filter: saturate(1.65) hue-rotate(8deg) contrast(1.05);
}
.preview--planning > i {
  filter: grayscale(0.9) brightness(1.18) contrast(0.72);
}
.preview--night > i {
  filter: grayscale(0.8) invert(0.82) hue-rotate(145deg) brightness(0.42) contrast(1.7);
}
.preview--light-gray > i,
.preview--dark-gray > i,
.preview--outdoor > i,
.preview--standard > i {
  background-position: center;
  background-size: cover;
}

.map-toolbox__zoom {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: grid;
  overflow: hidden;
  border: 1px solid rgba(122, 203, 190, 0.25);
  border-radius: 7px;
  pointer-events: auto;
  background: rgba(5, 20, 21, 0.9);
  box-shadow: 0 7px 20px rgba(0, 0, 0, 0.24);
}
.map-toolbox__zoom button {
  display: grid;
  width: 32px;
  height: 30px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid rgba(122, 203, 190, 0.13);
  place-items: center;
  color: #b8d2cc;
  background: transparent;
  cursor: pointer;
}
.map-toolbox__zoom button:last-child {
  border-bottom: 0;
}
.map-toolbox__zoom button:hover {
  color: #eafffb;
  background: rgba(61, 214, 196, 0.13);
}

.map-toolbox__feedback {
  position: absolute;
  bottom: 12px;
  left: 54px;
  max-width: 360px;
  padding: 7px 10px;
  border: 1px solid rgba(61, 214, 196, 0.34);
  border-radius: 5px;
  pointer-events: none;
  color: #dffcf6;
  background: rgba(5, 20, 21, 0.9);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.25);
  font-size: 9px;
  backdrop-filter: blur(8px);
}

.tool-panel-enter-active,
.tool-panel-leave-active,
.tool-feedback-enter-active,
.tool-feedback-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}
.tool-panel-enter-from,
.tool-panel-leave-to {
  opacity: 0;
  transform: translateX(-5px);
}
.tool-feedback-enter-from,
.tool-feedback-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

:global(.map-is-measuring) {
  cursor: crosshair !important;
}
:global(.map-is-measuring *) {
  cursor: crosshair !important;
}
:global(.leaflet-baseMap-pane) {
  transition: filter 240ms ease;
}
:global(.map-base--natural) {
  filter: none;
}
:global(.map-base--ecology) {
  filter: saturate(1.58) hue-rotate(7deg) contrast(1.08);
}
:global(.map-base--planning) {
  filter: grayscale(0.92) brightness(1.16) contrast(0.72);
}
:global(.map-base--night) {
  filter: grayscale(0.78) invert(0.82) hue-rotate(145deg) brightness(0.38) contrast(1.75);
}
:global(.map-measure-label) {
  width: auto !important;
  height: auto !important;
  border: 0 !important;
  background: transparent !important;
}
:global(.map-measure-label span) {
  display: block;
  min-width: max-content;
  padding: 5px 7px;
  border: 1px solid rgba(61, 214, 196, 0.6);
  border-radius: 4px;
  color: #eafffb;
  background: rgba(5, 26, 25, 0.92);
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.25);
  font: 10px var(--font-data);
  transform: translate(7px, -50%);
}

@media (prefers-reduced-motion: reduce) {
  .map-toolbox__rail button:hover,
  .map-toolbox__rail button:focus-visible,
  .map-toolbox__rail button.active {
    transform: none;
  }
}
</style>
