<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import DecisionAssistant from '@/shared/assistant/DecisionAssistant.vue'
import type { DecisionAssistantContext } from '@/shared/assistant/assistant'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { loadSuperMapWebgl } from '@/gis/supermap3d/loadSdk'
import { buildArcGisTileUrl } from '@/gis/leaflet/baseMaps'
import AiBuilderAssistant, {
  type AiBuilderStyle,
} from './AiBuilderAssistant.vue'
import SceneToolbox, {
  type SceneMeasureType,
} from './SceneToolbox.vue'
import WeatherSimulation from './WeatherSimulation.vue'
import TwinPlotPreview from './TwinPlotPreview.vue'
import {
  createWeatherState,
  describeWeatherRisk,
  resolveWeatherMetrics,
  type WeatherState,
} from './weatherSimulation'
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
  requestIsochrones,
  resolveIsochroneRenderStyle,
  type IsochroneGeometry,
  type IsochroneProfile,
} from './isochrone'

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

interface WeatherPostProcessStage {
  uniforms: Record<string, number>
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
    canvas: HTMLCanvasElement
    globe: {
      depthTestAgainstTerrain: boolean
      enableLighting: boolean
      show: boolean
      pick: (ray: unknown, scene: SuperMapViewer['scene']) => unknown
    }
    shadowMap?: {
      enabled: boolean
      softShadows: boolean
    }
    layers?: { find?: (name: string) => SceneLayer | undefined }
    primitives: {
      add: (primitive: ModelPrimitive) => ModelPrimitive
      remove: (primitive: ModelPrimitive) => boolean
    }
    postProcessStages?: {
      add: (stage: WeatherPostProcessStage) => WeatherPostProcessStage
      remove: (stage: WeatherPostProcessStage) => boolean
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
  clock?: { currentTime: unknown }
  shadows?: boolean
  destroy: () => void
  isDestroyed?: () => boolean
}

interface CesiumRuntime {
  Viewer: new (
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => SuperMapViewer
  Cartesian3: (new () => unknown) & {
    fromDegrees: (
      longitude: number,
      latitude: number,
      height: number,
    ) => unknown
    distance: (left: unknown, right: unknown) => number
    normalize: (cartesian: unknown, result: unknown) => unknown
    subtract: (left: unknown, right: unknown, result: unknown) => unknown
    fromDegreesArray: (coordinates: number[]) => unknown
  }
  Cartesian2: new (x: number, y: number) => unknown
  Color: new (
    red?: number,
    green?: number,
    blue?: number,
    alpha?: number,
  ) => unknown
  ColorMaterialProperty: new (color?: unknown) => unknown
  Cartographic: {
    fromCartesian: (cartesian: unknown) => {
      longitude: number
      latitude: number
      height: number
    }
  }
  ScreenSpaceEventHandler: new (canvas?: HTMLElement) => CesiumEventHandler
  JulianDate?: { fromDate: (date: Date) => unknown }
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
      shadows?: unknown
    }) => ModelPrimitive
  }
  ShadowMode?: { ENABLED: unknown }
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
  PostProcessStageLibrary?: {
    createRainStage: () => WeatherPostProcessStage
    createSnowStage: () => WeatherPostProcessStage
    createFogStage: () => WeatherPostProcessStage
  }
}

const config = useRuntimeConfig()
const cesiumContainer = ref<HTMLElement | null>(null)
const sceneSourceCanvas = ref<HTMLCanvasElement | null>(null)
const engineStatus = ref('三维引擎初始化中')
const activeScenario = ref<ScenarioKey>('waterlogging')
const activePlan = ref<PlanKey>('planA')
const activeMeasure = ref<MeasureKey>('ditch')
const buildProgress = ref(0)
const buildState = ref<'idle' | 'running' | 'ready' | 'error'>('idle')
const generatedJob = ref<SimulationJob | AgentJob | null>(null)
const constructionStage = ref(0)
const pickMode = ref(false)
const isDraggingModel = ref(false)
const modelSelected = ref(false)
const modelScale = ref(1)
const modelHeading = ref(0)
const selectedPoint = ref<PickedPoint | null>(null)
const measurementMode = ref<SceneMeasureType | null>(null)
const shadowAnalysisActive = ref(false)
const shadowAnalysisTime = ref('2026-06-21T15:00')
const toolFeedback = ref('')
const measurePoints = ref<PickedPoint[]>([])
const dataLayerEntities = ref<Record<string, unknown[]>>({})
const operationMessage = ref('点击“AI 建造”，先在地图上选点，再输入提示词启动 Blender 建模')
const weatherState = ref(createWeatherState('clear'))
const nativeWeatherEffects = ref(false)
const weatherPanelOpen = ref(false)
const parkPickMode = ref(false)
const isochroneLoading = ref(false)
const isochronePhase = ref<'idle' | 'picking' | 'loading' | 'complete' | 'error'>('idle')
const isochroneProfile = ref<IsochroneProfile>('walking')
const isochroneMinutes = ref([5, 10, 15])
const isochroneStatus = ref('点击下方按钮，然后在地图上选择公园落点')
const layerVisibility = ref({
  buildingLayer: true,
  roadLayer: true,
  waterLayer: true,
  issueLayer: true,
  poiLayer: true,
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
let measurementEntities: unknown[] = []
let previewEntity: unknown = null
let feedbackTimer: number | undefined
let weatherStage: WeatherPostProcessStage | null = null
let parkModel: ModelPrimitive | null = null
let isochroneEntities: unknown[] = []
let parkOriginEntity: unknown = null
let isochroneRequest: AbortController | null = null

const parkModelUrl = `${import.meta.env.BASE_URL}models/公园.glb`
const profileOptions: Array<{ value: IsochroneProfile; label: string }> = [
  { value: 'walking', label: '步行' },
  { value: 'cycling', label: '骑行' },
  { value: 'driving', label: '驾车' },
]

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
  longitude: 114.965,
  latitude: 34.95,
}

// 采用贴近建筑尺度的西南侧低空机位，让道路和建筑从身旁向远处延伸，
// 同时保持项目中心位于视线中央，避免重新退回高空鸟瞰效果。
const simulationCamera = {
  longitude: simulationFocus.longitude - 0.00097,
  latitude: simulationFocus.latitude - 0.00128,
  height: 48,
  heading: 32,
  pitch: -16,
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
const currentPlan = computed(() => planData[activePlan.value])
const weatherMetrics = computed(() => resolveWeatherMetrics(weatherState.value))
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
    weather: {
      type: weatherMetrics.value.label,
      intensity: `${weatherState.value.intensity}%`,
      precipitation: `${weatherMetrics.value.precipitation} mm/h`,
      visibility: `${weatherMetrics.value.visibility} m`,
      windSpeed: `${weatherState.value.windSpeed} m/s`,
      risk: describeWeatherRisk(weatherState.value),
    },
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

function selectPlan(key: PlanKey) {
  activePlan.value = key
  operationMessage.value = `当前查看：${planData[key].label}`
}

const previewPlanOrder: PlanKey[] = ['current', 'planA', 'planB']

function movePreviewPlan(direction: -1 | 1) {
  const currentIndex = previewPlanOrder.indexOf(activePlan.value)
  const nextIndex =
    (currentIndex + direction + previewPlanOrder.length) % previewPlanOrder.length
  selectPlan(previewPlanOrder[nextIndex]!)
}

function selectMeasure(key: MeasureKey) {
  activeMeasure.value = key
  const measure = measures.find((item) => item.key === key)
  operationMessage.value = `正在配置治理措施：${measure?.label ?? ''}`
}

function toggleIsochroneMinute(minute: number) {
  const selected = isochroneMinutes.value.includes(minute)
  if (selected && isochroneMinutes.value.length === 1) {
    isochroneStatus.value = '至少保留一个分析时长'
    return
  }
  isochroneMinutes.value = selected
    ? isochroneMinutes.value.filter((value) => value !== minute)
    : [...isochroneMinutes.value, minute].sort((left, right) => left - right)
}

function startParkAnalysis() {
  if (parkPickMode.value) {
    cancelParkPicking()
    return
  }
  if (!viewer) {
    isochronePhase.value = 'error'
    isochroneStatus.value = '三维地图尚未初始化，请稍后再试'
    return
  }
  parkPickMode.value = true
  isochronePhase.value = 'picking'
  pickMode.value = false
  cancelMeasurement()
  isochroneStatus.value = '请在地图上点击公园建设位置'
  operationMessage.value = '公园等时圈分析：等待选择落点'
}

function cancelParkPicking() {
  parkPickMode.value = false
  isochronePhase.value = 'idle'
  isochroneStatus.value = '已取消选点，可重新开始分析'
}

function clearIsochroneEntities() {
  if (viewer) {
    isochroneEntities.forEach((entity) => viewer?.entities.remove(entity))
  }
  isochroneEntities = []
  if (viewer && parkOriginEntity) viewer.entities.remove(parkOriginEntity)
  parkOriginEntity = null
}

function clearParkServiceArea() {
  isochroneRequest?.abort()
  isochroneRequest = null
  parkPickMode.value = false
  isochroneLoading.value = false
  clearIsochroneEntities()
  if (viewer && parkModel) viewer.scene.primitives.remove(parkModel)
  parkModel = null
  isochronePhase.value = 'idle'
  isochroneStatus.value = '结果已清除，可重新选择公园位置'
  operationMessage.value = '公园模型与等时圈已清除'
}

function polygonRings(geometry: IsochroneGeometry) {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates[0] ?? []]
    : geometry.coordinates.map((polygon) => polygon[0] ?? [])
}

function createCesiumColor(
  sdk: CesiumRuntime,
  rgba: readonly [number, number, number, number],
) {
  return new sdk.Color(rgba[0], rgba[1], rgba[2], rgba[3])
}

async function analyzeParkAt(point: PickedPoint) {
  if (!viewer) return
  const sdk = cesium()
  parkPickMode.value = false
  isochroneLoading.value = true
  isochronePhase.value = 'loading'
  isochroneStatus.value = '正在加载公园模型…'
  isochroneRequest?.abort()
  isochroneRequest = new AbortController()
  clearIsochroneEntities()
  if (parkModel) viewer.scene.primitives.remove(parkModel)
  const origin = sdk.Cartesian3.fromDegrees(point.longitude, point.latitude, point.height)
  parkModel = viewer.scene.primitives.add(
    sdk.Model.fromGltf({
      url: parkModelUrl,
      modelMatrix: sdk.Transforms.eastNorthUpToFixedFrame(origin),
      scale: 2.5,
      minimumPixelSize: 110,
      maximumScale: 20,
      shadows: sdk.ShadowMode?.ENABLED,
    }),
  )
  try {
    if (parkModel.readyPromise) await parkModel.readyPromise
    isochroneStatus.value = '公园已加载，正在请求 Mapbox 等时圈…'
    const result = await requestIsochrones({
      accessToken: config.mapbox.accessToken,
      longitude: point.longitude,
      latitude: point.latitude,
      profile: isochroneProfile.value,
      minutes: isochroneMinutes.value,
      signal: isochroneRequest.signal,
    })
    const ordered = [...result.features].sort(
      (left, right) => Number(right.properties?.contour ?? 0) - Number(left.properties?.contour ?? 0),
    )
    ordered.forEach((feature, featureIndex) => {
      const contour = Number(feature.properties?.contour ?? 0)
      const style = resolveIsochroneRenderStyle(featureIndex)
      polygonRings(feature.geometry).forEach((ring) => {
        if (ring.length < 3) return
        const coordinates = ring.flatMap((coordinate) => [
          coordinate[0] ?? 0,
          coordinate[1] ?? 0,
        ])
        isochroneEntities.push(
          viewer!.entities.add({
            name: `${contour} 分钟等时圈`,
            polygon: {
              hierarchy: sdk.Cartesian3.fromDegreesArray(coordinates),
              material: new sdk.ColorMaterialProperty(
                createCesiumColor(sdk, style.fill),
              ),
              outline: true,
              outlineColor: createCesiumColor(sdk, style.outline),
              height: 8 + featureIndex * 2,
            },
          }),
        )
      })
    })
    parkOriginEntity = viewer.entities.add({
      position: sdk.Cartesian3.fromDegrees(
        point.longitude,
        point.latitude,
        point.height + 18,
      ),
      point: {
        pixelSize: 16,
        color: new sdk.Color(228 / 255, 84 / 255, 63 / 255, 1),
        outlineColor: new sdk.Color(1, 242 / 255, 223 / 255, 1),
        outlineWidth: 4,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: '公园中心',
        font: 'bold 11px sans-serif',
        fillColor: new sdk.Color(1, 247 / 255, 234 / 255, 1),
        showBackground: true,
        backgroundColor: new sdk.Color(113 / 255, 33 / 255, 26 / 255, 0.86),
        backgroundPadding: { x: 7, y: 4 },
        pixelOffset: new sdk.Cartesian2(0, -28),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    isochroneStatus.value = `分析完成：${isochroneProfile.value === 'walking' ? '步行' : isochroneProfile.value === 'cycling' ? '骑行' : '驾车'} ${isochroneMinutes.value.join('/')} 分钟可达范围`
    isochronePhase.value = 'complete'
    operationMessage.value = `公园等时圈已生成，共 ${result.features.length} 个圈层`
    viewer.camera.flyTo({
      destination: sdk.Cartesian3.fromDegrees(point.longitude, point.latitude - 0.025, 4200),
      orientation: { heading: 0, pitch: sdk.Math.toRadians(-70), roll: 0 },
    })
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      isochronePhase.value = 'error'
      isochroneStatus.value = error instanceof Error ? error.message : '公园等时圈分析失败'
      operationMessage.value = isochroneStatus.value
    }
  } finally {
    isochroneLoading.value = false
  }
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
      shadows: sdk.ShadowMode?.ENABLED,
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
  if (
    !viewer ||
    pickMode.value ||
    measurementMode.value ||
    !movement.position
  )
    return
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
      type === 'distance'
        ? '距离测量至少需要两个点'
        : '面积测量至少需要三个点'
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

function applyShadowAnalysis(active = shadowAnalysisActive.value) {
  if (!viewer) {
    notifyScene('三维场景仍在初始化，请稍后再试')
    return
  }
  const sdk = cesium()
  const analysisTime = new Date(shadowAnalysisTime.value)
  if (Number.isNaN(analysisTime.getTime())) {
    notifyScene('请选择有效的阴影分析时间')
    return
  }
  shadowAnalysisActive.value = active
  viewer.scene.globe.enableLighting = active
  if (viewer.scene.shadowMap) {
    viewer.scene.shadowMap.enabled = active
    viewer.scene.shadowMap.softShadows = true
  }
  if (viewer.shadows !== undefined) viewer.shadows = active
  if (active && viewer.clock && sdk.JulianDate) {
    viewer.clock.currentTime = sdk.JulianDate.fromDate(analysisTime)
  }
  viewer.scene.requestRender?.()
  notifyScene(active ? `阴影分析已启用：${shadowAnalysisTime.value.replace('T', ' ')}` : '阴影分析已关闭')
}

function updateShadowAnalysisTime(value: string) {
  shadowAnalysisTime.value = value
  if (shadowAnalysisActive.value) applyShadowAnalysis(true)
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
      simulationCamera.longitude,
      simulationCamera.latitude,
      simulationCamera.height,
    ),
    orientation: {
      heading: sdk.Math.toRadians(simulationCamera.heading),
      pitch: sdk.Math.toRadians(simulationCamera.pitch),
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
          color: '#f0b85c',
          outlineColor: '#04201d',
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        ...(index < labelCap && feature.name
          ? {
              label: {
                text: feature.name,
                font: '10px sans-serif',
                fillColor: '#eafffb',
                showBackground: true,
                backgroundColor: '#051011',
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
          material: color,
          clampToGround: true,
        },
        show: layerVisibility.value[layerKey],
      }),
    ]
  })
}

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
          material: 'rgba(58, 168, 255, 0.28)',
          outline: true,
          outlineColor: '#3aa8ff',
          clampToGround: true,
        },
        show: layerVisibility.value.waterLayer,
      }),
    ]
  })
}

function createBuildingEntities(features: ParsedLayerFeature[]) {
  if (!viewer) return []
  const sdk = cesium()
  return features.flatMap((feature) => {
    if (feature.kind !== 'polygon' || feature.points.length < 3) return []
    const positions = feature.points.map((point) =>
      sdk.Cartesian3.fromDegrees(point.longitude, point.latitude, 0),
    )
    return [
      viewer!.entities.add({
        polygon: {
          hierarchy: positions,
          height: 0,
          extrudedHeight: Math.max(1, feature.height ?? 3),
          material: 'rgba(245, 248, 248, 0.92)',
          outline: true,
          outlineColor: '#aab4b4',
          closeTop: true,
          closeBottom: true,
          shadows: sdk.ShadowMode?.ENABLED,
        },
        show: layerVisibility.value.buildingLayer,
      }),
    ]
  })
}

async function loadDataLayers() {
  if (!viewer) return
  engineStatus.value = '正在加载建筑白膜、水系、路网与 POI 数据图层'
  const results = await Promise.allSettled([
        fetchIServerFeatures(
          {
            serviceUrl: config.supermap.mapServices.buildingFootprints,
            mapName: 'Lankao_3D_GloBFP_SHP',
            datasetName: 'Lankao_3D_GloBFP',
          },
          {
            bounds: {
              minLongitude: 114.94,
              minLatitude: 34.93,
              maxLongitude: 114.99,
              maxLatitude: 34.97,
            },
            expectCount: 6000,
          },
        ),
        fetchIServerFeatures(
          {
            serviceUrl: config.supermap.mapServices.poi,
            mapName: 'Lankao_POI_2025',
            datasetName: 'Lankao_POI_2025',
          },
          {
            attributeFilter: buildWgs84BoundsFilter(
              114.9,
              34.9,
              115.03,
              35.0,
            ),
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
  if (!viewer) return
  const [buildingResult, poiResult, roadResult, waterLineResult, waterPolygonResult] = results
  const buildingFeatures = buildingResult.status === 'fulfilled' ? buildingResult.value : []
  const poiFeatures = poiResult.status === 'fulfilled' ? poiResult.value : []
  const roadFeatures = roadResult.status === 'fulfilled' ? roadResult.value : []
  const waterLines = waterLineResult.status === 'fulfilled' ? waterLineResult.value : []
  const waterPolygons = waterPolygonResult.status === 'fulfilled' ? waterPolygonResult.value : []
  dataLayerEntities.value = {
      buildingLayer: createBuildingEntities(buildingFeatures),
      poiLayer: createPoiEntities(poiFeatures),
      roadLayer: createLineEntities(roadFeatures, '#e8b95c', 1.6, 'roadLayer'),
      waterLayer: [
        ...createLineEntities(waterLines, '#3aa8ff', 1.6, 'waterLayer'),
        ...createPolygonEntities(waterPolygons),
      ],
  }
  const failedCount = results.filter((result) => result.status === 'rejected').length
  engineStatus.value = `数据图层已加载：白膜 ${buildingFeatures.length} · POI ${poiFeatures.length} · 路网 ${roadFeatures.length} · 水系 ${waterLines.length + waterPolygons.length}${failedCount ? ` · ${failedCount} 项失败` : ''}`
  notifyScene(`建筑白膜已按 Height 字段拉伸，共加载 ${buildingFeatures.length} 个要素`)
  results.forEach((result) => {
    if (result.status === 'rejected') console.error('数据图层加载失败', result.reason)
  })
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
    if (parkPickMode.value) {
      const point = pickGroundPoint(movement.position)
      if (!point) {
        isochroneStatus.value = '未拾取到地图表面，请重新点击'
        return
      }
      void analyzeParkAt(point)
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
  eventHandler.setInputAction(
    () => {
      if (measurementMode.value) finishMeasurement()
    },
    sdk.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
  )
  eventHandler.setInputAction(
    () => {
      if (measurementMode.value) finishMeasurement()
    },
    sdk.ScreenSpaceEventType.RIGHT_CLICK,
  )
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
    const completedJob = await waitForAgentJob(
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

function clearNativeWeatherEffect() {
  if (viewer?.scene.postProcessStages && weatherStage) {
    viewer.scene.postProcessStages.remove(weatherStage)
  }
  weatherStage = null
  nativeWeatherEffects.value = false
}

function applyNativeWeatherEffect(state: WeatherState) {
  clearNativeWeatherEffect()
  if (!viewer || state.kind === 'clear') return
  const stages = cesium().PostProcessStageLibrary
  const collection = viewer.scene.postProcessStages
  if (!stages || !collection) return

  if (state.kind === 'storm') {
    weatherStage = stages.createRainStage()
    weatherStage.uniforms.speed = 8 + state.intensity * 0.24 + state.windSpeed
    weatherStage.uniforms.angle = -0.15 - state.windSpeed * 0.035
  } else if (state.kind === 'snow') {
    weatherStage = stages.createSnowStage()
    weatherStage.uniforms.density = 1 + state.intensity * 0.08
    weatherStage.uniforms.speed = 0.8 + state.windSpeed * 0.35
    weatherStage.uniforms.angle = state.windDirection / 360
  } else {
    weatherStage = stages.createFogStage()
    weatherStage.uniforms.scale = 0.35 + state.intensity * 0.025
  }

  collection.add(weatherStage)
  nativeWeatherEffects.value = true
  viewer.scene.requestRender?.()
}

function updateWeather(state: WeatherState) {
  applyNativeWeatherEffect(state)
  const metrics = resolveWeatherMetrics(state)
  operationMessage.value = `天气场景已切换为${metrics.label}：降水 ${metrics.precipitation} mm/h、能见度 ${(metrics.visibility / 1000).toFixed(1)} km；${describeWeatherRisk(state)}`
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
      shadows: false,
    })
    sceneSourceCanvas.value = viewer.scene.canvas
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
    viewer.scene.globe.enableLighting = false
    viewer.camera.setView({
      destination: sdk.Cartesian3.fromDegrees(
        simulationCamera.longitude,
        simulationCamera.latitude,
        simulationCamera.height,
      ),
      orientation: {
        heading: sdk.Math.toRadians(simulationCamera.heading),
        pitch: sdk.Math.toRadians(simulationCamera.pitch),
        roll: 0,
      },
    })
    setupSceneInteractions()
    applyNativeWeatherEffect(weatherState.value)
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
  if (parkPickMode.value) cancelParkPicking()
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
  applyShadowAnalysis(false)
  clearNativeWeatherEffect()
  isochroneRequest?.abort()
  clearIsochroneEntities()
  if (viewer && parkModel) viewer.scene.primitives.remove(parkModel)
  parkModel = null
  if (viewer && generatedModel) viewer.scene.primitives.remove(generatedModel)
  generatedModel = null
  if (viewer && !viewer.isDestroyed?.()) viewer.destroy()
  viewer = null
  sceneSourceCanvas.value = null
})
</script>

<template>
  <main class="screen-page twin-page">
    <ScreenHeader
      title="三生模拟"
      subtitle="真实空间场景构建 · 治理方案推演 · 生产生活生态协同决策"
    />

    <div class="twin-layout">
      <aside class="twin-left">
        <PanelCard title="公园服务圈" meta="可达性分析">
          <div class="isochrone-panel">
            <div class="isochrone-overview">
              <i>园</i>
              <span>
                <strong>生成公园可达服务圈</strong>
                <small>选择出行方式与时长，再到地图中确定位置</small>
              </span>
              <em :class="`is-${isochronePhase}`">
                {{
                  isochronePhase === 'picking'
                    ? '等待落点'
                    : isochronePhase === 'loading'
                      ? '生成中'
                      : isochronePhase === 'complete'
                        ? '已完成'
                        : isochronePhase === 'error'
                          ? '需重试'
                          : '待分析'
                }}
              </em>
            </div>
            <div class="isochrone-field-heading">
              <strong>出行方式</strong><small>选择一种</small>
            </div>
            <div class="profile-switch" aria-label="等时圈出行方式">
              <button
                v-for="option in profileOptions"
                :key="option.value"
                type="button"
                :class="{ active: isochroneProfile === option.value }"
                :aria-pressed="isochroneProfile === option.value"
                @click="isochroneProfile = option.value"
              >
                {{ option.label }}
              </button>
            </div>
            <div class="isochrone-field-heading">
              <strong>服务时长</strong><small>支持多选</small>
            </div>
            <div class="minute-switch" aria-label="等时圈时间范围">
              <button
                v-for="minute in [5, 10, 15]"
                :key="minute"
                type="button"
                :class="{ active: isochroneMinutes.includes(minute) }"
                :aria-pressed="isochroneMinutes.includes(minute)"
                @click="toggleIsochroneMinute(minute)"
              >
                <strong>{{ minute }}</strong><small>分钟</small>
              </button>
            </div>
            <div class="park-analysis-actions">
              <button
                class="park-pick-button"
                type="button"
                :class="{ active: parkPickMode }"
                :disabled="isochroneLoading"
                @click="startParkAnalysis"
              >
                <span aria-hidden="true">{{ parkPickMode ? '×' : '⌖' }}</span>
                {{
                  isochroneLoading
                    ? '正在生成服务圈…'
                    : parkPickMode
                      ? '取消地图选点'
                      : isochronePhase === 'complete'
                        ? '重新选择公园位置'
                        : '在地图中选择公园位置'
                }}
              </button>
              <button
                class="park-clear-button"
                type="button"
                aria-label="清除公园和等时圈"
                :disabled="isochronePhase === 'idle'"
                @click="clearParkServiceArea"
              >
                <span aria-hidden="true">⌫</span>清除
              </button>
            </div>
            <div class="isochrone-status" :class="`is-${isochronePhase}`" role="status">
              <i /><span>{{ isochroneStatus }}</span>
            </div>
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
            'is-picking': pickMode || parkPickMode,
            'is-dragging-model': isDraggingModel,
          }"
        />
        <div v-if="pickMode" class="pick-mode-hint">
          <span>请在地图上点击确定建造位置</span>
          <button type="button" @click="cancelPointPicking">取消</button>
        </div>
        <div v-if="parkPickMode" class="pick-mode-hint">
          <span>请点击公园落点，随后自动加载模型并分析等时圈</span>
          <button type="button" @click="cancelParkPicking">取消</button>
        </div>
        <WeatherSimulation
          v-model="weatherState"
          v-model:open="weatherPanelOpen"
          :native-effects="nativeWeatherEffects"
          @change="updateWeather"
        />
        <SceneToolbox
          :measuring="measurementMode"
          :layers="sceneLayers"
          :feedback="toolFeedback"
          :weather-active="weatherPanelOpen"
          :shadow-active="shadowAnalysisActive"
          :shadow-time="shadowAnalysisTime"
          @clear="clearSceneDrawings"
          @measure="startMeasurement"
          @end-measure="cancelMeasurement"
          @refresh="refreshScene"
          @export="exportScene"
          @zoom-in="zoomScene(1)"
          @zoom-out="zoomScene(-1)"
          @locate="locateScene"
          @update-layer="updateSceneLayer"
          @toggle-weather="weatherPanelOpen = !weatherPanelOpen"
          @toggle-shadow="applyShadowAnalysis(!shadowAnalysisActive)"
          @update-shadow-time="updateShadowAnalysisTime"
        />
      </section>

      <aside class="twin-right">
        <AiBuilderAssistant
          :open="true"
          embedded
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

        <TwinPlotPreview
          :scene-canvas="sceneSourceCanvas"
          :point="selectedPoint"
          :center="simulationFocus"
          :tile-url="buildArcGisTileUrl('arcgis/navigation', config.arcgis.accessToken)"
          :plan-label="currentPlan.label"
          @previous="movePreviewPlan(-1)"
          @next="movePreviewPlan(1)"
        />
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
  grid-template-rows: 72px minmax(0, 1fr);
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
  grid-template-rows: minmax(390px, 1.35fr) minmax(250px, 0.65fr);
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
.measure-list button {
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
.scenario-list button.active,
.measure-list button.active {
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

.isochrone-panel {
  display: grid;
  gap: 5px;
}

.isochrone-overview {
  display: grid;
  align-items: center;
  min-height: 41px;
  padding: 6px 7px;
  border: 1px solid rgba(61, 214, 196, 0.13);
  border-radius: 7px;
  background: linear-gradient(105deg, rgba(61, 214, 196, 0.09), rgba(61, 214, 196, 0.015));
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 8px;
}

.isochrone-overview > i {
  display: grid;
  width: 28px;
  height: 28px;
  place-content: center;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.35);
  border-radius: 7px;
  background: rgba(61, 214, 196, 0.08);
  font: normal 11px var(--font-data);
}

.isochrone-overview > span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.isochrone-overview strong {
  font-size: 10px;
}

.isochrone-overview small {
  overflow: hidden;
  color: var(--text-soft);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.isochrone-overview em {
  padding: 3px 6px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.16);
  border-radius: 99px;
  background: rgba(0, 0, 0, 0.14);
  font: normal 7px var(--font-data);
  white-space: nowrap;
}

.isochrone-overview em.is-picking,
.isochrone-overview em.is-loading {
  color: var(--amber);
  border-color: rgba(240, 184, 92, 0.38);
}

.isochrone-overview em.is-complete {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.4);
}

.isochrone-overview em.is-error {
  color: #ff766f;
  border-color: rgba(255, 102, 95, 0.42);
}

.isochrone-field-heading {
  display: flex;
  align-items: center;
  min-height: 11px;
}

.isochrone-field-heading strong {
  font-size: 8px;
}

.isochrone-field-heading small {
  margin-left: auto;
  color: var(--text-soft);
  font-size: 7px;
}

.profile-switch,
.minute-switch {
  display: grid;
  gap: 5px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.profile-switch button,
.minute-switch button {
  min-height: 28px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.16);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.025);
  font-size: 9px;
  cursor: pointer;
  transition: 140ms ease;
}

.profile-switch button.active,
.minute-switch button.active {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.6);
  background: rgba(61, 214, 196, 0.12);
  box-shadow: inset 0 -2px rgba(61, 214, 196, 0.5);
}

.minute-switch button {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 3px;
}

.minute-switch button strong {
  font: 11px var(--font-data);
}

.minute-switch button small {
  font-size: 7px;
}

.park-analysis-actions {
  display: grid;
  gap: 6px;
  grid-template-columns: minmax(0, 1fr) 58px;
}

.park-pick-button,
.park-clear-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  gap: 7px;
  border-radius: 7px;
  font-size: 9px;
  cursor: pointer;
  transition: 140ms ease;
}

.park-pick-button {
  color: #03201d;
  border: 1px solid var(--cyan);
  background: linear-gradient(100deg, #35c8b7, #4be0ce);
  box-shadow: 0 5px 16px rgba(34, 178, 160, 0.16);
  font-weight: 700;
}

.park-pick-button > span {
  font: 15px/1 var(--font-data);
}

.park-pick-button:hover:not(:disabled),
.park-clear-button:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.park-pick-button.active {
  color: var(--amber);
  border-color: rgba(240, 184, 92, 0.55);
  background: rgba(240, 184, 92, 0.08);
  box-shadow: none;
}

.park-pick-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.park-clear-button {
  color: #f19a91;
  border: 1px solid rgba(239, 123, 110, 0.34);
  background: rgba(239, 123, 110, 0.06);
}

.park-clear-button > span {
  font: 11px/1 var(--font-data);
}

.park-clear-button:disabled {
  color: var(--text-soft);
  border-color: rgba(122, 203, 190, 0.12);
  background: rgba(255, 255, 255, 0.02);
  cursor: not-allowed;
  opacity: 0.5;
}

.isochrone-status {
  display: flex;
  align-items: flex-start;
  min-height: 27px;
  padding: 6px 7px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.09);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.018);
  font-size: 8px;
  line-height: 1.5;
}

.isochrone-status i {
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  margin: 3px 6px 0 0;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 6px var(--cyan);
}

.isochrone-status.is-picking i,
.isochrone-status.is-loading i {
  background: var(--amber);
  box-shadow: 0 0 6px var(--amber);
}

.isochrone-status.is-error i {
  background: #ff665f;
  box-shadow: 0 0 6px rgba(255, 102, 95, 0.7);
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
    grid-template-rows: minmax(360px, 1.35fr) minmax(225px, 0.65fr);
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
    grid-template-rows: 270px minmax(0, 1fr);
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
