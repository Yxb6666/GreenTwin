<script setup lang="ts">
import L from 'leaflet'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PickedPoint } from './modelPlacement'

interface SceneOverview {
  longitude: number
  latitude: number
  longitudeRadius: number
  latitudeRadius: number
  heading: number
}

const props = defineProps<{
  sceneCanvas: HTMLCanvasElement | null
  point: PickedPoint | null
  overview: SceneOverview
  tileUrl: string
  planLabel: string
}>()

const emit = defineEmits<{
  previous: []
  next: []
  locate: [point: { longitude: number; latitude: number }]
}>()

const previewCanvas = ref<HTMLCanvasElement | null>(null)
const previewVideo = ref<HTMLVideoElement | null>(null)
const overviewHost = ref<HTMLElement | null>(null)
const previewReady = ref(false)
const locationLabel = computed(() =>
  props.point ? props.point.label : '堌阳镇治理模拟地块',
)

let overviewMap: L.Map | null = null
let extentLayer: L.Polygon | null = null
let centerMarker: L.CircleMarker | null = null
let selectedPointMarker: L.CircleMarker | null = null
let animationFrame = 0
let lastCaptureAt = 0
let resizeObserver: ResizeObserver | null = null
let sceneStream: MediaStream | null = null

function extentCorners() {
  const { latitude, longitude, latitudeRadius, longitudeRadius, heading } =
    props.overview
  const angle = (heading * Math.PI) / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x = 0, y = 0]) => {
    const rotatedX = x * cosine - y * sine
    const rotatedY = x * sine + y * cosine
    return [
      latitude + rotatedY * latitudeRadius,
      longitude + rotatedX * longitudeRadius,
    ] as L.LatLngTuple
  })
}

function resolveOverviewZoom(radius: number) {
  if (radius > 0.025) return 11
  if (radius > 0.01) return 12
  if (radius > 0.004) return 13
  if (radius > 0.0015) return 14
  if (radius > 0.0006) return 15
  return 16
}

function updateOverview() {
  if (!overviewMap) return
  const { latitude, longitude, latitudeRadius, longitudeRadius } =
    props.overview
  const corners = extentCorners()
  const radius = Math.max(latitudeRadius, longitudeRadius)
  const zoom = resolveOverviewZoom(radius)

  overviewMap.setView([latitude, longitude], zoom, {
    animate: false,
  })
  extentLayer?.setLatLngs(corners)
  centerMarker?.setLatLng([latitude, longitude])
  if (props.point) {
    selectedPointMarker?.setLatLng([
      props.point.latitude,
      props.point.longitude,
    ])
  }
}

function captureScene(timestamp: number) {
  animationFrame = window.requestAnimationFrame(captureScene)
  if (timestamp - lastCaptureAt < 180) return
  const source = props.sceneCanvas
  const target = previewCanvas.value
  if (!source || !target || source.width === 0 || source.height === 0) return

  const bounds = target.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.round(bounds.width * pixelRatio))
  const height = Math.max(1, Math.round(bounds.height * pixelRatio))
  if (target.width !== width || target.height !== height) {
    target.width = width
    target.height = height
  }

  const context = target.getContext('2d')
  if (!context) return
  try {
    context.drawImage(source, 0, 0, width, height)
    previewReady.value = true
    lastCaptureAt = timestamp
  } catch {
    previewReady.value = false
  }
}

async function connectSceneStream() {
  sceneStream?.getTracks().forEach((track) => track.stop())
  sceneStream = null
  const source = props.sceneCanvas
  const video = previewVideo.value
  if (!source || !video || typeof source.captureStream !== 'function') return

  sceneStream = source.captureStream(8)
  video.srcObject = sceneStream
  try {
    await video.play()
  } catch {
    return
  }
  previewReady.value = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
}

onMounted(async () => {
  await nextTick()
  if (overviewHost.value) {
    overviewMap = L.map(overviewHost.value, {
      attributionControl: false,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    })
    L.tileLayer(props.tileUrl, { minZoom: 0, maxZoom: 19 }).addTo(overviewMap)
    extentLayer = L.polygon(
      [
        [0, 0],
        [0, 0],
      ],
      {
        color: '#3dd6c4',
        weight: 1.5,
        fillColor: '#092b28',
        fillOpacity: 0.54,
        interactive: false,
      },
    ).addTo(overviewMap)
    centerMarker = L.circleMarker([0, 0], {
      radius: 3,
      color: '#f4fffd',
      weight: 1,
      fillColor: '#3dd6c4',
      fillOpacity: 1,
      interactive: false,
    }).addTo(overviewMap)
    selectedPointMarker = L.circleMarker([0, 0], {
      radius: 4,
      color: '#fff4d6',
      weight: 1.5,
      fillColor: '#f0b85c',
      fillOpacity: 1,
      interactive: false,
    })
    if (props.point) selectedPointMarker.addTo(overviewMap)
    overviewMap.on('click', ({ latlng }) => {
      emit('locate', { longitude: latlng.lng, latitude: latlng.lat })
    })
    updateOverview()
    resizeObserver = new ResizeObserver(() =>
      overviewMap?.invalidateSize(false),
    )
    resizeObserver.observe(overviewHost.value)
  }
  await connectSceneStream()
  animationFrame = window.requestAnimationFrame(captureScene)
})

watch(
  () => props.point,
  (point) => {
    if (!overviewMap || !selectedPointMarker) return
    if (point) {
      if (!overviewMap.hasLayer(selectedPointMarker)) {
        selectedPointMarker.addTo(overviewMap)
      }
    } else if (overviewMap.hasLayer(selectedPointMarker)) {
      selectedPointMarker.removeFrom(overviewMap)
    }
    updateOverview()
  },
  { deep: true },
)
watch(() => props.overview, updateOverview, { deep: true })
watch(() => props.sceneCanvas, () => void connectSceneStream())

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  resizeObserver = null
  sceneStream?.getTracks().forEach((track) => track.stop())
  sceneStream = null
  overviewMap?.remove()
  overviewMap = null
})
</script>

<template>
  <section class="plot-preview panel-frame" aria-label="地块场景与区位预览">
    <div class="scene-preview">
      <video
        ref="previewVideo"
        muted
        autoplay
        playsinline
        aria-hidden="true"
        @loadeddata="previewReady = true"
      />
      <canvas ref="previewCanvas" aria-hidden="true" />
      <div v-if="!previewReady" class="preview-placeholder">
        <i />
        <span>三维场景同步中</span>
      </div>
      <div class="scene-title">
        <strong>{{ planLabel }}</strong>
        <small>{{ locationLabel }}</small>
      </div>
      <button
        type="button"
        class="slide-button slide-button--previous"
        aria-label="查看上一方案场景"
        @click="$emit('previous')"
      >
        ‹
      </button>
      <button
        type="button"
        class="slide-button slide-button--next"
        aria-label="查看下一方案场景"
        @click="$emit('next')"
      >
        ›
      </button>
      <span class="live-badge"><i /> 三维场景</span>
    </div>

    <div class="overview-preview">
      <div ref="overviewHost" class="overview-map" />
      <div class="overview-heading">
        <span>区位概览</span>
        <strong>主场景实时同步</strong>
      </div>
      <div class="extent-legend"><i /> 当前视域 · 点击地图定位</div>
    </div>
  </section>
</template>

<style scoped>
.plot-preview {
  display: grid;
  min-height: 0;
  padding: 8px;
  gap: 7px;
  overflow: hidden;
  background: rgba(8, 23, 23, 0.92);
  grid-template-rows: minmax(0, 0.9fr) minmax(0, 1.1fr);
}

.scene-preview,
.overview-preview {
  position: relative;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(122, 203, 190, 0.17);
  border-radius: 7px;
  background: #081312;
}

.scene-preview canvas,
.scene-preview video,
.overview-map {
  width: 100%;
  height: 100%;
}

.scene-preview canvas,
.scene-preview video {
  position: absolute;
  inset: 0;
  display: block;
  object-fit: cover;
}

.scene-preview video {
  z-index: 1;
}

.scene-preview::after,
.overview-preview::after {
  position: absolute;
  z-index: 2;
  inset: 0;
  pointer-events: none;
  content: '';
  box-shadow: inset 0 0 22px rgba(0, 0, 0, 0.3);
}

.scene-title,
.overview-heading,
.live-badge,
.extent-legend {
  position: absolute;
  z-index: 4;
  backdrop-filter: blur(7px);
}

.scene-title {
  top: 0;
  right: 0;
  left: 0;
  display: grid;
  min-height: 31px;
  padding: 5px 42px;
  place-content: center;
  color: #f4fffd;
  text-align: center;
  background: linear-gradient(
    180deg,
    rgba(2, 12, 12, 0.78),
    rgba(2, 12, 12, 0.38)
  );
}

.scene-title strong {
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scene-title small {
  overflow: hidden;
  margin-top: 2px;
  color: rgba(224, 245, 240, 0.72);
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slide-button {
  position: absolute;
  z-index: 5;
  top: 50%;
  display: grid;
  width: 25px;
  height: 25px;
  padding: 0 0 2px;
  place-content: center;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  background: rgba(3, 14, 14, 0.56);
  font: 20px/1 var(--font-body);
  cursor: pointer;
  transform: translateY(-50%);
  transition: 140ms ease;
}

.slide-button:hover {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.58);
  background: rgba(3, 25, 23, 0.82);
}

.slide-button--previous {
  left: 7px;
}

.slide-button--next {
  right: 7px;
}

.live-badge {
  right: 7px;
  bottom: 6px;
  display: flex;
  align-items: center;
  padding: 3px 6px;
  gap: 4px;
  color: rgba(238, 248, 245, 0.78);
  border: 1px solid rgba(122, 203, 190, 0.18);
  border-radius: 99px;
  background: rgba(3, 14, 14, 0.64);
  font-size: 7px;
}

.live-badge i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 6px var(--cyan);
}

.preview-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 7px;
  color: var(--text-soft);
  background: radial-gradient(
    circle,
    rgba(61, 214, 196, 0.08),
    transparent 58%
  );
  font-size: 8px;
}

.preview-placeholder i {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(61, 214, 196, 0.18);
  border-top-color: var(--cyan);
  border-radius: 50%;
  animation: preview-spin 1.1s linear infinite;
}

.overview-heading {
  top: 7px;
  left: 7px;
  display: grid;
  min-width: 76px;
  padding: 5px 7px;
  gap: 2px;
  border: 1px solid rgba(122, 203, 190, 0.2);
  border-radius: 5px;
  background: rgba(3, 14, 14, 0.76);
}

.overview-heading span {
  color: #f4fffd;
  font-size: 9px;
  font-weight: 650;
}

.overview-heading strong {
  color: var(--cyan);
  font-size: 7px;
  font-weight: 500;
}

.extent-legend {
  right: 7px;
  bottom: 6px;
  display: flex;
  align-items: center;
  padding: 4px 6px;
  gap: 5px;
  color: rgba(238, 248, 245, 0.82);
  border-radius: 4px;
  background: rgba(3, 14, 14, 0.72);
  font-size: 7px;
}

.extent-legend i {
  width: 10px;
  height: 7px;
  border: 1px solid var(--cyan);
  background: rgba(9, 43, 40, 0.65);
}

:deep(.leaflet-container) {
  background: #0a1918;
  cursor: crosshair;
  font-family: var(--font-body);
}

:deep(.leaflet-tile-pane) {
  filter: brightness(0.62) saturate(0.72) hue-rotate(116deg);
}

@keyframes preview-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .preview-placeholder i {
    animation: none;
  }
}
</style>
