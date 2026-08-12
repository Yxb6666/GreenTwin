<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import RadarChart from '@/shared/components/RadarChart.vue'
import DecisionAssistant from '@/shared/assistant/DecisionAssistant.vue'
import type { DecisionAssistantContext } from '@/shared/assistant/assistant'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { loadSuperMapWebgl } from '@/gis/supermap3d/loadSdk'
import {
  createSimulationJob,
  waitForSimulationJob,
  type SimulationJob,
  type SimulationParameters,
  type SimulationPlacement,
} from './simulation'

type ScenarioKey = 'waterlogging' | 'public-space' | 'irrigation' | 'ecology'
type PlanKey = 'current' | 'planA' | 'planB'
type MeasureKey = 'ditch' | 'outlet' | 'pump' | 'road'

interface SceneLayer {
  visible: boolean
}

interface ModelPrimitive {
  show: boolean
  readyPromise?: Promise<ModelPrimitive>
}

interface SuperMapViewer {
  scene: {
    globe: { depthTestAgainstTerrain: boolean }
    layers?: { find?: (name: string) => SceneLayer | undefined }
    addVectorTilesMap: (options: Record<string, unknown>) => unknown
    primitives: {
      add: (primitive: ModelPrimitive) => ModelPrimitive
      remove: (primitive: ModelPrimitive) => boolean
    }
  }
  imageryLayers: {
    removeAll: (destroy?: boolean) => void
  }
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
  Cartesian3: {
    fromDegrees: (
      longitude: number,
      latitude: number,
      height: number,
    ) => unknown
  }
  Model: {
    fromGltf: (options: {
      url: string
      modelMatrix: unknown
      scale?: number
      minimumPixelSize?: number
      maximumScale?: number
    }) => ModelPrimitive
  }
  Transforms: {
    eastNorthUpToFixedFrame: (origin: unknown) => unknown
  }
  Math: { toRadians: (degrees: number) => number }
}

const config = useRuntimeConfig()
const cesiumContainer = ref<HTMLElement | null>(null)
const engineStatus = ref('三维引擎初始化中')
const activeScenario = ref<ScenarioKey>('waterlogging')
const activePlan = ref<PlanKey>('planA')
const activeMeasure = ref<MeasureKey>('ditch')
const buildProgress = ref(0)
const buildState = ref<'idle' | 'running' | 'ready' | 'error'>('idle')
const generatedJob = ref<SimulationJob | null>(null)
const buildInstruction = ref('帮我在地图处建造一个古风样式的建筑')
const conversation = ref([
  { role: 'assistant', text: '请描述想在地图中建造的内容，我会生成方案并演示施工过程。' },
])
const constructionStage = ref(0)
const isComparing = ref(false)
const operationMessage = ref('调整治理参数后点击“重新生成”，启动本机 Blender 建模任务')
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
let generatedModel: ModelPrimitive | null = null
let constructionRun = 0

const constructionStages = ['场地准备', '基础施工', '主体搭建', '屋顶封顶', '装饰完成']

function inferBuildingStyle(
  instruction: string,
): NonNullable<SimulationParameters['buildingStyle']> {
  if (/古风|中式|传统|四合院|亭|庙|牌楼/.test(instruction)) return 'traditional-chinese'
  if (/现代|办公|商业|玻璃|公寓|高层|科技/.test(instruction)) return 'modern'
  return 'rural'
}

// 项目边界数据中堌阳镇包围盒的中心点。徐场村精确坐标接入前只做镇域范围定位。
const simulationFocus = {
  longitude: 114.964285,
  latitude: 34.9511,
  height: 12000,
}

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

const currentScenario = computed(
  () =>
    scenarioTemplates.find((item) => item.key === activeScenario.value) ??
    scenarioTemplates[0]!,
)
const currentPlan = computed(() => planData[activePlan.value])
const isGenerating = computed(() => buildState.value === 'running')
const builderStatus = computed(() => {
  if (buildState.value === 'running') return '正在真实构建'
  if (buildState.value === 'ready') return '模型已加载'
  if (buildState.value === 'error') return '构建失败'
  return '等待首次构建'
})
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

async function loadGeneratedModel(
  modelUrl: string,
  placement: SimulationPlacement,
  focus = true,
) {
  if (!viewer) throw new Error('三维地图尚未初始化')
  const sdk = cesium()
  if (generatedModel) viewer.scene.primitives.remove(generatedModel)
  const origin = sdk.Cartesian3.fromDegrees(
    placement.longitude,
    placement.latitude,
    placement.height,
  )
  generatedModel = viewer.scene.primitives.add(
    sdk.Model.fromGltf({
      url: modelUrl,
      modelMatrix: sdk.Transforms.eastNorthUpToFixedFrame(origin),
      scale: 1,
      minimumPixelSize: 96,
      maximumScale: 8,
    }),
  )
  if (generatedModel.readyPromise) await generatedModel.readyPromise
  if (focus) viewer.camera.flyTo({
    destination: sdk.Cartesian3.fromDegrees(
      placement.longitude,
      placement.latitude - 0.00028,
      65,
    ),
    orientation: {
      heading: 0,
      pitch: sdk.Math.toRadians(-52),
      roll: 0,
    },
  })
}

async function playConstruction(job: SimulationJob) {
  const urls = job.stageUrls?.length ? job.stageUrls : [job.modelUrl!]
  const run = ++constructionRun
  for (let index = 0; index < urls.length; index += 1) {
    if (run !== constructionRun) return
    constructionStage.value = Math.min(index + 1, 4)
    buildProgress.value = 72 + Math.round(((index + 1) / urls.length) * 28)
    engineStatus.value = `施工演示：${constructionStages[constructionStage.value]}`
    await loadGeneratedModel(urls[index]!, job.placement, index === 0)
    await new Promise((resolve) => globalThis.setTimeout(resolve, 900))
  }
}

async function generatePlan() {
  const instruction = buildInstruction.value.trim()
  if (!instruction) return
  conversation.value.push({ role: 'user', text: instruction })
  const buildingStyle = inferBuildingStyle(instruction)
  const styleLabel = {
    'traditional-chinese': '传统中式',
    modern: '现代',
    rural: '乡村通用',
  }[buildingStyle]
  conversation.value.push({
    role: 'assistant',
    text: `已解析建造需求，当前采用“${styleLabel}”生成方案，正在准备施工演示。`,
  })
  constructionStage.value = 0
  buildState.value = 'running'
  buildProgress.value = 5
  generatedJob.value = null
  engineStatus.value = '正在向本机 Blender 提交参数化建模任务'
  operationMessage.value = '后端将生成道路、排水沟、积水面与示意建筑 GLB'
  try {
    const initialJob = await createSimulationJob(config.apiBaseUrl, {
      scenario: currentScenario.value.label,
      plan: currentPlan.value.label,
      ...parameters.value,
      prompt: instruction,
      buildingStyle,
    })
    const completedJob = await waitForSimulationJob(
      config.apiBaseUrl,
      initialJob,
      {
        timeoutMs: config.reportTimeoutMs,
        onProgress: (job) => {
          buildProgress.value = job.progress
          engineStatus.value = job.message
        },
      },
    )
    await playConstruction(completedJob)
    generatedJob.value = completedJob
    buildState.value = 'ready'
    buildProgress.value = 100
    engineStatus.value = `${completedJob.placement.label} · Blender GLB 已加载`
    operationMessage.value = '真实 Blender 建模任务已完成；当前为镇域测试定位，不代表徐场村精确落点'
    conversation.value.push({
      role: 'assistant',
      text: `${styleLabel}建筑已完成，可在地图中旋转、缩放并查看最终效果。`,
    })
  } catch (error) {
    buildState.value = 'error'
    engineStatus.value = error instanceof Error ? error.message : 'Blender 场景构建失败'
    operationMessage.value = '请检查 Blender 路径、后端服务和模型输出日志'
    conversation.value.push({ role: 'assistant', text: `建造失败：${engineStatus.value}` })
  }
}

function saveDraft() {
  operationMessage.value = `${currentPlan.value.label}已保存为草案，参数与模型版本已关联`
}

function handoffPlan() {
  operationMessage.value = `${currentPlan.value.label}已形成治理任务草案，可进入“三生治理”继续派单`
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
    viewer.scene.addVectorTilesMap({
      url: '/api/arcgis/world-streets',
      name: 'ArcGIS 世界街道图',
      tileWidth: 512,
      tileHeight: 512,
      canvasWidth: 512,
      minimumLevel: 0,
      maximumLevel: 22,
      labelDepthTestEnabled: false,
      viewer,
    })
    viewer.scene.globe.depthTestAgainstTerrain = true
    viewer.camera.setView({
      destination: sdk.Cartesian3.fromDegrees(
        simulationFocus.longitude,
        simulationFocus.latitude,
        simulationFocus.height,
      ),
      orientation: {
        heading: 0,
        pitch: sdk.Math.toRadians(-65),
        roll: 0,
      },
    })
    engineStatus.value = 'ArcGIS 世界街道图矢量瓦片 · 徐场村精确点位待接入'
  } catch (error) {
    engineStatus.value =
      error instanceof Error ? error.message : '三维引擎初始化失败'
  }
}

onMounted(initializeViewer)

onBeforeUnmount(() => {
  constructionRun += 1
  if (viewer && generatedModel) viewer.scene.primitives.remove(generatedModel)
  generatedModel = null
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

        <form class="build-dialog" @submit.prevent="generatePlan">
          <header>
            <span><i />AI 建造助手</span>
            <small>{{ isGenerating ? constructionStages[constructionStage] : '自然语言驱动建模' }}</small>
          </header>
          <div class="build-conversation" aria-live="polite">
            <p
              v-for="(message, index) in conversation.slice(-3)"
              :key="`${message.role}-${index}`"
              :class="message.role"
            >
              {{ message.text }}
            </p>
          </div>
          <div v-if="isGenerating" class="construction-steps">
            <span
              v-for="(stage, index) in constructionStages.slice(1)"
              :key="stage"
              :class="{ active: constructionStage >= index + 1 }"
            >{{ stage }}</span>
          </div>
          <label>
            <textarea
              v-model="buildInstruction"
              :disabled="isGenerating"
              rows="2"
              aria-label="建筑建造指令"
              placeholder="例如：在这里建造一座两层中式古风建筑"
              @keydown.ctrl.enter="generatePlan"
            />
            <button type="submit" :disabled="isGenerating || !buildInstruction.trim()">
              {{ isGenerating ? `${buildProgress}%` : '开始建造' }}
            </button>
          </label>
        </form>

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
          <strong>{{ builderStatus }}</strong>
        </div>
        <div class="scene-status"><i />{{ engineStatus }}</div>

        <div v-if="!generatedJob" class="location-notice">
          <strong>当前显示堌阳镇范围</strong>
          <span>点击“重新生成”，由本机 Blender 构建参数化测试场景并加载到地图</span>
        </div>

        <div v-if="isComparing" class="compare-divider">
          <span>方案 A</span><i /><span>方案 B</span>
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
.build-dialog {
  position: absolute;
  z-index: 35;
  right: 14px;
  bottom: 68px;
  display: grid;
  width: min(360px, calc(100% - 28px));
  padding: 12px;
  gap: 9px;
  border: 1px solid rgba(61, 214, 196, 0.32);
  border-radius: 10px;
  background: rgba(4, 17, 18, 0.94);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
}
.build-dialog header,
.build-dialog label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.build-dialog header span {
  color: var(--cyan);
  font-size: 11px;
  font-weight: 700;
}
.build-dialog header small {
  margin-left: auto;
  color: var(--text-soft);
  font-size: 8px;
}
.build-conversation {
  display: grid;
  max-height: 112px;
  overflow: auto;
  gap: 6px;
}
.build-conversation p {
  width: fit-content;
  max-width: 88%;
  margin: 0;
  padding: 6px 8px;
  border-radius: 7px;
  color: var(--text-soft);
  background: rgba(255, 255, 255, 0.055);
  font-size: 9px;
  line-height: 1.55;
}
.build-conversation p.user {
  margin-left: auto;
  color: #d9fffa;
  background: rgba(61, 214, 196, 0.14);
}
.construction-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
}
.construction-steps span {
  padding-top: 4px;
  color: rgba(205, 231, 225, 0.35);
  border-top: 2px solid rgba(205, 231, 225, 0.12);
  font-size: 7px;
  text-align: center;
}
.construction-steps span.active {
  color: var(--cyan);
  border-color: var(--cyan);
}
.build-dialog textarea {
  flex: 1;
  min-width: 0;
  resize: none;
  padding: 8px;
  color: var(--text-main);
  border: 1px solid rgba(122, 203, 190, 0.2);
  border-radius: 6px;
  outline: none;
  background: rgba(0, 0, 0, 0.24);
  font: 10px/1.45 inherit;
}
.build-dialog textarea:focus { border-color: var(--cyan); }
.build-dialog button {
  align-self: stretch;
  padding: 0 12px;
  color: #052321;
  border: 0;
  border-radius: 6px;
  background: var(--cyan);
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
}
.build-dialog button:disabled { opacity: 0.5; cursor: wait; }
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
.location-notice,
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

.location-notice {
  top: 50%;
  left: 50%;
  display: grid;
  width: min(360px, calc(100% - 40px));
  padding: 14px 18px;
  color: var(--text-soft);
  text-align: center;
  border: 1px solid rgba(240, 184, 92, 0.42);
  border-radius: 7px;
  background: rgba(5, 16, 17, 0.9);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.36);
  transform: translate(-50%, -50%);
  gap: 5px;
  backdrop-filter: blur(8px);
}
.location-notice strong {
  color: var(--amber);
  font-size: 12px;
}
.location-notice span {
  font-size: 9px;
  line-height: 1.6;
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
