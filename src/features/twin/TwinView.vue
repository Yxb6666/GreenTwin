<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import SceneToolbox, { type SceneMeasureType } from './SceneToolbox.vue'
import {
  clampModelScale,
  formatPointLabel,
  normalizeHeading,
  normalizePoint,
  toSimulationPlacement,
  type PickedPoint,
} from './modelPlacement'
import {
  calculateGeodesicArea,
  formatArea,
  formatDistance,
} from '@/gis/leaflet/measurement'
import {
  buildWgs84BoundsFilter,
  fetchIServerFeatures,
  type ParsedLayerFeature,
} from './iserverLayers'
import {
  createSimulationJob,
  waitForSimulationJob,
  type SimulationJob,
  type SimulationParameters,
  type SimulationPlacement,
} from './simulation'
import {
  createAgentJob,
  waitForAgentJob,
  type AgentJob,
} from './agentSimulation'
import {
  applyTreatmentScoreRules,
  offsetTreatmentLine,
  selectTreatmentRoad,
  type TreatmentMeasureKey,
} from './treatmentSimulation'

type ScenarioKey = 'waterlogging' | 'public-space' | 'irrigation' | 'ecology'
type PlanKey = 'current' | 'planA' | 'planB'
type MeasureKey = 'ditch' | 'outlet' | 'pump' | 'road'
type PointTreatmentKey = Extract<TreatmentMeasureKey, 'outlet' | 'pump'>

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
  setInputAction: (
    action: (movement: CesiumMovement) => void,
    type: number,
  ) => void
  destroy: () => void
}

interface CesiumColor {
  withAlpha: (alpha: number) => CesiumColor
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
    render?: () => void
    requestRender?: () => void
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
    positionCartographic?: { height: number }
    zoomIn: (amount: number) => void
    zoomOut: (amount: number) => void
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
    distance: (left: unknown, right: unknown) => number
  }
  Cartesian2: new (x: number, y: number) => unknown
  Color: {
    fromCssColorString: (color: string) => CesiumColor
  }
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
    LEFT_DOUBLE_CLICK: number
    RIGHT_CLICK: number
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
  HeadingPitchRoll: new (
    heading: number,
    pitch: number,
    roll: number,
  ) => unknown
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
const selectedMeasures = ref<TreatmentMeasureKey[]>([])
const buildProgress = ref(0)
const buildState = ref<'idle' | 'running' | 'ready' | 'error'>('idle')
const generatedJob = ref<SimulationJob | AgentJob | null>(null)
const constructionStage = ref(0)
const builderOpen = ref(false)
const pickMode = ref(false)
const isDraggingModel = ref(false)
const modelSelected = ref(false)
const modelScale = ref(1)
const modelHeading = ref(0)
const selectedPoint = ref<PickedPoint | null>(null)
const measurementMode = ref<SceneMeasureType | null>(null)
const treatmentPointMode = ref<PointTreatmentKey | null>(null)
const toolFeedback = ref('')
const measurePoints = ref<PickedPoint[]>([])
const outletPoints = ref<PickedPoint[]>([])
const pumpPoints = ref<PickedPoint[]>([])
const dataLayerEntities = ref<Record<string, unknown[]>>({})
const operationMessage = ref(
  '点击“AI 建造”，先在地图上选点，再输入提示词启动 Blender 建模',
)
const layerVisibility = ref({
  buildingLayer: false,
  roadLayer: true,
  waterLayer: true,
  issueLayer: false,
  poiLayer: false,
})
const parameters = ref({
  ditchWidth: 0.5,
  ditchDepth: 0.7,
  outletCount: 0,
  outletDiameter: 500,
  pumpCapacity: 1000,
  roadRaiseHeight: 0.25,
})

let viewer: SuperMapViewer | null = null
let generatedModel: ModelPrimitive | null = null
let constructionRun = 0
let markerEntity: unknown = null
let eventHandler: CesiumEventHandler | null = null
let suppressClickAfterDrag = false
let measurementEntities: unknown[] = []
let previewEntity: unknown = null
let feedbackTimer: number | undefined
let treatmentRoad: ParsedLayerFeature | null = null
let treatmentEntities: unknown[] = []

const constructionStages = [
  '场地准备',
  '基础施工',
  '主体搭建',
  '屋顶封顶',
  '装饰完成',
]

function inferBuildingStyle(
  instruction: string,
): NonNullable<SimulationParameters['buildingStyle']> {
  if (/古风|中式|传统|四合院|亭|庙|牌楼/.test(instruction))
    return 'traditional-chinese'
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
    description: '地图选点布置汇水节点',
  },
  {
    key: 'pump',
    icon: '泵',
    label: '配置临时泵站',
    description: '地图选点布置应急排水',
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
  { key: 'poiLayer', label: 'POI' },
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
const treatmentRuleParameters = computed(() => ({
  ...parameters.value,
  outletCount: outletPoints.value.length,
  pumpCount: pumpPoints.value.length,
}))
const currentPlan = computed(() => {
  const basePlan = planData[activePlan.value]
  const scoreRules = applyTreatmentScoreRules(
    basePlan.scores,
    planData.current.scores,
    selectedMeasures.value,
    treatmentRuleParameters.value,
  )
  return { ...basePlan, ...scoreRules }
})
const selectedMeasureLabels = computed(() =>
  measures
    .filter((measure) =>
      selectedMeasures.value.includes(measure.key as TreatmentMeasureKey),
    )
    .map((measure) => measure.label),
)
const appliedMeasureSummary = computed(() =>
  selectedMeasureLabels.value.length
    ? `参数联动估算 · 已应用${selectedMeasureLabels.value.join('、')}`
    : '规则估算 · 尚未启用治理措施',
)
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
    parameters: treatmentRuleParameters.value,
    visibleLayers: layers
      .filter((item) => layerVisibility.value[item.key])
      .map((item) => item.label),
    selectedMeasure: selectedMeasureLabels.value.join('、'),
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

function cesiumColor(color: string, alpha = 1) {
  const value = cesium().Color.fromCssColorString(color)
  return alpha < 1 ? value.withAlpha(alpha) : value
}

function selectScenario(key: ScenarioKey) {
  activeScenario.value = key
  operationMessage.value = `已切换至“${currentScenario.value.label}”模板，可从治理问题或地图范围创建模拟任务`
}

function selectPlan(key: PlanKey) {
  activePlan.value = key
  operationMessage.value = `当前查看：${planData[key].label}`
}

function isPointTreatment(key: MeasureKey): key is PointTreatmentKey {
  return key === 'outlet' || key === 'pump'
}

function getFacilityPoints(key: PointTreatmentKey) {
  return key === 'outlet' ? outletPoints.value : pumpPoints.value
}

function syncFacilityCounts() {
  parameters.value.outletCount = outletPoints.value.length
}

function beginTreatmentPointPlacement(key: PointTreatmentKey) {
  measurementMode.value = null
  pickMode.value = false
  treatmentPointMode.value = key
  operationMessage.value = `请在地图上点击布置${key === 'outlet' ? '排水口' : '临时泵站'}，可连续添加多个点位`
}

function finishTreatmentPointPlacement() {
  const key = treatmentPointMode.value
  treatmentPointMode.value = null
  if (!key) return
  operationMessage.value = `${key === 'outlet' ? '排水口' : '临时泵站'}布点完成，共 ${getFacilityPoints(key).length} 处，指标已按参数联动更新`
}

function clearFacilityPoints(key: PointTreatmentKey) {
  if (key === 'outlet') outletPoints.value = []
  else pumpPoints.value = []
  syncFacilityCounts()
  renderTreatmentMeasures()
  operationMessage.value = `已清空${key === 'outlet' ? '排水口' : '临时泵站'}点位`
}

function removeLastFacilityPoint(key: PointTreatmentKey) {
  const points = getFacilityPoints(key)
  if (!points.length) return
  points.pop()
  syncFacilityCounts()
  renderTreatmentMeasures()
  operationMessage.value = `已撤销最后一个${key === 'outlet' ? '排水口' : '临时泵站'}点位`
}

function selectMeasure(key: MeasureKey) {
  const measure = measures.find((item) => item.key === key)
  const enabled = selectedMeasures.value.includes(key)
  selectedMeasures.value = enabled
    ? selectedMeasures.value.filter((item) => item !== key)
    : [...selectedMeasures.value, key]
  if (isPointTreatment(key)) {
    if (enabled) {
      treatmentPointMode.value = null
      clearFacilityPoints(key)
    } else beginTreatmentPointPlacement(key)
  }
  renderTreatmentMeasures()
  if (!enabled && !isPointTreatment(key)) focusTreatmentRoad()
  operationMessage.value = enabled
    ? `已取消${measure?.label ?? ''}，三生指标已恢复`
    : isPointTreatment(key)
      ? `已启用${measure?.label ?? ''}，请在地图上点击添加设施点位`
      : `已启用${measure?.label ?? ''}，场景与三生指标已按规则更新`
}

function isMeasureSelected(key: MeasureKey) {
  return selectedMeasures.value.includes(key as TreatmentMeasureKey)
}

function isMeasureSupported(key: MeasureKey) {
  return measures.some((measure) => measure.key === key)
}

function measureDescription(key: MeasureKey, fallback: string) {
  if (key === 'outlet')
    return `已布置 ${outletPoints.value.length} 处 · 点击后地图选点`
  if (key === 'pump')
    return `已布置 ${pumpPoints.value.length} 处 · 点击后地图选点`
  return fallback
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
  if (focus)
    viewer.camera.flyTo({
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

async function playConstruction(
  job: Pick<SimulationJob, 'modelUrl' | 'stageUrls' | 'placement'>,
) {
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
  treatmentPointMode.value = null
  pickMode.value = true
  operationMessage.value =
    '点击地图确定建造位置；再次点击“AI 建造”面板中的按钮可取消'
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

function handleTreatmentPointClick(position: { x: number; y: number }) {
  const key = treatmentPointMode.value
  if (!key) return
  const point = pickGroundPoint(position)
  if (!point) {
    operationMessage.value = '未拾取到地图表面，请点击有地形或底图的位置'
    return
  }
  getFacilityPoints(key).push(point)
  syncFacilityCounts()
  renderTreatmentMeasures()
  const count = getFacilityPoints(key).length
  const label = key === 'outlet' ? '排水口' : '临时泵站'
  operationMessage.value = `已添加第 ${count} 处${label}，可继续点击布点或点击“完成布点”`
  notifyScene(`${label} ${count} 已添加，右侧指标已更新`)
}

function selectModel() {
  if (!generatedModel) return
  modelSelected.value = true
  if (selectedPoint.value) upsertMarker(selectedPoint.value)
  operationMessage.value =
    '模型已选中，可在地图上拖拽移动，或用面板滑杆缩放和旋转'
}

function startModelDrag(movement: CesiumMovement) {
  if (!viewer || pickMode.value || measurementMode.value || !movement.position)
    return
  const picked = viewer.scene.pick(movement.position) as {
    primitive?: unknown
    id?: unknown
  }
  const hitModel =
    picked &&
    (picked.primitive === generatedModel || picked.id === generatedModel)
  if (!hitModel) return
  isDraggingModel.value = true
  suppressClickAfterDrag = true
  modelSelected.value = true
}

function moveModelDrag(movement: CesiumMovement) {
  if (!movement.endPosition) return
  if (measurementMode.value) {
    if (measurePoints.value.length > 0) {
      const cursor = pickGroundPoint(movement.endPosition)
      if (cursor) drawMeasurePolyline(cursor)
    }
    return
  }
  if (!isDraggingModel.value) return
  const point = pickGroundPoint(movement.endPosition)
  if (!point) return
  selectedPoint.value = point
  upsertMarker(point)
  applyModelTransform()
}

function endModelDrag() {
  isDraggingModel.value = false
}

function notifyScene(message: string) {
  toolFeedback.value = message
  window.clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => (toolFeedback.value = ''), 2400)
}

function clearMeasurementOverlays() {
  if (!viewer) return
  for (const entity of measurementEntities) viewer.entities.remove(entity)
  if (previewEntity) viewer.entities.remove(previewEntity)
  measurementEntities = []
  previewEntity = null
  measurePoints.value = []
}

function startMeasurement(type: SceneMeasureType) {
  if (!viewer) {
    notifyScene('三维场景仍在初始化，请稍后再试')
    return
  }
  clearMeasurementOverlays()
  measurementMode.value = type
  pickMode.value = false
  treatmentPointMode.value = null
  notifyScene(
    type === 'distance'
      ? '单击依次取点，双击或右键完成距离测量'
      : '单击绘制范围，双击或右键完成面积测量',
  )
}

function cancelMeasurement() {
  measurementMode.value = null
  clearMeasurementOverlays()
}

function addMeasurePoint(position: { x: number; y: number }) {
  if (!viewer) return
  const point = pickGroundPoint(position)
  if (!point) return
  const sdk = cesium()
  const cartesian = sdk.Cartesian3.fromDegrees(
    point.longitude,
    point.latitude,
    point.height + 1,
  )
  measurePoints.value.push(point)
  const entity = viewer.entities.add({
    position: cartesian,
    point: {
      pixelSize: 7,
      color: '#54e1ce',
      outlineColor: '#eafffb',
      outlineWidth: 1.5,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
  measurementEntities.push(entity)
  drawMeasurePolyline()
}

function drawMeasurePolyline(cursor?: PickedPoint) {
  if (!viewer) return
  const sdk = cesium()
  if (previewEntity) viewer.entities.remove(previewEntity)
  previewEntity = null
  if (measurePoints.value.length < 2) return
  const positions = measurePoints.value.map((point) =>
    sdk.Cartesian3.fromDegrees(
      point.longitude,
      point.latitude,
      point.height + 1,
    ),
  )
  if (cursor)
    positions.push(
      sdk.Cartesian3.fromDegrees(
        cursor.longitude,
        cursor.latitude,
        cursor.height + 1,
      ),
    )
  previewEntity = viewer.entities.add({
    polyline: {
      positions,
      width: 2,
      material: '#54e1ce',
      clampToGround: false,
    },
  })
  measurementEntities.push(previewEntity)
}

function finishMeasurement() {
  const type = measurementMode.value
  if (!type || !viewer) return
  const sdk = cesium()
  if (previewEntity) viewer.entities.remove(previewEntity)
  previewEntity = null
  let message = ''
  if (type === 'distance' && measurePoints.value.length >= 2) {
    let total = 0
    for (let index = 1; index < measurePoints.value.length; index += 1) {
      const current = measurePoints.value[index]!
      const previous = measurePoints.value[index - 1]!
      total += sdk.Cartesian3.distance(
        sdk.Cartesian3.fromDegrees(
          current.longitude,
          current.latitude,
          current.height,
        ),
        sdk.Cartesian3.fromDegrees(
          previous.longitude,
          previous.latitude,
          previous.height,
        ),
      )
    }
    message = `距离测量完成：${formatDistance(total)}`
  } else if (type === 'area' && measurePoints.value.length >= 3) {
    const area = calculateGeodesicArea(
      measurePoints.value.map((point) => ({
        lat: point.latitude,
        lng: point.longitude,
      })),
    )
    message = `面积测量完成：${formatArea(area)}`
  } else {
    message =
      type === 'distance' ? '距离测量至少需要两个点' : '面积测量至少需要三个点'
    clearMeasurementOverlays()
    measurementMode.value = null
    notifyScene(message)
    return
  }
  const last = measurePoints.value.at(-1)!
  const labelEntity = viewer.entities.add({
    position: sdk.Cartesian3.fromDegrees(
      last.longitude,
      last.latitude,
      last.height + 4,
    ),
    label: {
      text: message.replace('测量完成：', ''),
      font: '12px sans-serif',
      fillColor: '#eafffb',
      showBackground: true,
      backgroundColor: '#051011',
      backgroundPadding: { x: 7, y: 4 },
      pixelOffset: new sdk.Cartesian2(0, -22),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
  measurementEntities.push(labelEntity)
  measurementMode.value = null
  notifyScene(message)
}

function clearSceneDrawings() {
  measurementMode.value = null
  clearMeasurementOverlays()
  notifyScene('标绘与测量结果已清除')
}

function refreshScene() {
  if (!viewer) {
    notifyScene('三维场景仍在初始化，请稍后再试')
    return
  }
  viewer.scene.requestRender?.()
  notifyScene('三维场景渲染已刷新')
}

function exportScene() {
  if (!viewer) {
    notifyScene('三维场景仍在初始化，请稍后再试')
    return
  }
  try {
    const canvas = viewer.scene.canvas as HTMLCanvasElement
    viewer.scene.render?.()
    const dataUrl = canvas.toDataURL('image/png')
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = `三生模拟场景-${new Date().toISOString().slice(0, 10)}.png`
    anchor.click()
    notifyScene('当前三维场景已导出为 PNG')
  } catch {
    notifyScene('三维场景导出失败，请重试')
  }
}

function zoomScene(direction: 1 | -1) {
  if (!viewer) {
    notifyScene('三维场景仍在初始化，请稍后再试')
    return
  }
  const height = viewer.camera.positionCartographic?.height ?? 1000
  const delta = Math.max(180, height * 0.35)
  if (direction > 0) viewer.camera.zoomIn(delta)
  else viewer.camera.zoomOut(delta)
}

function locateScene() {
  if (!viewer) {
    notifyScene('三维场景仍在初始化，请稍后再试')
    return
  }
  const sdk = cesium()
  const point = selectedPoint.value
  if (point) {
    viewer.camera.flyTo({
      destination: sdk.Cartesian3.fromDegrees(
        point.longitude,
        point.latitude - 0.00012,
        Math.max(120, point.height + 55),
      ),
      orientation: {
        heading: 0,
        pitch: sdk.Math.toRadians(-52),
        roll: 0,
      },
    })
    return
  }
  viewer.camera.flyTo({
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
}

function updateSceneLayer(key: string, visible: boolean) {
  const layerKey = key as keyof typeof layerVisibility.value
  layerVisibility.value[layerKey] = visible
  toggleLayer(layerKey)
}

function createPoiEntities(features: ParsedLayerFeature[]) {
  if (!viewer) return []
  const sdk = cesium()
  const entities: unknown[] = []
  const labelCap = 400
  features.forEach((feature, index) => {
    const point = feature.points[0]
    if (!point) return
    entities.push(
      viewer!.entities.add({
        position: sdk.Cartesian3.fromDegrees(
          point.longitude,
          point.latitude,
          0,
        ),
        point: {
          pixelSize: 7,
          color: cesiumColor('#f0b85c'),
          outlineColor: cesiumColor('#04201d'),
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        ...(index < labelCap && feature.name
          ? {
              label: {
                text: feature.name,
                font: '10px sans-serif',
                fillColor: cesiumColor('#eafffb'),
                showBackground: true,
                backgroundColor: cesiumColor('#051011', 0.9),
                backgroundPadding: { x: 5, y: 3 },
                pixelOffset: new sdk.Cartesian2(0, -16),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
            }
          : {}),
        show: layerVisibility.value.poiLayer,
      }),
    )
  })
  return entities
}

function createLineEntities(
  features: ParsedLayerFeature[],
  color: string,
  width: number,
  layerKey: 'roadLayer' | 'waterLayer',
) {
  if (!viewer) return []
  const sdk = cesium()
  return features.flatMap((feature) => {
    if (feature.points.length < 2) return []
    const positions = feature.points.map((point) =>
      sdk.Cartesian3.fromDegrees(point.longitude, point.latitude, 0),
    )
    return [
      viewer!.entities.add({
        polyline: {
          positions,
          width,
          material: cesiumColor(color),
          clampToGround: true,
        },
        show: layerVisibility.value[layerKey],
      }),
    ]
  })
}

function clearTreatmentEntities() {
  if (!viewer) return
  for (const entity of treatmentEntities) viewer.entities.remove(entity)
  treatmentEntities = []
}

function treatmentPositions(
  points: ParsedLayerFeature['points'],
  height = 0.6,
) {
  const sdk = cesium()
  return points.map((point) =>
    sdk.Cartesian3.fromDegrees(point.longitude, point.latitude, height),
  )
}

function addTreatmentLine(
  points: ParsedLayerFeature['points'],
  width: number,
  material: unknown,
  height = 0.6,
  clampToGround = true,
) {
  if (!viewer || points.length < 2) return
  treatmentEntities.push(
    viewer.entities.add({
      polyline: {
        positions: treatmentPositions(points, height),
        width,
        material,
        clampToGround,
      },
    }),
  )
}

function addTreatmentCorridor(
  points: ParsedLayerFeature['points'],
  width: number,
  height: number,
  extrudedHeight: number,
  material: unknown,
  outlineColor: unknown,
) {
  if (!viewer || points.length < 2) return
  treatmentEntities.push(
    viewer.entities.add({
      corridor: {
        positions: treatmentPositions(points, height),
        width,
        height,
        extrudedHeight,
        material,
        outline: true,
        outlineColor,
      },
    }),
  )
}

function addTreatmentWall(
  points: ParsedLayerFeature['points'],
  maximumHeight: number,
  minimumHeight: number,
  material: unknown,
  outlineColor: unknown,
) {
  if (!viewer || points.length < 2) return
  treatmentEntities.push(
    viewer.entities.add({
      wall: {
        positions: treatmentPositions(points, minimumHeight),
        maximumHeights: points.map(() => maximumHeight),
        minimumHeights: points.map(() => minimumHeight),
        material,
        outline: true,
        outlineColor,
      },
    }),
  )
}

function addTreatmentLabel(
  point: ParsedLayerFeature['points'][number],
  text: string,
  color: unknown,
  pixelOffsetY: number,
  height = 6,
) {
  if (!viewer) return
  const sdk = cesium()
  treatmentEntities.push(
    viewer.entities.add({
      position: sdk.Cartesian3.fromDegrees(
        point.longitude,
        point.latitude,
        height,
      ),
      label: {
        text,
        font: '600 12px sans-serif',
        fillColor: color,
        showBackground: true,
        backgroundColor: cesiumColor('#041714', 0.92),
        backgroundPadding: { x: 8, y: 5 },
        pixelOffset: new sdk.Cartesian2(0, pixelOffsetY),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    }),
  )
}

function addFacilityPoint(
  point: PickedPoint,
  index: number,
  key: PointTreatmentKey,
) {
  if (!viewer) return
  const sdk = cesium()
  const isOutlet = key === 'outlet'
  const color = cesiumColor(isOutlet ? '#38bdf8' : '#f0b85c')
  const radius = isOutlet
    ? 8 + parameters.value.outletDiameter / 100
    : 55 + parameters.value.pumpCapacity / 25
  const label = isOutlet
    ? `排水口 ${index + 1} · DN${parameters.value.outletDiameter}`
    : `临时泵站 ${index + 1} · ${parameters.value.pumpCapacity} m³/h`
  treatmentEntities.push(
    viewer.entities.add({
      position: sdk.Cartesian3.fromDegrees(point.longitude, point.latitude, 2),
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        material: cesiumColor(
          isOutlet ? '#38bdf8' : '#f0b85c',
          isOutlet ? 0.3 : 0.16,
        ),
        outline: true,
        outlineColor: color,
        height: 0.5,
      },
      point: {
        pixelSize: isOutlet ? 13 : 16,
        color,
        outlineColor: cesiumColor('#041714'),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: label,
        font: '600 12px sans-serif',
        fillColor: cesiumColor(isOutlet ? '#9ee8ff' : '#ffd48b'),
        showBackground: true,
        backgroundColor: cesiumColor('#041714', 0.92),
        backgroundPadding: { x: 8, y: 5 },
        pixelOffset: new sdk.Cartesian2(0, index % 2 === 0 ? -28 : 28),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    }),
  )
}

function renderTreatmentMeasures() {
  clearTreatmentEntities()
  if (!viewer || selectedMeasures.value.length === 0) {
    viewer?.scene.requestRender?.()
    return
  }
  if (treatmentRoad) {
    const points = treatmentRoad.points
    const roadLabelPoint =
      points[Math.min(points.length - 1, Math.floor(points.length * 0.38))]
    if (selectedMeasures.value.includes('road') && roadLabelPoint) {
      const roadBaseHeight = 0.8
      const roadVisualScale = 8
      const roadTopHeight =
        roadBaseHeight + parameters.value.roadRaiseHeight * roadVisualScale
      addTreatmentCorridor(
        points,
        10,
        roadTopHeight,
        roadBaseHeight,
        cesiumColor('#f0b85c'),
        cesiumColor('#ffd48b'),
      )
      addTreatmentLine(
        points,
        2.5,
        cesiumColor('#fff0c9'),
        roadTopHeight + 0.08,
        false,
      )
      addTreatmentLabel(
        roadLabelPoint,
        `局部抬升路面 +${parameters.value.roadRaiseHeight.toFixed(2)} m`,
        cesiumColor('#ffd48b'),
        -38,
        roadTopHeight + 5,
      )
    }
    if (selectedMeasures.value.includes('ditch')) {
      const ditchPoints = offsetTreatmentLine(points, 8)
      const ditchVisualWidth = Math.max(5, parameters.value.ditchWidth * 10)
      const ditchHalfWidth = ditchVisualWidth / 2
      const ditchLeftEdge = offsetTreatmentLine(ditchPoints, ditchHalfWidth)
      const ditchRightEdge = offsetTreatmentLine(ditchPoints, -ditchHalfWidth)
      const ditchBottomHeight = 0.75
      const ditchVisualScale = 5
      const ditchRimHeight =
        ditchBottomHeight + parameters.value.ditchDepth * ditchVisualScale
      addTreatmentCorridor(
        ditchPoints,
        ditchVisualWidth * 0.55,
        ditchBottomHeight + 0.12,
        ditchBottomHeight,
        cesiumColor('#075d61', 0.94),
        cesiumColor('#12e1d3'),
      )
      addTreatmentWall(
        ditchLeftEdge,
        ditchRimHeight,
        ditchBottomHeight,
        cesiumColor('#12e1d3', 0.42),
        cesiumColor('#7cfff2'),
      )
      addTreatmentWall(
        ditchRightEdge,
        ditchRimHeight,
        ditchBottomHeight,
        cesiumColor('#12e1d3', 0.42),
        cesiumColor('#7cfff2'),
      )
      addTreatmentLine(
        ditchLeftEdge,
        2.5,
        cesiumColor('#12e1d3'),
        ditchRimHeight + 0.05,
        false,
      )
      addTreatmentLine(
        ditchRightEdge,
        2.5,
        cesiumColor('#12e1d3'),
        ditchRimHeight + 0.05,
        false,
      )
      const ditchLabelPoint =
        ditchPoints[
          Math.min(
            ditchPoints.length - 1,
            Math.floor(ditchPoints.length * 0.64),
          )
        ]
      if (ditchLabelPoint) {
        addTreatmentLabel(
          ditchLabelPoint,
          `增设排水沟 ${parameters.value.ditchWidth.toFixed(1)}×${parameters.value.ditchDepth.toFixed(1)} m`,
          cesiumColor('#7cfff2'),
          18,
          ditchRimHeight + 4,
        )
      }
    }
  }
  if (selectedMeasures.value.includes('outlet'))
    outletPoints.value.forEach((point, index) =>
      addFacilityPoint(point, index, 'outlet'),
    )
  if (selectedMeasures.value.includes('pump'))
    pumpPoints.value.forEach((point, index) =>
      addFacilityPoint(point, index, 'pump'),
    )
  viewer.scene.requestRender?.()
}

function focusTreatmentRoad() {
  if (!viewer || !treatmentRoad) return
  const point =
    treatmentRoad.points[Math.floor(treatmentRoad.points.length / 2)]
  if (!point) return
  const sdk = cesium()
  viewer.camera.flyTo({
    destination: sdk.Cartesian3.fromDegrees(
      point.longitude,
      point.latitude - 0.0018,
      420,
    ),
    orientation: {
      heading: 0,
      pitch: sdk.Math.toRadians(-52),
      roll: 0,
    },
  })
}

watch(
  [
    () => parameters.value.ditchWidth,
    () => parameters.value.ditchDepth,
    () => parameters.value.outletDiameter,
    () => parameters.value.pumpCapacity,
    () => parameters.value.roadRaiseHeight,
  ],
  renderTreatmentMeasures,
)

function createPolygonEntities(features: ParsedLayerFeature[]) {
  if (!viewer) return []
  const sdk = cesium()
  return features.flatMap((feature) => {
    if (feature.points.length < 3) return []
    const positions = feature.points.map((point) =>
      sdk.Cartesian3.fromDegrees(point.longitude, point.latitude, 0),
    )
    return [
      viewer!.entities.add({
        polygon: {
          hierarchy: positions,
          material: cesiumColor('#3aa8ff', 0.28),
          outline: true,
          outlineColor: cesiumColor('#3aa8ff'),
          clampToGround: true,
        },
        show: layerVisibility.value.waterLayer,
      }),
    ]
  })
}

async function loadDataLayers() {
  if (!viewer) return
  engineStatus.value = '正在加载水系、路网与 POI 数据图层'
  try {
    const [poiFeatures, roadFeatures, waterLines, waterPolygons] =
      await Promise.all([
        fetchIServerFeatures(
          {
            serviceUrl: config.supermap.mapServices.poi,
            mapName: 'Lankao_POI_2025',
            datasetName: 'Lankao_POI_2025',
          },
          {
            attributeFilter: buildWgs84BoundsFilter(114.9, 34.9, 115.03, 35.0),
          },
        ),
        fetchIServerFeatures({
          serviceUrl: config.supermap.mapServices.roadNetwork,
          mapName: 'Lankao_Road_Network',
          datasetName: 'Lankao_Road_Network',
        }),
        fetchIServerFeatures({
          serviceUrl: config.supermap.mapServices.water,
          mapName: 'Lankao_Water',
          datasetName: 'Laokao_Water_Line',
        }),
        fetchIServerFeatures({
          serviceUrl: config.supermap.mapServices.water,
          mapName: 'Lankao_Water',
          datasetName: 'Laokao_Water_Polygon',
        }),
      ])
    dataLayerEntities.value = {
      poiLayer: createPoiEntities(poiFeatures),
      roadLayer: createLineEntities(roadFeatures, '#e8b95c', 1.6, 'roadLayer'),
      waterLayer: [
        ...createLineEntities(waterLines, '#3aa8ff', 1.6, 'waterLayer'),
        ...createPolygonEntities(waterPolygons),
      ],
    }
    treatmentRoad = selectTreatmentRoad(roadFeatures, simulationFocus)
    renderTreatmentMeasures()
    engineStatus.value = `数据图层已加载：POI ${poiFeatures.length} · 路网 ${roadFeatures.length} · 水系 ${waterLines.length + waterPolygons.length}`
    notifyScene('水系、路网与 POI 数据图层已加载，可在图层菜单中切换')
  } catch (error) {
    engineStatus.value = '水系、路网或 POI 数据图层加载失败'
    notifyScene(error instanceof Error ? error.message : '数据图层加载失败')
    console.error('数据图层加载失败', error)
  }
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
    if (measurementMode.value) {
      addMeasurePoint(movement.position)
      return
    }
    if (treatmentPointMode.value) {
      handleTreatmentPointClick(movement.position)
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
      picked &&
      (picked.primitive === generatedModel || picked.id === generatedModel)
    if (hitModel) selectModel()
    else if (!isDraggingModel.value && selectedPoint.value) {
      modelSelected.value = false
      upsertMarker(selectedPoint.value)
    }
  }, sdk.ScreenSpaceEventType.LEFT_CLICK)
  eventHandler.setInputAction(
    startModelDrag,
    sdk.ScreenSpaceEventType.LEFT_DOWN,
  )
  eventHandler.setInputAction(
    moveModelDrag,
    sdk.ScreenSpaceEventType.MOUSE_MOVE,
  )
  eventHandler.setInputAction(endModelDrag, sdk.ScreenSpaceEventType.LEFT_UP)
  eventHandler.setInputAction(() => {
    if (measurementMode.value) finishMeasurement()
  }, sdk.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  eventHandler.setInputAction(() => {
    if (measurementMode.value) finishMeasurement()
  }, sdk.ScreenSpaceEventType.RIGHT_CLICK)
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

async function buildWithAgent(prompt: string) {
  const point = selectedPoint.value
  if (!point || !prompt.trim() || isGenerating.value) return
  constructionStage.value = 0
  buildState.value = 'running'
  buildProgress.value = 5
  generatedJob.value = null
  modelSelected.value = false
  engineStatus.value = '正在调用 3D Agent 生成 Blender 脚本'
  operationMessage.value = `3D Agent 将根据提示词在 ${point.label} 生成更精细的模型`
  try {
    const initialJob = await createAgentJob(config.apiBaseUrl, {
      prompt,
      placement: toSimulationPlacement(point),
      buildingStyle: inferBuildingStyle(prompt),
    })
    const completedJob = await waitForAgentJob(config.apiBaseUrl, initialJob, {
      timeoutMs: config.reportTimeoutMs,
      onProgress: (job) => {
        buildProgress.value = job.progress
        engineStatus.value = job.message
      },
    })
    await playConstruction(completedJob)
    generatedJob.value = completedJob
    buildState.value = 'ready'
    buildProgress.value = 100
    modelSelected.value = true
    engineStatus.value = `${completedJob.placement.label} · 3D Agent GLB 已加载`
    operationMessage.value =
      '3D Agent 已完成智能建模；点击模型可选中，拖拽移动，或用面板滑杆缩放和旋转'
  } catch (error) {
    buildState.value = 'error'
    engineStatus.value =
      error instanceof Error ? error.message : '3D Agent 建模失败'
    operationMessage.value =
      '可切换为“模板生成”模式，或检查 DeepSeek API Key 与本机 Blender 路径'
  }
}

const roofLabels: Record<string, string> = {
  hipped: '歇山顶',
  pyramidal: '攒尖顶',
  gable: '双坡顶',
  flat: '平屋顶',
}

const buildSummary = computed(() => {
  const building = generatedJob.value?.parameters?.building
  if (!building) return ''
  const parts: string[] = []
  if (building.typeLabel) parts.push(String(building.typeLabel))
  if (building.floors) parts.push(`${Number(building.floors)} 层`)
  if (building.roof) parts.push(roofLabels[String(building.roof)] ?? '')
  if (building.columns) parts.push('柱廊')
  if (building.railings) parts.push('围栏')
  if (building.steps) parts.push('台阶')
  if (building.courtyard) parts.push('庭院')
  if (building.plaque) parts.push('牌匾')
  if (building.lanterns) parts.push('灯笼')
  if (building.dougong) parts.push('斗拱')
  if (building.balcony) parts.push('阳台')
  if (building.ornamentLevel === 3) parts.push('高精细')
  else if (building.ornamentLevel === 1) parts.push('简洁')
  return parts.filter(Boolean).join(' · ')
})

const sceneLayers = computed(() =>
  layers.map((item) => ({
    key: item.key,
    label: item.label,
    visible: layerVisibility.value[item.key],
  })),
)

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
  const entities = dataLayerEntities.value[key]
  if (entities) {
    for (const entity of entities) {
      ;(entity as { show?: boolean }).show = layerVisibility.value[key]
    }
  }
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
      preserveDrawingBuffer: true,
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
    void loadDataLayers()
    engineStatus.value = 'ArcGIS 导航底图 · SuperMap 兼容模式'
  } catch (error) {
    engineStatus.value =
      error instanceof Error ? error.message : '三维引擎初始化失败'
  }
}

function onWindowKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  cancelMeasurement()
  finishTreatmentPointPlacement()
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeyDown)
  void initializeViewer()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeyDown)
  constructionRun += 1
  eventHandler?.destroy()
  eventHandler = null
  cancelMeasurement()
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

        <PanelCard
          class="treatment-card"
          title="治理措施"
          meta="参数化场景构建"
        >
          <div class="measure-list">
            <button
              v-for="measure in measures"
              :key="measure.key"
              type="button"
              :class="{
                active: isMeasureSelected(measure.key),
                unavailable: !isMeasureSupported(measure.key),
              }"
              :aria-pressed="isMeasureSelected(measure.key)"
              :disabled="!isMeasureSupported(measure.key)"
              @click="selectMeasure(measure.key)"
            >
              <i>{{ measure.icon }}</i>
              <span
                ><strong>{{ measure.label }}</strong
                ><small>{{
                  isMeasureSupported(measure.key)
                    ? measureDescription(measure.key, measure.description)
                    : '待接入场景演示'
                }}</small></span
              >
            </button>
          </div>

          <div
            v-if="selectedMeasures.length"
            class="parameter-panel scroll-region"
          >
            <label v-if="selectedMeasures.includes('ditch')">
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
            <label v-if="selectedMeasures.includes('ditch')">
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
            <label v-if="selectedMeasures.includes('outlet')">
              <span
                >排水口管径
                <strong>DN{{ parameters.outletDiameter }}</strong></span
              >
              <input
                v-model.number="parameters.outletDiameter"
                type="range"
                min="300"
                max="800"
                step="100"
              />
            </label>
            <div
              v-if="selectedMeasures.includes('outlet')"
              class="facility-actions"
            >
              <span>排水口 {{ outletPoints.length }} 处</span>
              <button
                type="button"
                @click="beginTreatmentPointPlacement('outlet')"
              >
                继续布点
              </button>
              <button
                type="button"
                :disabled="!outletPoints.length"
                @click="removeLastFacilityPoint('outlet')"
              >
                撤销末点
              </button>
              <button
                type="button"
                :disabled="!outletPoints.length"
                @click="clearFacilityPoints('outlet')"
              >
                清空
              </button>
            </div>
            <label v-if="selectedMeasures.includes('pump')">
              <span
                >单站排水能力
                <strong>{{ parameters.pumpCapacity }} m³/h</strong></span
              >
              <input
                v-model.number="parameters.pumpCapacity"
                type="range"
                min="500"
                max="3000"
                step="250"
              />
            </label>
            <div
              v-if="selectedMeasures.includes('pump')"
              class="facility-actions"
            >
              <span>临时泵站 {{ pumpPoints.length }} 处</span>
              <button
                type="button"
                @click="beginTreatmentPointPlacement('pump')"
              >
                继续布点
              </button>
              <button
                type="button"
                :disabled="!pumpPoints.length"
                @click="removeLastFacilityPoint('pump')"
              >
                撤销末点
              </button>
              <button
                type="button"
                :disabled="!pumpPoints.length"
                @click="clearFacilityPoints('pump')"
              >
                清空
              </button>
            </div>
            <label v-if="selectedMeasures.includes('road')">
              <span
                >道路抬升高度
                <strong
                  >{{ parameters.roadRaiseHeight.toFixed(2) }} m</strong
                ></span
              >
              <input
                v-model.number="parameters.roadRaiseHeight"
                type="range"
                min="0.1"
                max="0.6"
                step="0.05"
              />
            </label>
          </div>
          <div v-else class="treatment-empty">
            选择线性措施可沿道路展示，选择排水口或泵站后可在地图上布点
          </div>

          <div class="treatment-footer">
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
            <p v-if="selectedMeasures.includes('ditch') || selectedMeasures.includes('road')">
              场景高度已做视觉增强，仅作方案示意；参数与指标仍按实际数值展示。
            </p>
          </div>
        </PanelCard>
      </aside>

      <section class="twin-scene panel-frame">
        <div
          ref="cesiumContainer"
          class="cesium-container"
          :class="{
            'is-picking': pickMode || treatmentPointMode,
            'is-dragging-model': isDraggingModel,
          }"
        />
        <div v-if="pickMode" class="pick-mode-hint">
          <span>请在地图上点击确定建造位置</span>
          <button type="button" @click="cancelPointPicking">取消</button>
        </div>
        <div
          v-if="treatmentPointMode"
          class="pick-mode-hint treatment-pick-hint"
        >
          <span>
            点击地图布置{{
              treatmentPointMode === 'outlet' ? '排水口' : '临时泵站'
            }}
            · 已选
            {{
              treatmentPointMode === 'outlet'
                ? outletPoints.length
                : pumpPoints.length
            }}
            处
          </span>
          <button type="button" @click="finishTreatmentPointPlacement">
            完成布点
          </button>
        </div>
        <SceneToolbox
          :measuring="measurementMode"
          :layers="sceneLayers"
          :feedback="toolFeedback"
          @clear="clearSceneDrawings"
          @measure="startMeasurement"
          @end-measure="cancelMeasurement"
          @refresh="refreshScene"
          @export="exportScene"
          @zoom-in="zoomScene(1)"
          @zoom-out="zoomScene(-1)"
          @locate="locateScene"
          @update-layer="updateSceneLayer"
        />
      </section>

      <aside class="twin-right">
        <PanelCard title="三生影响评估" meta="参数联动估算">
          <div class="impact-layout">
            <RadarChart
              :labels="['生产保障', '生活改善', '生态安全']"
              :values="currentPlan.scores"
              :color="activePlan === 'planB' ? '#f0b85c' : '#3dd6c4'"
            />
            <div class="impact-score">
              <span>{{ currentPlan.label }}</span>
              <strong>{{ currentPlan.composite }}</strong>
              <small>{{ appliedMeasureSummary }}</small>
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
    :build-summary="buildSummary"
    @toggle-pick="togglePointPicking"
    @cancel-pick="cancelPointPicking"
    @build="buildFromPrompt"
    @build-agent="buildWithAgent"
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

.measure-list button.unavailable {
  opacity: 0.46;
  cursor: not-allowed;
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

.treatment-card :deep(.panel-card__body) {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.parameter-panel {
  display: grid;
  min-height: 0;
  margin-top: 9px;
  padding-top: 8px;
  padding-right: 2px;
  overflow-y: auto;
  align-content: start;
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

.facility-actions {
  display: grid;
  align-items: center;
  gap: 4px;
  grid-template-columns: minmax(74px, 1fr) repeat(3, auto);
}
.facility-actions span {
  color: var(--text-soft);
  font-size: 8px;
}
.facility-actions button {
  min-height: 22px;
  padding: 0 6px;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.28);
  border-radius: 4px;
  background: rgba(61, 214, 196, 0.06);
  font-size: 7px;
  cursor: pointer;
}
.facility-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.treatment-empty {
  margin-top: 10px;
  padding: 10px;
  color: var(--text-soft);
  font-size: 8px;
  line-height: 1.55;
  text-align: center;
  border: 1px dashed rgba(122, 203, 190, 0.2);
  background: rgba(61, 214, 196, 0.025);
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
.treatment-footer p {
  margin: 6px 0 0;
  color: rgba(185, 211, 203, 0.62);
  font-size: 7px;
  line-height: 1.4;
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
.treatment-pick-hint {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.52);
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
