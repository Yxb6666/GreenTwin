<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import RadarChart from '@/shared/components/RadarChart.vue'
import DecisionAssistant from '@/shared/assistant/DecisionAssistant.vue'
import type { DecisionAssistantContext } from '@/shared/assistant/assistant'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { loadSuperMapWebgl } from '@/gis/supermap3d/loadSdk'

type SceneMode = 'whiteModel'
type ScenarioKey = 'waterlogging' | 'public-space' | 'irrigation' | 'ecology'
type PlanKey = 'current' | 'planA' | 'planB'
type MeasureKey = 'ditch' | 'outlet' | 'pump' | 'road'

interface SceneLayer {
  visible: boolean
}

interface SuperMapViewer {
  scene: {
    globe: { depthTestAgainstTerrain: boolean }
    layers?: { find?: (name: string) => SceneLayer | undefined }
    addS3MTilesLayerByScp: (
      url: string,
      options: { name: string },
    ) => Promise<SceneLayer>
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
  Viewer: new (
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => SuperMapViewer
  UrlTemplateImageryProvider: new (options: {
    url: string
    minimumLevel?: number
    maximumLevel?: number
    tilingScheme?: unknown
    customTags?: Record<
      string,
      (provider: unknown, x: number, y: number, level: number) => string
    >
  }) => unknown
  WebMercatorTilingScheme: new () => unknown
  Cartesian3: {
    fromDegrees: (
      longitude: number,
      latitude: number,
      height: number,
    ) => unknown
  }
  Math: { toRadians: (degrees: number) => number }
}

const config = useRuntimeConfig()
const cesiumContainer = ref<HTMLElement | null>(null)
const engineStatus = ref('三维引擎初始化中')
const sceneMode = ref<SceneMode>('whiteModel')
const activeScenario = ref<ScenarioKey>('waterlogging')
const activePlan = ref<PlanKey>('planA')
const activeMeasure = ref<MeasureKey>('ditch')
const buildProgress = ref(100)
const isComparing = ref(false)
const operationMessage = ref('方案 A 已完成近实时构建，可以继续调整治理参数')
const layerVisibility = ref({
  buildingLayer: true,
  roadLayer: true,
  waterLayer: true,
  issueLayer: true,
})
const parameters = ref({
  ditchWidth: 0.5,
  ditchDepth: 0.7,
  outletCount: 4,
  roadRaiseHeight: 0.25,
})

let viewer: SuperMapViewer | null = null
let openedLayers: SceneLayer[][] = [[]]
let generationTimer: number | null = null

const modeItems: Array<{ key: SceneMode; label: string }> = [
  { key: 'whiteModel', label: '三维白模' },
]

const scenarioTemplates: Array<{
  key: ScenarioKey
  code: string
  label: string
  domain: string
}> = [
  {
    key: 'waterlogging',
    code: '涝',
    label: '道路积水治理',
    domain: '生活 · 生产',
  },
  {
    key: 'public-space',
    code: '居',
    label: '公共空间更新',
    domain: '生活空间',
  },
  { key: 'irrigation', code: '田', label: '农田灌排优化', domain: '生产空间' },
  { key: 'ecology', code: '河', label: '河道生态修复', domain: '生态空间' },
]

const measures: Array<{
  key: MeasureKey
  icon: string
  label: string
  description: string
}> = [
  {
    key: 'ditch',
    icon: '沟',
    label: '增设排水沟',
    description: '沿道路低侧布置 186 m',
  },
  {
    key: 'outlet',
    icon: '口',
    label: '增加排水口',
    description: '设置 4 处汇水节点',
  },
  {
    key: 'pump',
    icon: '泵',
    label: '配置临时泵站',
    description: '低洼点应急排水',
  },
  {
    key: 'road',
    icon: '路',
    label: '局部抬升路面',
    description: '重点路段抬升 0.25 m',
  },
]

const layers = [
  { key: 'buildingLayer', label: '建筑' },
  { key: 'roadLayer', label: '道路' },
  { key: 'waterLayer', label: '水系' },
  { key: 'issueLayer', label: '问题点' },
] as const

const planData: Record<
  PlanKey,
  {
    label: string
    stage: string
    scores: number[]
    composite: number
    cost: string
    duration: string
    residents: string
    risk: string
    deltas: string[]
    recommendation: string
  }
> = {
  current: {
    label: '治理前现状',
    stage: 'V0',
    scores: [61, 58, 73],
    composite: 64.0,
    cost: '—',
    duration: '—',
    residents: '286 人受影响',
    risk: '高',
    deltas: ['基准', '基准', '基准'],
    recommendation: '道路低洼点与排水盲区重叠，需要形成治理方案。',
  },
  planA: {
    label: '方案 A · 排水优先',
    stage: 'V1',
    scores: [76, 88, 83],
    composite: 82.3,
    cost: '48 万元',
    duration: '20 天',
    residents: '286 人受益',
    risk: '低',
    deltas: ['+15', '+30', '+10'],
    recommendation: '投入较低、生活改善最明显，建议作为近期治理方案。',
  },
  planB: {
    label: '方案 B · 综合改造',
    stage: 'V2',
    scores: [84, 82, 78],
    composite: 81.3,
    cost: '63 万元',
    duration: '32 天',
    residents: '312 人受益',
    risk: '中',
    deltas: ['+23', '+24', '+5'],
    recommendation: '生产通行提升更好，但施工周期和生态扰动相对较高。',
  },
}

const activeModeLabel = computed(
  () => modeItems.find((item) => item.key === sceneMode.value)?.label ?? '',
)
const currentScenario = computed(
  () =>
    scenarioTemplates.find((item) => item.key === activeScenario.value) ??
    scenarioTemplates[0]!,
)
const currentPlan = computed(() => planData[activePlan.value])
const isGenerating = computed(() => buildProgress.value < 100)
const assistantContext = computed<DecisionAssistantContext>(() => ({
  module: '三生模拟',
  scopeLabel: `${currentScenario.value.label} · ${currentPlan.value.label}`,
  updatedAt: new Date().toISOString(),
  data: {
    scenario: currentScenario.value.label,
    scenarioDomain: currentScenario.value.domain,
    activePlan: currentPlan.value.label,
    planMetrics: {
      composite: currentPlan.value.composite,
      cost: currentPlan.value.cost,
      duration: currentPlan.value.duration,
      residents: currentPlan.value.residents,
      risk: currentPlan.value.risk,
    },
    dimensionScores: {
      ecology: currentPlan.value.scores[0] ?? 0,
      life: currentPlan.value.scores[1] ?? 0,
      production: currentPlan.value.scores[2] ?? 0,
    },
    recommendation: currentPlan.value.recommendation,
    parameters: parameters.value,
    visibleLayers: layers
      .filter((item) => layerVisibility.value[item.key])
      .map((item) => item.label),
    selectedMeasure:
      measures.find((item) => item.key === activeMeasure.value)?.label ?? '',
    buildProgress: buildProgress.value,
    compareMode: isComparing.value,
  },
}))
const assistantPrompts = [
  '评估当前方案的收益、成本与风险',
  '方案 A 与方案 B 应该如何取舍？',
  '当前参数还有哪些优化空间？',
  '给出下一步模拟与核验建议',
]

function cesium(): CesiumRuntime {
  return (window as typeof window & { Cesium: CesiumRuntime }).Cesium
}

function selectScenario(key: ScenarioKey) {
  activeScenario.value = key
  operationMessage.value = `已切换至“${currentScenario.value.label}”模板，可从治理问题或地图范围创建模拟任务`
}

function selectPlan(key: PlanKey) {
  activePlan.value = key
  isComparing.value = false
  operationMessage.value = `当前查看：${planData[key].label}`
}

function selectMeasure(key: MeasureKey) {
  activeMeasure.value = key
  const measure = measures.find((item) => item.key === key)
  operationMessage.value = `正在配置治理措施：${measure?.label ?? ''}`
}

function toggleCompare() {
  isComparing.value = !isComparing.value
  operationMessage.value = isComparing.value
    ? '已进入双方案对比模式：左侧方案 A，右侧方案 B'
    : `已退出对比模式，当前查看：${currentPlan.value.label}`
}

function generatePlan() {
  if (generationTimer !== null) window.clearInterval(generationTimer)
  buildProgress.value = 8
  engineStatus.value = 'Blender 场景构建任务运行中'
  operationMessage.value = '正在提取GIS数据并重新生成局部三维场景'
  generationTimer = window.setInterval(() => {
    buildProgress.value = Math.min(100, buildProgress.value + 12)
    if (buildProgress.value >= 100) {
      if (generationTimer !== null) window.clearInterval(generationTimer)
      generationTimer = null
      engineStatus.value = `${activeModeLabel.value}运行中`
      operationMessage.value = '方案场景构建完成，三生影响指标已同步更新'
    }
  }, 180)
}

function saveDraft() {
  operationMessage.value = `${currentPlan.value.label}已保存为草案，参数与模型版本已关联`
}

function handoffPlan() {
  operationMessage.value = `${currentPlan.value.label}已形成治理任务草案，可进入“三生治理”继续派单`
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
    openedLayers.forEach((sceneLayers, index) => {
      sceneLayers.forEach((layer) => (layer.visible = index === existingIndex))
    })
    if (!openedLayers[existingIndex]?.length) {
      const layer = await viewer.scene.addS3MTilesLayerByScp(url, {
        name: mode,
      })
      openedLayers[existingIndex] = [layer]
      await viewer.flyTo(layer)
    }
    engineStatus.value = `${activeModeLabel.value}运行中`
  } catch (error) {
    engineStatus.value =
      error instanceof Error
        ? error.message
        : `${activeModeLabel.value}加载失败`
  }
}

function toggleLayer(key: keyof typeof layerVisibility.value) {
  const layer = viewer?.scene?.layers?.find?.(key)
  if (layer) layer.visible = layerVisibility.value[key]
}

async function initializeViewer() {
  await nextTick()
  if (!cesiumContainer.value) return
  try {
    await loadSuperMapWebgl(
      config.supermap.webglSdkUrl,
      config.supermap.webglWidgetsCssUrl,
    )
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
          scale: (_provider, _x, _y, level) =>
            String(1.6901635716026553e-9 * 2 ** level),
        },
      }),
    )
    viewer.scene.globe.depthTestAgainstTerrain = true
    viewer.camera.setView({
      destination: sdk.Cartesian3.fromDegrees(114.8172, 34.8248, 850),
      orientation: {
        heading: 0,
        pitch: sdk.Math.toRadians(-45),
        roll: 0,
      },
    })
    if (config.supermap.realspace.whiteModel) {
      await openScene('whiteModel')
    } else {
      engineStatus.value = '三维底图运行中，场景服务待配置'
    }
  } catch (error) {
    engineStatus.value =
      error instanceof Error ? error.message : '三维引擎初始化失败'
  }
}

onMounted(initializeViewer)

onBeforeUnmount(() => {
  if (generationTimer !== null) window.clearInterval(generationTimer)
  openedLayers = [[]]
  if (viewer && !viewer.isDestroyed?.()) viewer.destroy()
  viewer = null
})
</script>

<template>
  <main class="screen-page twin-page">
    <ScreenHeader
      title="三生模拟"
      subtitle="真实空间场景构建 · 治理方案推演 · 生产生活生态协同决策"
    />

    <section class="simulation-workbar panel-frame">
      <div class="workbar-task">
        <span class="task-id">SIM-2026-001</span>
        <strong>徐场村道路积水治理模拟</strong>
        <small>关联事件 ISSUE-2026-018 · 影响范围 400 m</small>
      </div>
      <div class="workbar-progress">
        <span>场景构建</span>
        <div><i :style="{ width: `${buildProgress}%` }" /></div>
        <strong>{{ buildProgress }}%</strong>
      </div>
      <div class="workbar-actions">
        <button type="button" class="tiny-button" @click="saveDraft">
          保存草案
        </button>
        <button
          type="button"
          class="action-button"
          :disabled="isGenerating"
          @click="generatePlan"
        >
          {{ isGenerating ? '构建中…' : '重新生成' }}
        </button>
        <button
          type="button"
          class="action-button action-button--primary"
          @click="handoffPlan"
        >
          下发治理
        </button>
      </div>
    </section>

    <div class="twin-layout">
      <aside class="twin-left">
        <PanelCard title="模拟任务" meta="治理场景模板">
          <div class="scenario-list">
            <button
              v-for="scenario in scenarioTemplates"
              :key="scenario.key"
              type="button"
              :class="{ active: activeScenario === scenario.key }"
              @click="selectScenario(scenario.key)"
            >
              <i>{{ scenario.code }}</i>
              <span
                ><strong>{{ scenario.label }}</strong
                ><small>{{ scenario.domain }}</small></span
              >
            </button>
          </div>
          <div class="issue-summary">
            <span>当前问题</span>
            <strong>连续降雨后道路低洼段积水，影响居民与农产品运输</strong>
            <small>徐场村东南主路 · 高紧急度 · 待研判</small>
          </div>
        </PanelCard>

        <PanelCard title="治理措施" meta="参数化场景构建">
          <div class="measure-list">
            <button
              v-for="measure in measures"
              :key="measure.key"
              type="button"
              :class="{ active: activeMeasure === measure.key }"
              @click="selectMeasure(measure.key)"
            >
              <i>{{ measure.icon }}</i>
              <span
                ><strong>{{ measure.label }}</strong
                ><small>{{ measure.description }}</small></span
              >
            </button>
          </div>

          <div class="parameter-panel">
            <label>
              <span
                >排水沟宽度
                <strong>{{ parameters.ditchWidth.toFixed(1) }} m</strong></span
              >
              <input
                v-model.number="parameters.ditchWidth"
                type="range"
                min="0.3"
                max="1.2"
                step="0.1"
              />
            </label>
            <label>
              <span
                >排水沟深度
                <strong>{{ parameters.ditchDepth.toFixed(1) }} m</strong></span
              >
              <input
                v-model.number="parameters.ditchDepth"
                type="range"
                min="0.4"
                max="1.5"
                step="0.1"
              />
            </label>
            <label>
              <span
                >排水口数量
                <strong>{{ parameters.outletCount }} 处</strong></span
              >
              <input
                v-model.number="parameters.outletCount"
                type="range"
                min="1"
                max="8"
                step="1"
              />
            </label>
          </div>

          <div class="layer-chips" aria-label="场景要素图层">
            <label v-for="layer in layers" :key="layer.key">
              <input
                v-model="layerVisibility[layer.key]"
                type="checkbox"
                @change="toggleLayer(layer.key)"
              />
              <span>{{ layer.label }}</span>
            </label>
          </div>
        </PanelCard>
      </aside>

      <section
        class="twin-scene panel-frame"
        :class="{ comparing: isComparing }"
      >
        <div ref="cesiumContainer" class="cesium-container" />

        <div class="map-toolbar simulation-toolbar">
          <button
            v-for="(plan, key) in planData"
            :key="key"
            class="layer-button"
            :class="{ active: activePlan === key && !isComparing }"
            type="button"
            @click="selectPlan(key as PlanKey)"
          >
            {{ plan.stage }} {{ plan.label.split(' · ')[0] }}
          </button>
          <button
            class="layer-button compare-button"
            :class="{ active: isComparing }"
            type="button"
            @click="toggleCompare"
          >
            A/B 对比
          </button>
        </div>

        <div class="builder-badge">
          <span>Blender 4.5 LTS</span>
          <strong>{{ isGenerating ? '近实时构建中' : '场景已就绪' }}</strong>
        </div>
        <div class="scene-status"><i />{{ engineStatus }}</div>

        <div class="simulation-pin simulation-pin--issue">
          <i>!</i
          ><span
            ><strong>道路积水点</strong><small>积水深度约 18 cm</small></span
          >
        </div>
        <div
          v-if="activePlan !== 'current' || isComparing"
          class="simulation-pin simulation-pin--measure"
        >
          <i>沟</i
          ><span><strong>拟建排水沟</strong><small>长度 186 m</small></span>
        </div>
        <div
          v-if="activePlan === 'planB' || isComparing"
          class="simulation-pin simulation-pin--pump"
        >
          <i>泵</i
          ><span><strong>临时泵站</strong><small>排量 320 m³/h</small></span>
        </div>

        <div v-if="isComparing" class="compare-divider">
          <span>方案 A</span><i /><span>方案 B</span>
        </div>

        <div class="scene-legend">
          <span><i class="legend-issue" />问题范围</span>
          <span><i class="legend-measure" />治理措施</span>
          <span><i class="legend-benefit" />受益区域</span>
        </div>

        <div class="version-timeline">
          <button
            v-for="(plan, key) in planData"
            :key="key"
            type="button"
            :class="{ active: activePlan === key }"
            @click="selectPlan(key as PlanKey)"
          >
            <i />
            <span>{{ plan.stage }}</span>
            <small>{{ plan.label }}</small>
          </button>
        </div>
      </section>

      <aside class="twin-right">
        <PanelCard title="三生影响评估" meta="方案实时关联">
          <div class="impact-layout">
            <RadarChart
              :labels="['生产保障', '生活改善', '生态安全']"
              :values="currentPlan.scores"
              :color="activePlan === 'planB' ? '#f0b85c' : '#3dd6c4'"
            />
            <div class="impact-score">
              <span>{{ currentPlan.label }}</span>
              <strong>{{ currentPlan.composite }}</strong>
              <small>三生协同指数</small>
            </div>
            <div class="impact-deltas">
              <article>
                <span>生产</span><strong>{{ currentPlan.scores[0] }}</strong
                ><small>{{ currentPlan.deltas[0] }}</small>
              </article>
              <article>
                <span>生活</span><strong>{{ currentPlan.scores[1] }}</strong
                ><small>{{ currentPlan.deltas[1] }}</small>
              </article>
              <article>
                <span>生态</span><strong>{{ currentPlan.scores[2] }}</strong
                ><small>{{ currentPlan.deltas[2] }}</small>
              </article>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="方案决策" meta="成本 · 周期 · 受益">
          <div class="plan-switcher">
            <button
              type="button"
              :class="{ active: activePlan === 'planA' }"
              @click="selectPlan('planA')"
            >
              <span>A</span><strong>排水优先</strong><small>近期推荐</small>
            </button>
            <button
              type="button"
              :class="{ active: activePlan === 'planB' }"
              @click="selectPlan('planB')"
            >
              <span>B</span><strong>综合改造</strong><small>远期提升</small>
            </button>
          </div>

          <div class="decision-metrics">
            <article>
              <span>估算投资</span><strong>{{ currentPlan.cost }}</strong>
            </article>
            <article>
              <span>实施周期</span><strong>{{ currentPlan.duration }}</strong>
            </article>
            <article>
              <span>居民影响</span><strong>{{ currentPlan.residents }}</strong>
            </article>
            <article>
              <span>实施风险</span><strong>{{ currentPlan.risk }}</strong>
            </article>
          </div>

          <div class="recommendation">
            <span>系统研判</span>
            <p>{{ currentPlan.recommendation }}</p>
          </div>

          <div class="operation-message" role="status">
            <i />{{ operationMessage }}
          </div>
        </PanelCard>
      </aside>
    </div>
  </main>
  <DecisionAssistant
    :endpoint="`${config.apiBaseUrl.replace(/\/$/, '')}/assistant/decision`"
    :timeout-ms="config.reportTimeoutMs"
    :context="assistantContext"
    :prompts="assistantPrompts"
  />
</template>

<style scoped>
.twin-page {
  grid-template-rows: 72px 44px minmax(0, 1fr);
}

.simulation-workbar {
  display: grid;
  align-items: center;
  min-width: 0;
  padding: 0 10px 0 14px;
  grid-template-columns: minmax(340px, 1fr) minmax(240px, 0.7fr) auto;
  gap: 18px;
}

.workbar-task {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 9px;
}

.workbar-task .task-id {
  padding: 4px 7px;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.28);
  border-radius: 4px;
  background: rgba(61, 214, 196, 0.08);
  font: 9px var(--font-data);
}

.workbar-task strong {
  font-size: 12px;
  white-space: nowrap;
}
.workbar-task small {
  overflow: hidden;
  color: var(--text-soft);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbar-progress {
  display: grid;
  align-items: center;
  color: var(--text-soft);
  font-size: 9px;
  grid-template-columns: auto minmax(100px, 1fr) 34px;
  gap: 7px;
}

.workbar-progress > div {
  height: 4px;
  overflow: hidden;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.08);
}

.workbar-progress i {
  display: block;
  height: 100%;
  background: var(--cyan);
  box-shadow: 0 0 7px var(--cyan);
  transition: width 180ms linear;
}
.workbar-progress strong {
  color: var(--cyan);
  font: 10px var(--font-data);
}
.workbar-actions {
  display: flex;
  gap: 6px;
}
.workbar-actions button {
  min-height: 28px;
  padding: 0 10px;
  color: var(--text-soft);
  font-size: 10px;
}
.workbar-actions button:disabled {
  cursor: wait;
  opacity: 0.65;
}
.workbar-actions .action-button--primary {
  color: #04201d;
  border-color: var(--cyan);
  background: var(--cyan);
  font-weight: 700;
}

.twin-layout {
  display: grid;
  min-height: 0;
  gap: 10px;
  grid-template-columns: 300px minmax(560px, 1fr) 330px;
}

.twin-left,
.twin-right {
  display: grid;
  min-height: 0;
  gap: 10px;
}

.twin-left {
  grid-template-rows: 290px minmax(0, 1fr);
}
.twin-right {
  grid-template-rows: minmax(310px, 0.95fr) minmax(280px, 1.05fr);
}

.scenario-list,
.measure-list {
  display: grid;
  gap: 6px;
}

.scenario-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.scenario-list button,
.measure-list button,
.plan-switcher button {
  display: grid;
  align-items: center;
  min-width: 0;
  color: var(--text);
  text-align: left;
  border: 1px solid rgba(122, 203, 190, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.025);
  cursor: pointer;
  transition: 150ms ease;
}

.scenario-list button {
  min-height: 54px;
  padding: 6px;
  grid-template-columns: 28px 1fr;
}
.measure-list button {
  min-height: 42px;
  padding: 5px 7px;
  grid-template-columns: 30px 1fr;
}
.scenario-list button:hover,
.measure-list button:hover,
.plan-switcher button:hover,
.scenario-list button.active,
.measure-list button.active,
.plan-switcher button.active {
  border-color: rgba(61, 214, 196, 0.54);
  background: rgba(61, 214, 196, 0.1);
}

.scenario-list button > i,
.measure-list button > i {
  display: grid;
  place-content: center;
  width: 23px;
  height: 23px;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.36);
  border-radius: 50%;
  font: normal 10px var(--font-data);
}

.scenario-list button span,
.measure-list button span {
  display: grid;
  min-width: 0;
  gap: 3px;
}
.scenario-list button strong,
.measure-list button strong {
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.scenario-list button small,
.measure-list button small {
  overflow: hidden;
  color: var(--text-soft);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-summary {
  display: grid;
  margin-top: 8px;
  padding: 9px 10px;
  gap: 5px;
  border-left: 2px solid var(--amber);
  background: rgba(240, 184, 92, 0.06);
}
.issue-summary span {
  color: var(--amber);
  font-size: 9px;
}
.issue-summary strong {
  font-size: 10px;
  line-height: 1.5;
}
.issue-summary small {
  color: var(--text-soft);
  font-size: 8px;
}

.parameter-panel {
  display: grid;
  margin-top: 9px;
  padding-top: 8px;
  gap: 7px;
  border-top: 1px solid rgba(122, 203, 190, 0.12);
}
.parameter-panel label {
  display: grid;
  gap: 4px;
}
.parameter-panel label > span {
  display: flex;
  color: var(--text-soft);
  font-size: 8px;
}
.parameter-panel label strong {
  margin-left: auto;
  color: var(--cyan);
  font: 9px var(--font-data);
}
.parameter-panel input {
  width: 100%;
  height: 3px;
  accent-color: var(--cyan);
  cursor: pointer;
}

.layer-chips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 9px;
  gap: 5px;
}
.layer-chips label {
  position: relative;
  cursor: pointer;
}
.layer-chips input {
  position: absolute;
  opacity: 0;
}
.layer-chips span {
  display: block;
  padding: 4px 8px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.13);
  border-radius: 99px;
  font-size: 8px;
}
.layer-chips input:checked + span {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.42);
  background: rgba(61, 214, 196, 0.1);
}

.twin-scene {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #040c0d;
}

.twin-scene::after {
  position: absolute;
  z-index: 20;
  inset: 0;
  pointer-events: none;
  content: '';
  box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.48);
}

.cesium-container {
  position: absolute;
  inset: 0;
}
.simulation-toolbar {
  right: auto;
  left: 10px;
}
.compare-button {
  margin-left: 4px;
  color: var(--amber);
  border-color: rgba(240, 184, 92, 0.35);
}

.scene-status,
.builder-badge,
.scene-legend,
.version-timeline,
.simulation-pin,
.compare-divider {
  position: absolute;
  z-index: 100;
}

.scene-status,
.builder-badge,
.scene-legend {
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(5, 16, 17, 0.86);
  backdrop-filter: blur(8px);
}

.scene-status {
  top: 10px;
  right: 10px;
  color: var(--text-soft);
  font-size: 9px;
}
.scene-status i {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 8px var(--cyan);
}
.builder-badge {
  top: 48px;
  right: 10px;
  display: grid;
  text-align: right;
  gap: 2px;
}
.builder-badge span {
  color: var(--text-soft);
  font: 8px var(--font-data);
}
.builder-badge strong {
  color: var(--cyan);
  font-size: 9px;
}

.simulation-pin {
  display: grid;
  align-items: center;
  min-width: 138px;
  padding: 7px;
  gap: 7px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(5, 16, 17, 0.9);
  grid-template-columns: 28px 1fr;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.32);
}
.simulation-pin::after {
  position: absolute;
  bottom: -22px;
  left: 19px;
  width: 1px;
  height: 22px;
  content: '';
  background: currentColor;
}
.simulation-pin > i {
  display: grid;
  place-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font: normal 10px var(--font-data);
}
.simulation-pin span {
  display: grid;
  gap: 3px;
}
.simulation-pin strong {
  font-size: 9px;
}
.simulation-pin small {
  color: var(--text-soft);
  font-size: 8px;
}
.simulation-pin--issue {
  top: 42%;
  left: 43%;
  color: #ef7b6e;
  border-color: rgba(239, 123, 110, 0.44);
}
.simulation-pin--issue > i {
  background: rgba(239, 123, 110, 0.18);
}
.simulation-pin--measure {
  top: 57%;
  left: 29%;
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.44);
}
.simulation-pin--measure > i {
  background: rgba(61, 214, 196, 0.16);
}
.simulation-pin--pump {
  top: 36%;
  right: 21%;
  color: var(--amber);
  border-color: rgba(240, 184, 92, 0.44);
}
.simulation-pin--pump > i {
  background: rgba(240, 184, 92, 0.16);
}

.scene-legend {
  right: 10px;
  bottom: 76px;
  display: flex;
  gap: 10px;
  color: var(--text-soft);
  font-size: 8px;
}
.scene-legend span {
  display: flex;
  align-items: center;
  gap: 4px;
}
.scene-legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.legend-issue {
  background: #ef7b6e;
}
.legend-measure {
  background: var(--cyan);
}
.legend-benefit {
  background: var(--amber);
}

.version-timeline {
  right: 12px;
  bottom: 12px;
  left: 12px;
  display: grid;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(5, 16, 17, 0.9);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  backdrop-filter: blur(8px);
}
.version-timeline::before {
  position: absolute;
  top: 15px;
  right: 17%;
  left: 17%;
  height: 1px;
  content: '';
  background: rgba(122, 203, 190, 0.2);
}
.version-timeline button {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  color: var(--text-soft);
  border: 0;
  background: transparent;
  cursor: pointer;
  gap: 2px;
}
.version-timeline button i {
  width: 8px;
  height: 8px;
  border: 2px solid #486561;
  border-radius: 50%;
  background: #0a1918;
}
.version-timeline button span {
  margin-top: 2px;
  font: 8px var(--font-data);
}
.version-timeline button small {
  font-size: 7px;
}
.version-timeline button.active {
  color: var(--cyan);
}
.version-timeline button.active i {
  border-color: var(--cyan);
  background: var(--cyan);
  box-shadow: 0 0 8px var(--cyan);
}

.compare-divider {
  top: 90px;
  bottom: 74px;
  left: 50%;
  display: grid;
  justify-items: center;
  color: var(--text);
  font-size: 9px;
  grid-template-rows: auto 1fr auto;
  transform: translateX(-50%);
}
.compare-divider i {
  width: 1px;
  margin: 5px 0;
  background: linear-gradient(transparent, var(--cyan), transparent);
  box-shadow: 0 0 8px var(--cyan);
}
.twin-scene.comparing::before {
  position: absolute;
  z-index: 15;
  top: 0;
  right: 0;
  bottom: 0;
  left: 50%;
  pointer-events: none;
  content: '';
  background: rgba(240, 184, 92, 0.045);
}

.impact-layout {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-rows: minmax(125px, 1fr) auto auto;
}
.impact-layout .radar-chart {
  min-height: 0;
}
.impact-score {
  display: grid;
  align-items: center;
  padding: 4px 8px 7px;
  text-align: center;
  grid-template-columns: 1fr auto;
}
.impact-score span {
  color: var(--text-soft);
  font-size: 9px;
  text-align: left;
}
.impact-score strong {
  color: var(--cyan);
  font: 23px var(--font-data);
  grid-row: span 2;
}
.impact-score small {
  color: var(--text-soft);
  font-size: 8px;
  text-align: left;
}
.impact-deltas {
  display: grid;
  border-top: 1px solid rgba(122, 203, 190, 0.12);
  grid-template-columns: repeat(3, 1fr);
}
.impact-deltas article {
  display: grid;
  padding: 8px 5px;
  text-align: center;
  gap: 2px;
}
.impact-deltas article + article {
  border-left: 1px solid rgba(122, 203, 190, 0.1);
}
.impact-deltas span {
  color: var(--text-soft);
  font-size: 8px;
}
.impact-deltas strong {
  color: var(--cyan);
  font: 15px var(--font-data);
}
.impact-deltas small {
  color: var(--amber);
  font: 8px var(--font-data);
}

.plan-switcher {
  display: grid;
  gap: 7px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.plan-switcher button {
  min-height: 54px;
  padding: 7px;
  grid-template-columns: 27px 1fr;
}
.plan-switcher button > span {
  display: grid;
  place-content: center;
  width: 23px;
  height: 23px;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.35);
  border-radius: 50%;
  font: 10px var(--font-data);
  grid-row: span 2;
}
.plan-switcher button strong {
  font-size: 9px;
}
.plan-switcher button small {
  color: var(--text-soft);
  font-size: 8px;
}

.decision-metrics {
  display: grid;
  margin-top: 9px;
  gap: 6px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.decision-metrics article {
  display: flex;
  align-items: center;
  min-height: 34px;
  padding: 6px 8px;
  border: 1px solid rgba(122, 203, 190, 0.1);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.02);
}
.decision-metrics span {
  color: var(--text-soft);
  font-size: 8px;
}
.decision-metrics strong {
  margin-left: auto;
  color: var(--cyan);
  font: 9px var(--font-data);
}

.recommendation {
  margin-top: 8px;
  padding: 8px 9px;
  border-left: 2px solid var(--cyan);
  background: rgba(61, 214, 196, 0.05);
}
.recommendation span {
  color: var(--cyan);
  font-size: 8px;
}
.recommendation p {
  margin: 4px 0 0;
  color: var(--text-soft);
  font-size: 8px;
  line-height: 1.55;
}
.operation-message {
  display: flex;
  align-items: flex-start;
  margin-top: 8px;
  color: var(--text-soft);
  font-size: 8px;
  line-height: 1.45;
}
.operation-message i {
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  margin: 3px 6px 0 0;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 6px var(--cyan);
}

:deep(.cesium-viewer-bottom),
:deep(.cesium-viewer-toolbar),
:deep(.cesium-viewer-animationContainer),
:deep(.cesium-viewer-timelineContainer) {
  display: none !important;
}

@media (max-width: 1440px) {
  .twin-layout {
    grid-template-columns: 270px minmax(500px, 1fr) 290px;
    gap: 8px;
  }
  .twin-left,
  .twin-right {
    gap: 8px;
  }
  .twin-left {
    grid-template-rows: 270px minmax(0, 1fr);
  }
  .twin-right {
    grid-template-rows: minmax(280px, 0.95fr) minmax(255px, 1.05fr);
  }
  .simulation-workbar {
    gap: 10px;
    grid-template-columns: minmax(300px, 1fr) 210px auto;
  }
  .workbar-task small {
    display: none;
  }
  .scenario-list button {
    min-height: 48px;
  }
  .measure-list {
    gap: 4px;
  }
  .measure-list button {
    min-height: 37px;
  }
  .simulation-pin {
    transform: scale(0.9);
  }
}

@media (max-height: 800px) {
  .twin-left {
    grid-template-rows: 230px minmax(0, 1fr);
  }

  .scenario-list button {
    min-height: 42px;
  }

  .issue-summary {
    margin-top: 6px;
    padding: 6px 8px;
    gap: 3px;
  }

  .measure-list button {
    min-height: 33px;
    padding-block: 3px;
  }

  .parameter-panel {
    margin-top: 6px;
    padding-top: 6px;
    gap: 4px;
  }

  .layer-chips {
    margin-top: 6px;
  }
}
</style>
