<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import RadarChart from '@/shared/components/RadarChart.vue'
import DecisionAssistant from '@/shared/assistant/DecisionAssistant.vue'
import type { DecisionAssistantContext } from '@/shared/assistant/assistant'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { loadSuperMapWebgl } from '@/gis/supermap3d/loadSdk'
import { buildArcGisTileUrl } from '@/gis/leaflet/baseMaps'
import AiBuilderAssistant, {
  type AiBuilderStyle,
} from './AiBuilderAssistant.vue'
import {
  clampModelScale,
  formatPointLabel,
  normalizeHeading,
  normalizePoint,
  toSimulationPlacement,
  type PickedPoint,
} from './modelPlacement'
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
  modelMatrix?: unknown
}

interface CesiumMovement {
  position?: { x: number; y: number }
  endPosition?: { x: number; y: number }
}

interface CesiumEventHandler {
  setInputAction: (action: (movement: CesiumMovement) => void, type: number) => void
  destroy: () => void
}

interface SuperMapViewer {
  entities: {
    add: (options: Record<string, unknown>) => unknown
    remove: (entity: unknown) => boolean
  }
  scene: {
    canvas: HTMLElement
    globe: {
      depthTestAgainstTerrain: boolean
      show: boolean
      pick: (ray: unknown, scene: SuperMapViewer['scene']) => unknown
    }
    layers?: { find?: (name: string) => SceneLayer | undefined }
    primitives: {
      add: (primitive: ModelPrimitive) => ModelPrimitive
      remove: (primitive: ModelPrimitive) => boolean
    }
    pick: (windowPosition: { x: number; y: number }) => unknown
    pickPosition: (windowPosition: { x: number; y: number }) => unknown
  }
  imageryLayers: {
    addImageryProvider: (provider: unknown) => unknown
    removeAll: (destroy?: boolean) => void
  }
  camera: {
    setView: (options: Record<string, unknown>) => void
    flyTo: (options: Record<string, unknown>) => void
    getPickRay: (position: { x: number; y: number }) => unknown
    pickEllipsoid: (
      position: { x: number; y: number },
      ellipsoid?: unknown,
    ) => unknown
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
  Cartesian2: new (x: number, y: number) => unknown
  Cartographic: {
    fromCartesian: (cartesian: unknown) => {
      longitude: number
      latitude: number
      height: number
    }
  }
  ScreenSpaceEventHandler: new (canvas?: HTMLElement) => CesiumEventHandler
  ScreenSpaceEventType: {
    LEFT_CLICK: number
    LEFT_DOWN: number
    LEFT_UP: number
    MOUSE_MOVE: number
  }
  WebMercatorTilingScheme: new () => unknown
  UrlTemplateImageryProvider: new (options: Record<string, unknown>) => unknown
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
    headingPitchRollToFixedFrame: (
      origin: unknown,
      headingPitchRoll: unknown,
      ellipsoid?: unknown,
      fixedFrameTransform?: unknown,
    ) => unknown
  }
  Matrix4: (new () => unknown) & {
    multiplyByUniformScale: (
      matrix: unknown,
      scale: number,
      result?: unknown,
    ) => unknown
  }
  HeadingPitchRoll: new (heading: number, pitch: number, roll: number) => unknown
  Ellipsoid: { WGS84: unknown }
  Math: {
    toRadians: (degrees: number) => number
    toDegrees: (radians: number) => number
  }
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
const constructionStage = ref(0)
const builderOpen = ref(false)
const pickMode = ref(false)
const isDraggingModel = ref(false)
const modelSelected = ref(false)
const modelScale = ref(1)
const modelHeading = ref(0)
const selectedPoint = ref<PickedPoint | null>(null)
const operationMessage = ref('点击“AI 建造”，先在地图上选点，再输入提示词启动 Blender 建模')
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
let markerEntity: unknown = null
let eventHandler: CesiumEventHandler | null = null
let suppressClickAfterDrag = false

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
    compareMode: false,
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
  operationMessage.value = `当前查看：${planData[key].label}`
}

function selectMeasure(key: MeasureKey) {
  activeMeasure.value = key
  const measure = measures.find((item) => item.key === key)
  operationMessage.value = `正在配置治理措施：${measure?.label ?? ''}`
}

async function loadGeneratedModel(
  modelUrl: string,
  placement: SimulationPlacement,
  focus = true,
) {
  if (!viewer) throw new Error('三维地图尚未初始化')
  const sdk = cesium()
  if (generatedModel) viewer.scene.primitives.remove(generatedModel)
  selectedPoint.value = normalizePoint(
    placement.longitude,
    placement.latitude,
    placement.height,
    placement.heading,
    placement.label,
  )
  modelScale.value = 1
  modelHeading.value = placement.heading
  modelSelected.value = true
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
  applyModelTransform()
  upsertMarker(selectedPoint.value)
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

function upsertMarker(point: PickedPoint | null) {
  if (!viewer || !point) return
  const sdk = cesium()
  const position = sdk.Cartesian3.fromDegrees(
    point.longitude,
    point.latitude,
    point.height,
  )
  if (markerEntity) viewer.entities.remove(markerEntity)
  markerEntity = viewer.entities.add({
    position,
    point: {
      pixelSize: modelSelected.value ? 18 : 12,
      color: modelSelected.value ? '#3dd6c4' : '#ef7b6e',
      outlineColor: '#ffffff',
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: point.label,
      font: '10px sans-serif',
      fillColor: '#eafffb',
      showBackground: true,
      backgroundColor: '#051011',
      backgroundPadding: { x: 7, y: 4 },
      pixelOffset: new sdk.Cartesian2(0, -26),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
}

function applyModelTransform() {
  if (!viewer || !generatedModel || !selectedPoint.value) return
  const sdk = cesium()
  const point = selectedPoint.value
  const origin = sdk.Cartesian3.fromDegrees(
    point.longitude,
    point.latitude,
    point.height,
  )
  const headingPitchRoll = new sdk.HeadingPitchRoll(
    sdk.Math.toRadians(modelHeading.value),
    0,
    0,
  )
  const frame = sdk.Transforms.headingPitchRollToFixedFrame(
    origin,
    headingPitchRoll,
    sdk.Ellipsoid.WGS84,
    sdk.Transforms.eastNorthUpToFixedFrame,
  )
  generatedModel.modelMatrix = sdk.Matrix4.multiplyByUniformScale(
    frame,
    modelScale.value,
    new sdk.Matrix4(),
  )
}

function pickGroundPoint(position: { x: number; y: number }) {
  if (!viewer) return null
  const sdk = cesium()
  const ray = viewer.camera.getPickRay(position)
  const cartesian =
    (ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined) ??
    viewer.scene.pickPosition(position) ??
    viewer.camera.pickEllipsoid(position, sdk.Ellipsoid.WGS84)
  if (!cartesian) return null
  const cartographic = sdk.Cartographic.fromCartesian(cartesian)
  const longitude = sdk.Math.toDegrees(cartographic.longitude)
  const latitude = sdk.Math.toDegrees(cartographic.latitude)
  return normalizePoint(
    longitude,
    latitude,
    cartographic.height,
    modelHeading.value,
    formatPointLabel(longitude, latitude),
  )
}

function togglePointPicking() {
  if (pickMode.value) {
    pickMode.value = false
    operationMessage.value = '已取消选点'
    return
  }
  pickMode.value = true
  operationMessage.value = '点击地图确定建造位置；再次点击“AI 建造”面板中的按钮可取消'
}

function cancelPointPicking() {
  pickMode.value = false
}

function handleSceneClick(position: { x: number; y: number }) {
  const point = pickGroundPoint(position)
  if (!point) {
    operationMessage.value = '未拾取到地图表面，请点击有地形或底图的位置'
    return
  }
  pickMode.value = false
  modelSelected.value = false
  selectedPoint.value = point
  upsertMarker(point)
  operationMessage.value = `已确定建造位置：${point.label}，请在 AI 建造对话框中输入提示词`
}

function selectModel() {
  if (!generatedModel) return
  modelSelected.value = true
  if (selectedPoint.value) upsertMarker(selectedPoint.value)
  operationMessage.value = '模型已选中，可在地图上拖拽移动，或用面板滑杆缩放和旋转'
}

function startModelDrag(movement: CesiumMovement) {
  if (!viewer || pickMode.value || !movement.position) return
  const picked = viewer.scene.pick(movement.position) as {
    primitive?: unknown
    id?: unknown
  }
  const hitModel =
    picked && (picked.primitive === generatedModel || picked.id === generatedModel)
  if (!hitModel) return
  isDraggingModel.value = true
  suppressClickAfterDrag = true
  modelSelected.value = true
}

function moveModelDrag(movement: CesiumMovement) {
  if (!isDraggingModel.value || !movement.endPosition) return
  const point = pickGroundPoint(movement.endPosition)
  if (!point) return
  selectedPoint.value = point
  upsertMarker(point)
  applyModelTransform()
}

function endModelDrag() {
  isDraggingModel.value = false
}

function setupSceneInteractions() {
  if (!viewer || eventHandler) return
  const sdk = cesium()
  eventHandler = new sdk.ScreenSpaceEventHandler(viewer.scene.canvas)
  eventHandler.setInputAction((movement) => {
    if (!movement.position) return
    if (suppressClickAfterDrag) {
      suppressClickAfterDrag = false
      return
    }
    if (pickMode.value) {
      handleSceneClick(movement.position)
      return
    }
    const picked = viewer?.scene.pick(movement.position) as {
      primitive?: unknown
      id?: unknown
    }
    const hitModel =
      picked && (picked.primitive === generatedModel || picked.id === generatedModel)
    if (hitModel) selectModel()
    else if (!isDraggingModel.value && selectedPoint.value) {
      modelSelected.value = false
      upsertMarker(selectedPoint.value)
    }
  }, sdk.ScreenSpaceEventType.LEFT_CLICK)
  eventHandler.setInputAction(startModelDrag, sdk.ScreenSpaceEventType.LEFT_DOWN)
  eventHandler.setInputAction(moveModelDrag, sdk.ScreenSpaceEventType.MOUSE_MOVE)
  eventHandler.setInputAction(endModelDrag, sdk.ScreenSpaceEventType.LEFT_UP)
}

async function buildFromPrompt(prompt: string, requestedStyle: AiBuilderStyle) {
  const point = selectedPoint.value
  if (!point || !prompt.trim() || isGenerating.value) return
  const buildingStyle =
    requestedStyle === 'auto' ? inferBuildingStyle(prompt) : requestedStyle
  const styleLabel = {
    'traditional-chinese': '传统中式',
    modern: '现代',
    rural: '乡村通用',
  }[buildingStyle]
  constructionStage.value = 0
  buildState.value = 'running'
  buildProgress.value = 5
  generatedJob.value = null
  modelSelected.value = false
  engineStatus.value = `正在向本机 Blender 提交“${styleLabel}”建模任务`
  operationMessage.value = `将在 ${point.label} 生成“${styleLabel}”建筑模型`
  try {
    const initialJob = await createSimulationJob(config.apiBaseUrl, {
      scenario: currentScenario.value.label,
      plan: currentPlan.value.label,
      ...parameters.value,
      prompt,
      buildingStyle,
      placement: toSimulationPlacement(point),
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
    modelSelected.value = true
    engineStatus.value = `${completedJob.placement.label} · Blender GLB 已加载`
    operationMessage.value =
      '真实 Blender 建模任务已完成；点击模型可选中，拖拽移动，或用面板滑杆缩放和旋转'
  } catch (error) {
    buildState.value = 'error'
    engineStatus.value =
      error instanceof Error ? error.message : 'Blender 场景构建失败'
    operationMessage.value = '请检查 Blender 路径、后端服务和模型输出日志'
  }
}

function updateModelScale(value: number) {
  modelScale.value = clampModelScale(value)
  applyModelTransform()
  selectModel()
}

function updateModelHeading(value: number) {
  modelHeading.value = normalizeHeading(value)
  applyModelTransform()
  selectModel()
}

function focusGeneratedModel() {
  if (!viewer || !selectedPoint.value) return
  const sdk = cesium()
  const point = selectedPoint.value
  viewer.camera.flyTo({
    destination: sdk.Cartesian3.fromDegrees(
      point.longitude,
      point.latitude - 0.00014,
      Math.max(55, point.height + 42),
    ),
    orientation: {
      heading: 0,
      pitch: sdk.Math.toRadians(-52),
      roll: 0,
    },
  })
}

function removeGeneratedModel() {
  if (viewer && generatedModel) viewer.scene.primitives.remove(generatedModel)
  generatedModel = null
  generatedJob.value = null
  buildState.value = 'idle'
  buildProgress.value = 0
  modelSelected.value = false
  if (selectedPoint.value) upsertMarker(selectedPoint.value)
  engineStatus.value = '模型已移除，可重新选点并输入提示词建造'
}

function openBuilder() {
  builderOpen.value = true
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
    engineStatus.value = '正在加载 ArcGIS 导航底图'
    viewer.imageryLayers.addImageryProvider(
      new sdk.UrlTemplateImageryProvider({
        url: buildArcGisTileUrl('arcgis/navigation', config.arcgis.accessToken),
        tilingScheme: new sdk.WebMercatorTilingScheme(),
        minimumLevel: 0,
        maximumLevel: 19,
      }),
    )
    viewer.scene.globe.show = true
    viewer.scene.globe.depthTestAgainstTerrain = true
    viewer.camera.setView({
      destination: sdk.Cartesian3.fromDegrees(
        simulationFocus.longitude,
        simulationFocus.latitude,
        simulationFocus.height,
      ),
      orientation: {
        heading: 0,
        pitch: sdk.Math.toRadians(-90),
        roll: 0,
      },
    })
    setupSceneInteractions()
    engineStatus.value = 'ArcGIS 导航底图 · SuperMap 兼容模式'
  } catch (error) {
    engineStatus.value =
      error instanceof Error ? error.message : '三维引擎初始化失败'
  }
}

onMounted(initializeViewer)

onBeforeUnmount(() => {
  constructionRun += 1
  eventHandler?.destroy()
  eventHandler = null
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
          @click="openBuilder"
        >
          {{ isGenerating ? '构建中…' : 'AI 建造' }}
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

      <section class="twin-scene panel-frame">
        <div
          ref="cesiumContainer"
          class="cesium-container"
          :class="{
            'is-picking': pickMode,
            'is-dragging-model': isDraggingModel,
          }"
        />
        <div v-if="pickMode" class="pick-mode-hint">
          <span>请在地图上点击确定建造位置</span>
          <button type="button" @click="cancelPointPicking">取消</button>
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
  <AiBuilderAssistant
    v-model:open="builderOpen"
    :point-ready="selectedPoint !== null"
    :point-label="selectedPoint?.label ?? ''"
    :picking="pickMode"
    :is-building="isGenerating"
    :build-progress="buildProgress"
    :build-message="engineStatus"
    :model-ready="buildState === 'ready' && generatedJob !== null"
    :model-scale="modelScale"
    :model-heading="modelHeading"
    @toggle-pick="togglePointPicking"
    @cancel-pick="cancelPointPicking"
    @build="buildFromPrompt"
    @update-scale="updateModelScale"
    @update-heading="updateModelHeading"
    @remove-model="removeGeneratedModel"
    @focus-model="focusGeneratedModel"
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
.cesium-container.is-picking {
  cursor: crosshair;
}
.cesium-container.is-dragging-model {
  cursor: grabbing;
}
.pick-mode-hint {
  position: absolute;
  z-index: 100;
  top: 12px;
  left: 50%;
  display: flex;
  align-items: center;
  min-width: 300px;
  padding: 8px 12px;
  gap: 12px;
  color: var(--amber);
  border: 1px solid rgba(240, 184, 92, 0.5);
  border-radius: 6px;
  background: rgba(5, 16, 17, 0.9);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  font-size: 10px;
  transform: translateX(-50%);
}
.pick-mode-hint span {
  flex: 1;
}
.pick-mode-hint button {
  min-height: 24px;
  padding: 0 10px;
  color: var(--text-soft);
  border: 1px solid var(--line);
  border-radius: 12px;
  background: transparent;
  font-size: 8px;
  cursor: pointer;
}
.scene-legend,
.simulation-pin {
  position: absolute;
  z-index: 100;
}

.scene-legend {
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(5, 16, 17, 0.86);
  backdrop-filter: blur(8px);
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
