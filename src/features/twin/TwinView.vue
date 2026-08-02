<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import RadarChart from '@/shared/components/RadarChart.vue'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { loadSuperMapWebgl } from '@/gis/supermap3d/loadSdk'

type SceneMode = 'whiteModel' | 'oblique' | 'lidar'

interface SceneLayer {
  visible: boolean
}

interface SuperMapViewer {
  scene: {
    globe: { depthTestAgainstTerrain: boolean }
    layers?: { find?: (name: string) => SceneLayer | undefined }
    addS3MTilesLayerByScp: (url: string, options: { name: string }) => Promise<SceneLayer>
  }
  imageryLayers: {
    removeAll: (destroy?: boolean) => void
    addImageryProvider: (provider: unknown) => unknown
  }
  flyTo: (target: unknown) => Promise<boolean>
  camera: {
    setView: (options: Record<string, unknown>) => void
    flyTo: (options: Record<string, unknown>) => void
  }
  destroy: () => void
  isDestroyed?: () => boolean
}

interface CesiumRuntime {
  Viewer: new (container: HTMLElement, options: Record<string, unknown>) => SuperMapViewer
  UrlTemplateImageryProvider: new (options: {
    url: string
    minimumLevel?: number
    maximumLevel?: number
    tilingScheme?: unknown
    customTags?: Record<string, (provider: unknown, x: number, y: number, level: number) => string>
  }) => unknown
  WebMercatorTilingScheme: new () => unknown
  Cartesian3: { fromDegrees: (longitude: number, latitude: number, height: number) => unknown }
  Math: { toRadians: (degrees: number) => number }
}

const config = useRuntimeConfig()
const cesiumContainer = ref<HTMLElement | null>(null)
const engineStatus = ref('三维引擎初始化中')
const sceneMode = ref<SceneMode>('whiteModel')
const roamTip = ref('当前视角：全村鸟瞰')
const layerVisibility = ref({ buildingLayer: true, roadLayer: true, waterLayer: true, treeLayer: true, workshopLayer: true, issueLayer: true })
let viewer: SuperMapViewer | null = null
let openedLayers: SceneLayer[][] = [[], [], []]

const modeItems: Array<{ key: SceneMode; label: string }> = [
  { key: 'whiteModel', label: '三维白膜' },
  { key: 'oblique', label: '倾斜摄影实景' },
  { key: 'lidar', label: '激光雷达点云' },
]

const layers = [
  { key: 'buildingLayer', label: '建筑轮廓模型', meta: '342 栋' },
  { key: 'roadLayer', label: '路网与硬化面', meta: '12.5 km' },
  { key: 'waterLayer', label: '水系与沟渠', meta: '8.6 km' },
  { key: 'treeLayer', label: '特色泡桐林', meta: '1,250 亩' },
  { key: 'workshopLayer', label: '民族乐器工坊', meta: '15 家' },
  { key: 'issueLayer', label: '治理问题标绘', meta: '18 处' },
] as const

const activeModeLabel = computed(() => modeItems.find((item) => item.key === sceneMode.value)?.label ?? '')

function cesium(): CesiumRuntime {
  return (window as typeof window & { Cesium: CesiumRuntime }).Cesium
}

async function openScene(mode: SceneMode) {
  sceneMode.value = mode
  const url = config.supermap.realspace[mode]
  if (!viewer) {
    engineStatus.value = '三维 Viewer 尚未创建'
    return
  }
  if (!url) {
    engineStatus.value = `${activeModeLabel.value}服务待配置`
    return
  }

  try {
    engineStatus.value = `正在加载${activeModeLabel.value}`
    const existingIndex = modeItems.findIndex((item) => item.key === mode)
    openedLayers.forEach((layers, index) => {
      layers.forEach((layer) => (layer.visible = index === existingIndex))
    })
    if (!openedLayers[existingIndex]?.length) {
      const layer = await viewer.scene.addS3MTilesLayerByScp(url, { name: mode })
      openedLayers[existingIndex] = [layer]
      await viewer.flyTo(layer)
    }
    openedLayers.forEach((layers, index) => {
      layers.forEach((layer) => (layer.visible = index === existingIndex))
    })
    engineStatus.value = `${activeModeLabel.value}运行中`
  } catch (error) {
    engineStatus.value = error instanceof Error ? error.message : `${activeModeLabel.value}加载失败`
  }
}

function toggleLayer(key: keyof typeof layerVisibility.value) {
  const layer = viewer?.scene?.layers?.find?.(key)
  if (layer) layer.visible = layerVisibility.value[key]
}

function flyTo(target: 'center' | 'forest' | 'industry') {
  if (!viewer) return
  const destinations = {
    center: { lon: 114.8172, lat: 34.8248, height: 150, heading: 0, pitch: -30, name: '村委会广场' },
    forest: { lon: 114.821, lat: 34.829, height: 200, heading: 45, pitch: -45, name: '徐场村泡桐林' },
    industry: { lon: 114.812, lat: 34.821, height: 120, heading: -30, pitch: -20, name: '古琴制作工坊集群' },
  }
  const item = destinations[target]
  const sdk = cesium()
  roamTip.value = `漫游至：${item.name}`
  viewer.camera.flyTo({
    destination: sdk.Cartesian3.fromDegrees(item.lon, item.lat, item.height),
    orientation: { heading: sdk.Math.toRadians(item.heading), pitch: sdk.Math.toRadians(item.pitch), roll: 0 },
    duration: 2,
  })
}

async function initializeViewer() {
  await nextTick()
  if (!cesiumContainer.value) return
  try {
    await loadSuperMapWebgl(config.supermap.webglSdkUrl, config.supermap.webglWidgetsCssUrl)
    const sdk = cesium()
    viewer = new sdk.Viewer(cesiumContainer.value, {
      infoBox: false,
      selectionIndicator: false,
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
    })
    viewer.imageryLayers.removeAll(true)
    const baseMapUrl = config.supermap.mapServices.base.replace(/\/+$/, '')
    viewer.imageryLayers.addImageryProvider(
      new sdk.UrlTemplateImageryProvider({
        url: `${baseMapUrl}/tileImage.png?scale={scale}&x={x}&y={y}&width=256&height=256&transparent=false&cacheEnabled=true`,
        minimumLevel: 0,
        maximumLevel: 18,
        tilingScheme: new sdk.WebMercatorTilingScheme(),
        customTags: {
          scale: (_provider, _x, _y, level) => String(1.6901635716026553e-9 * 2 ** level),
        },
      }),
    )
    viewer.scene.globe.depthTestAgainstTerrain = true
    viewer.camera.setView({
      destination: sdk.Cartesian3.fromDegrees(114.81, 34.82, 3000),
      orientation: { heading: 0, pitch: sdk.Math.toRadians(-45), roll: 0 },
    })
    if (config.supermap.realspace.whiteModel) {
      await openScene('whiteModel')
    } else {
      engineStatus.value = '三维底图运行中，场景服务待配置'
    }
  } catch (error) {
    engineStatus.value = error instanceof Error ? error.message : '三维引擎初始化失败'
  }
}

onMounted(initializeViewer)

onBeforeUnmount(() => {
  openedLayers = [[], [], []]
  if (viewer && !viewer.isDestroyed?.()) viewer.destroy()
  viewer = null
})
</script>

<template>
  <main class="screen-page twin-page">
    <ScreenHeader
      title="数字孪生场景模块"
      subtitle="兰考泡桐示范村 · 三维重建 / 空间联动 / 产业资源 / 智能漫游"
    />

    <div class="twin-layout">
      <aside class="twin-left">
        <PanelCard title="村庄三维资产概览" meta="实景普查">
          <div class="metric-grid asset-grid">
            <article class="metric-card"><span>实景建筑</span><strong>342</strong><small>栋</small></article>
            <article class="metric-card"><span>泡桐林区</span><strong>1,250</strong><small>亩</small></article>
            <article class="metric-card"><span>乐器工坊</span><strong>15</strong><small>家</small></article>
            <article class="metric-card"><span>道路网络</span><strong>12.5</strong><small>km</small></article>
          </div>
        </PanelCard>

        <PanelCard title="全要素图层控制" meta="S3M 图层">
          <div class="twin-layer-list">
            <label v-for="layer in layers" :key="layer.key">
              <input v-model="layerVisibility[layer.key]" type="checkbox" @change="toggleLayer(layer.key)" />
              <i /><span>{{ layer.label }}<small>{{ layer.meta }}</small></span>
            </label>
          </div>
        </PanelCard>
      </aside>

      <section class="twin-scene panel-frame">
        <div ref="cesiumContainer" class="cesium-container" />
        <div class="map-toolbar">
          <button
            v-for="mode in modeItems"
            :key="mode.key"
            class="layer-button"
            :class="{ active: sceneMode === mode.key }"
            type="button"
            @click="openScene(mode.key)"
          >{{ mode.label }}</button>
        </div>
        <div class="scene-status"><i />{{ engineStatus }}</div>
        <div class="roam-tip">{{ roamTip }}</div>
      </section>

      <aside class="twin-right">
        <PanelCard title="视点智能漫游" meta="Camera FlyTo">
          <div class="roam-list">
            <button type="button" @click="flyTo('center')"><i>◎</i><span><strong>村委会广场</strong><small>行政与治理中心</small></span></button>
            <button type="button" @click="flyTo('forest')"><i>林</i><span><strong>徐场村泡桐林</strong><small>生态资源与原材料产地</small></span></button>
            <button type="button" @click="flyTo('industry')"><i>坊</i><span><strong>古琴制作工坊集群</strong><small>特色民族乐器产业链</small></span></button>
          </div>
        </PanelCard>

        <PanelCard title="三生空间评价模型" meta="场景实时关联">
          <RadarChart :labels="['生态连续性', '生活便利度', '产业活力', '治理响应', '空间品质']" :values="[88, 76, 92, 81, 84]" />
          <div class="scene-score"><span>场景综合评分</span><strong>84.2</strong></div>
        </PanelCard>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.twin-layout {
  display: grid;
  min-height: 0;
  gap: 10px;
  grid-template-columns: 290px minmax(560px, 1fr) 310px;
}

.twin-left,
.twin-right {
  display: grid;
  min-height: 0;
  gap: 10px;
}

.twin-left { grid-template-rows: 245px minmax(0, 1fr); }
.twin-right { grid-template-rows: 285px minmax(0, 1fr); }
.asset-grid .metric-card { text-align: center; }

.twin-layer-list {
  display: grid;
  gap: 8px;
}

.twin-layer-list label {
  display: grid;
  align-items: center;
  min-height: 45px;
  padding: 6px 9px;
  border: 1px solid rgba(122, 203, 190, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  grid-template-columns: 0 34px 1fr;
}

.twin-layer-list input { opacity: 0; }
.twin-layer-list > label > i {
  position: relative;
  width: 28px;
  height: 14px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.13);
  transition: 150ms ease;
}
.twin-layer-list > label > i::after {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  content: '';
  border-radius: 50%;
  background: var(--text-soft);
  transition: 150ms ease;
}
.twin-layer-list input:checked + i { background: rgba(61, 214, 196, 0.34); }
.twin-layer-list input:checked + i::after { left: 16px; background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }
.twin-layer-list span { display: grid; gap: 3px; font-size: 11px; }
.twin-layer-list small { color: var(--text-soft); font: 9px var(--font-data); }

.twin-scene {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #040c0d;
}

.cesium-container {
  position: absolute;
  inset: 0;
}

.scene-status,
.roam-tip {
  position: absolute;
  z-index: 100;
  padding: 8px 10px;
  color: var(--text-soft);
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(5, 16, 17, 0.84);
  font-size: 10px;
  backdrop-filter: blur(8px);
}

.scene-status { top: 10px; right: 10px; }
.scene-status i { display: inline-block; width: 6px; height: 6px; margin-right: 7px; border-radius: 50%; background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }
.roam-tip { right: 12px; bottom: 12px; border-left: 2px solid var(--amber); }

.roam-list { display: grid; gap: 9px; }
.roam-list button {
  display: grid;
  align-items: center;
  min-height: 62px;
  padding: 8px;
  color: var(--text);
  text-align: left;
  border: 1px solid rgba(122, 203, 190, 0.11);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.025);
  cursor: pointer;
  grid-template-columns: 38px 1fr;
}
.roam-list button:hover { border-color: var(--line-bright); background: rgba(61, 214, 196, 0.08); }
.roam-list button > i { display: grid; place-content: center; width: 28px; height: 28px; color: var(--cyan); font: normal 12px var(--font-data); border: 1px solid var(--line-bright); border-radius: 50%; }
.roam-list span { display: grid; gap: 4px; }
.roam-list strong { font-size: 11px; }
.roam-list small { color: var(--text-soft); font-size: 9px; }

.scene-score { display: flex; align-items: center; margin-top: -8px; padding: 8px 10px; border-top: 1px solid var(--line); }
.scene-score span { color: var(--text-soft); font-size: 10px; }
.scene-score strong { margin-left: auto; color: var(--cyan); font: 20px var(--font-data); }

:deep(.cesium-viewer-bottom),
:deep(.cesium-viewer-toolbar),
:deep(.cesium-viewer-animationContainer),
:deep(.cesium-viewer-timelineContainer) { display: none !important; }

@media (max-width: 1440px) {
  .twin-layout { grid-template-columns: 260px minmax(500px, 1fr) 280px; gap: 8px; }
  .twin-left, .twin-right { gap: 8px; }
  .twin-left { grid-template-rows: 220px minmax(0, 1fr); }
  .twin-right { grid-template-rows: 250px minmax(0, 1fr); }
  .twin-layer-list { gap: 5px; }
  .twin-layer-list label { min-height: 39px; }
}
</style>
