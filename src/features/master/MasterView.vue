<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import MapToolbox from '@/shared/components/MapToolbox.vue'
import MasterSanshengRadar from '@/features/master/MasterSanshengRadar.vue'
import TerrainAnalysisDrawer from '@/features/master/TerrainAnalysisDrawer.vue'
import DecisionAssistant from '@/shared/assistant/DecisionAssistant.vue'
import type { DecisionAssistantContext } from '@/shared/assistant/assistant'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useLeafletMap } from '@/gis/leaflet/useLeafletMap'
import { orderTownshipRingParts, townshipRepresentativePoint, type TownshipFeature } from '@/gis/leaflet/townshipFeatures'
import { loadGovernanceIssues, type GovernanceIssue } from '@/features/governance/data'
import { DEM_RENDERING_RULE, loadDemSummary, type DemSummary } from '@/features/master/demService'
import { calculatePopulationChangeRate, gdpTrend, getPopulationTrendLabel, latestDensityRecord, latestPopulation, latestPopulationDensity, latestPopulationGrowth, populationTrend } from '@/features/master/data'
import { COUNTY_SANSHENG_SCORES, resolveMasterSanshengEvaluation } from '@/features/master/sanshengSelection'
import { getPointThemeLabelPlacement, type PointThemeLabelDirection } from '@/features/master/pointThemeLabelPlacement'
import { landUseSource, masterMapThemeLegends, masterMapThemes, resolveTownshipThemeMetric, resolveTownshipThemeMetrics, toggleMasterMapTheme, type MasterMapThemeKey, type ThemeLegendItem, type TownshipThemeMetric } from '@/features/master/mapThemes'

const config = useRuntimeConfig()
const mapContainer = ref<HTMLElement | null>(null)
const { map, focusBounds, townshipFeatures, selectedTownship, activeBaseMap, arcgisAvailable, error: mapError, initialize, setBaseMap, setLandUseRaster, clearSelectedTownship, focusTownshipByName, setTownshipLabelPlacement, resetTownshipLabelPlacements } = useLeafletMap(mapContainer)
const demSummary = ref<DemSummary | null>(null)
const demError = ref('')
const demLoading = ref(true)
const activeMapTheme = ref<MasterMapThemeKey | null>(null)
const selectedThemeTownship = ref<TownshipFeature | null>(null)
const governanceIssues = ref<GovernanceIssue[]>([])
let thematicLayer: L.LayerGroup | null = null
const pointThemeLabelOverrides: Partial<Record<string, PointThemeLabelDirection>> = {
  惠安街道: 'right',
}
const populationLabelYears = new Set([2020, 2021, 2025])
const activePopulationPoint = ref<(typeof populationTrend)[number] | null>(null)
const populationChangeRate = computed(() => calculatePopulationChangeRate(populationTrend))
const populationTrendLabel = computed(() => getPopulationTrendLabel(populationChangeRate.value))
const populationTrendChart = computed(() => {
  const width = 248
  const height = 118
  const left = 26
  const right = 26
  const top = 25
  const bottom = 22
  const values = populationTrend.map((item) => item.populationWan)
  const minimum = Math.min(...values) - 0.8
  const maximum = Math.max(...values) + 0.8
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const valueRange = maximum - minimum || 1
  const points = populationTrend.map((item, index) => ({
    ...item,
    x: left + (plotWidth * index) / Math.max(1, populationTrend.length - 1),
    y: top + ((maximum - item.populationWan) / valueRange) * plotHeight,
  }))
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPath = points.length ? `M ${points[0]!.x} ${height - bottom} L ${linePoints} L ${points.at(-1)!.x} ${height - bottom} Z` : ''
  const gridLines = [minimum, (minimum + maximum) / 2, maximum].map((value) => ({
    value,
    y: top + ((maximum - value) / valueRange) * plotHeight,
  }))

  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    points,
    linePoints,
    areaPath,
    gridLines,
  }
})
const activePopulationChartPoint = computed(() => {
  if (!activePopulationPoint.value) return null
  return populationTrendChart.value.points.find((point) => point.year === activePopulationPoint.value?.year) ?? null
})
const sanshengEvaluation = computed(() => resolveMasterSanshengEvaluation(selectedTownship.value))
const assistantContext = computed<DecisionAssistantContext>(() => ({
  module: '三生空间',
  scopeLabel: selectedTownship.value ? `${selectedTownship.value}三生评价 · 其余指标为兰考县县域` : activeLandUse.value ? `兰考县全域综合态势 · ${activeLandUse.value.name}` : '兰考县全域综合态势',
  updatedAt: new Date().toISOString(),
  data: {
    population: {
      year: latestPopulation.year,
      totalWan: latestPopulation.populationWan,
      densityPerKm2: latestPopulationDensity,
      annualGrowthPercent: latestPopulationGrowth,
    },
    latestGdp: {
      year: gdpTrend.at(-1)!.year,
      valueYiYuan: gdpTrend.at(-1)!.gdpYiYuan,
    },
    populationTrend: populationTrend.map((item) => `${item.year}:${item.populationWan}万人`),
    gdpTrend: gdpTrend.map((item) => `${item.year}:${item.gdpYiYuan.toFixed(2)}亿元`),
    landUse: landUseSource.map((item) => `${item.name}:${item.value}%`),
    selectedLandUse: activeLandUse.value?.name ?? '未选中',
    selectedTownship: selectedTownship.value ?? '未选中',
    townshipSansheng: sanshengEvaluation.value.scores ? { ...sanshengEvaluation.value.scores } : '三生模型当前未配置该行政区指标',
    dataScopes: {
      population: '兰考县县域',
      gdp: '兰考县县域',
      landUse: '兰考县县域',
      sansheng: sanshengEvaluation.value.scope === 'township' ? `${sanshengEvaluation.value.areaName}行政区` : sanshengEvaluation.value.scope === 'unavailable' ? `${sanshengEvaluation.value.areaName}行政区（暂无模型数据）` : '兰考县县域',
    },
    countyScores: { ecology: 88, life: 82, production: 90 },
    dem: demSummary.value === null ? (demLoading.value ? '加载中' : demError.value || '暂无数据') : JSON.stringify(demSummary.value),
  },
}))
const assistantPrompts = ['概括当前全县三生空间态势', '人口与 GDP 趋势反映了什么？', '土地利用结构有哪些优化方向？', '结合当前数据给出三项优先行动']

const baseAdministrativeTheme = {
  label: '行政区划',
  description: '兰考县现行乡镇、街道行政区划',
}
const baseAdministrativeLegend: ThemeLegendItem[] = [
  { label: '兰考县界', color: '#dceb72', kind: 'line' },
  { label: '乡镇 / 街道界', color: '#b9cf65', kind: 'line' },
]
const landUseClassificationReady = computed(() => config.supermap.landuseRaster.rendererType === 'UNIQUE_VALUES')
const activeMapThemeConfig = computed(() => {
  if (activeMapTheme.value == null) return baseAdministrativeTheme
  const theme = masterMapThemes.find((item) => item.key === activeMapTheme.value)!
  if (theme.key === 'landuse' && !landUseClassificationReady.value) {
    return {
      ...theme,
      description: 'Lankao-Land 真实栅格 · 服务端分类色表待配置',
    }
  }
  return theme
})
const activeTownshipMetrics = computed(() => resolveTownshipThemeMetrics(activeMapTheme.value, townshipFeatures.value, governanceIssues.value))
const activeMapLegend = computed(() => {
  if (activeMapTheme.value == null) return baseAdministrativeLegend
  if (activeMapTheme.value === 'poi') return buildPoiLegend()
  if (activeMapTheme.value === 'landuse' && !landUseClassificationReady.value) {
    return [{ label: '真实栅格（待配置分类色表）', color: '#7E9189' }]
  }
  const legend = [...masterMapThemeLegends[activeMapTheme.value]]
  if (activeMapTheme.value === 'sansheng' && activeTownshipMetrics.value.some((metric) => metric.dataAvailable === false)) {
    legend.push({ label: '暂无数据', color: '#435852' })
  }
  return legend
})
const selectedTownshipMetric = computed(() => {
  if (!selectedThemeTownship.value) return null
  const index = townshipFeatures.value.findIndex((feature) => feature.code === selectedThemeTownship.value?.code)
  return index >= 0 ? (activeTownshipMetrics.value[index] ?? null) : null
})
const mapThemeStatus = computed(() => (townshipFeatures.value.length > 0 ? `${townshipFeatures.value.length} 个行政区` : '行政区划加载中'))

function pointOnCircle(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: 60 + radius * Math.cos(radians),
    y: 60 + radius * Math.sin(radians),
  }
}

let landUseStartAngle = 0
const landUseSlices = landUseSource.map((item) => {
  const startAngle = landUseStartAngle
  const endAngle = startAngle + item.value * 3.6
  const start = pointOnCircle(startAngle, 50)
  const end = pointOnCircle(endAngle, 50)
  const midpoint = pointOnCircle((startAngle + endAngle) / 2, 4)
  const label = pointOnCircle((startAngle + endAngle) / 2, 31)
  landUseStartAngle = endAngle

  return {
    ...item,
    path: `M 60 60 L ${start.x} ${start.y} A 50 50 0 ${item.value > 50 ? 1 : 0} 1 ${end.x} ${end.y} Z`,
    offsetX: midpoint.x - 60,
    offsetY: midpoint.y - 60,
    labelX: label.x,
    labelY: label.y,
  }
})

const activeLandUse = ref<(typeof landUseSlices)[number] | null>(null)
const landTooltipPosition = ref({ x: 60, y: 20 })

function updateLandTooltip(event: PointerEvent) {
  const svg = (event.currentTarget as SVGPathElement).ownerSVGElement
  if (!svg) return
  const bounds = svg.getBoundingClientRect()
  landTooltipPosition.value = {
    x: Math.min(96, Math.max(24, ((event.clientX - bounds.left) / bounds.width) * 120)),
    y: Math.min(108, Math.max(20, ((event.clientY - bounds.top) / bounds.height) * 120)),
  }
}

function activateLandUse(item: (typeof landUseSlices)[number], event?: PointerEvent) {
  activeLandUse.value = item
  if (event) updateLandTooltip(event)
  else landTooltipPosition.value = { x: 60, y: 22 }
}

function clearActiveLandUse() {
  activeLandUse.value = null
}

function buildPoiLegend(): ThemeLegendItem[] {
  const totals = new Map(masterMapThemeLegends.poi.map((item) => [item.label, { ...item, value: 0 }]))

  townshipFeatures.value.forEach((feature, index) => {
    const metric = activeMapTheme.value === 'poi' ? activeTownshipMetrics.value[index]! : resolveTownshipThemeMetric('poi', feature, index, governanceIssues.value)
    metric.breakdown?.forEach((item) => {
      const previous = totals.get(item.label)
      totals.set(item.label, {
        label: item.label,
        color: item.color,
        value: (previous?.value ?? 0) + item.value,
      })
    })
  })

  return [...totals.values()]
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]!
  })
}

function townshipBounds(feature: TownshipFeature) {
  return L.latLngBounds(feature.rings.flat())
}

function townshipName(feature: TownshipFeature) {
  return feature.name || feature.code || '行政区'
}

function polygonStyle(metric: TownshipThemeMetric, selected: boolean): L.PathOptions {
  const isPoi = activeMapTheme.value === 'poi'
  const isGovernance = activeMapTheme.value === 'governance'
  const isLandUse = activeMapTheme.value === 'landuse'
  const isPointTheme = isPoi || isGovernance

  return {
    color: selected ? '#eafffb' : isPointTheme ? '#9DBE78' : isLandUse ? '#C6D879' : '#AFCB78',
    fillColor: metric.color,
    fillOpacity: isLandUse ? 0.01 : isPoi ? 0.08 : isGovernance ? 0.06 : activeMapTheme.value === 'population' ? 0.49 : 0.52,
    opacity: selected ? 1 : isPointTheme ? 0.55 : isLandUse ? 0.7 : 0.75,
    weight: selected ? 2.6 : isPointTheme ? 0.8 : 1,
  }
}

function tooltipContent(feature: TownshipFeature, metric: TownshipThemeMetric) {
  const details = metric.breakdown?.map((item) => `<span><i style="background:${item.color}"></i>${escapeHtml(item.label)} ${item.value}</span>`).join('') ?? metric.details?.map((detail) => `<span>${escapeHtml(detail)}</span>`).join('') ?? ''
  return `<strong>${escapeHtml(townshipName(feature))}</strong><em>${escapeHtml(activeMapThemeConfig.value.label)}：${escapeHtml(metric.label)}</em><small>${escapeHtml(metric.meta)}</small>${details}`
}

function addClusterMarker(feature: TownshipFeature, metric: TownshipThemeMetric) {
  if (!thematicLayer) return
  const center = L.latLng(townshipRepresentativePoint(feature))
  const isGovernance = activeMapTheme.value === 'governance'
  if (isGovernance && metric.value <= 0) return
  const countyBounds =
    focusBounds.value ??
    (() => {
      const bounds = L.latLngBounds(townshipFeatures.value.flatMap((item) => item.rings.flat()))
      return [
        [bounds.getSouth(), bounds.getWest()],
        [bounds.getNorth(), bounds.getEast()],
      ] as [[number, number], [number, number]]
    })()
  const placement = getPointThemeLabelPlacement(
    [center.lat, center.lng],
    countyBounds,
    metric.radius ?? 18,
    pointThemeLabelOverrides[townshipName(feature)],
  )
  setTownshipLabelPlacement(
    townshipName(feature),
    {
      direction: placement.direction,
      offset: L.point(placement.offset),
      className: 'township-map-label township-map-label--point-theme',
    },
    center,
  )
  const strokeColor = isGovernance ? (metric.value >= 10 ? '#E6A099' : metric.value >= 5 ? '#E4AD92' : '#E8CD8A') : '#A6E8D9'

  const circle = L.circleMarker(center, {
    radius: metric.radius ?? 18,
    color: strokeColor,
    fillColor: metric.color,
    fillOpacity: isGovernance ? 0.68 : 0.72,
    opacity: 0.95,
    weight: 1.4,
  })
    .bindTooltip(tooltipContent(feature, metric), {
      className: 'master-map-tooltip',
      direction: placement.clusterTooltipDirection,
      opacity: 1,
      sticky: true,
    })
    .on('mouseover', () => circle.setStyle({ weight: 2.8, color: '#eafffb', fillOpacity: 0.82 }))
    .on('mouseout', () =>
      circle.setStyle({
        weight: 1.4,
        color: strokeColor,
        fillOpacity: isGovernance ? 0.68 : 0.72,
      }),
    )
    .on('click', () => focusTownship(feature))
    .addTo(thematicLayer)

  L.marker(center, {
    interactive: false,
    icon: L.divIcon({
      className: 'master-cluster-label',
      html: `<span>${metric.value}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }),
  }).addTo(thematicLayer)
}

function clearThematicLayer() {
  thematicLayer?.remove()
  thematicLayer = null
}

function resetMapSelection() {
  selectedThemeTownship.value = null
  clearSelectedTownship()
}

function clearActiveTheme() {
  if (activeMapTheme.value == null) return false
  activeMapTheme.value = null
  return true
}

function resetToAdministrativeView() {
  activeMapTheme.value = null
  selectedThemeTownship.value = null
  clearSelectedTownship()
  clearThematicLayer()
  resetTownshipLabelPlacements()
}

function renderThematicMap() {
  const instance = map.value
  if (!instance) return

  clearThematicLayer()
  resetTownshipLabelPlacements()
  setLandUseRaster(activeMapTheme.value === 'landuse', config.supermap.landuseRaster)
  if (townshipFeatures.value.length === 0 || activeMapTheme.value == null) return

  thematicLayer = L.layerGroup().addTo(instance)

  const metricByCode = new Map(
    townshipFeatures.value.map((feature, index) => [feature.code, activeTownshipMetrics.value[index]]),
  )
  const featureParts = new Map<string, L.Polygon[]>()

  orderTownshipRingParts(townshipFeatures.value).forEach(({ feature, ring }) => {
    const metric = metricByCode.get(feature.code)
    if (!metric) return
    const selected = selectedThemeTownship.value?.code === feature.code
    const style = polygonStyle(metric, selected)
    const polygon = L.polygon([ring], style)
    const parts = featureParts.get(feature.code) ?? []
    parts.push(polygon)
    featureParts.set(feature.code, parts)

    polygon
      .bindTooltip(tooltipContent(feature, metric), {
        className: 'master-map-tooltip',
        direction: 'top',
        opacity: 1,
        sticky: true,
      })
      .on('mouseover', () => {
        parts.forEach((part) =>
          part.setStyle({
            ...style,
            color: '#eafffb',
            fillOpacity: Math.min((style.fillOpacity ?? 0.58) + 0.12, 0.74),
            weight: 2.4,
          }),
        )
      })
      .on('mouseout', () => {
        parts.forEach((part) =>
          part.setStyle(polygonStyle(metric, selectedThemeTownship.value?.code === feature.code)),
        )
      })
      .on('click', () => focusTownship(feature))
      .addTo(thematicLayer!)
  })

  if (activeMapTheme.value === 'poi' || activeMapTheme.value === 'governance') {
    townshipFeatures.value.forEach((feature, index) => {
      const metric = activeTownshipMetrics.value[index]
      if (metric) addClusterMarker(feature, metric)
    })
  }
}

function setActiveMapTheme(themeKey: MasterMapThemeKey) {
  activeMapTheme.value = toggleMasterMapTheme(activeMapTheme.value, themeKey)
}

function focusTownship(feature: TownshipFeature) {
  selectedThemeTownship.value = feature
  const name = townshipName(feature)
  if (focusTownshipByName(name)) return
  selectedTownship.value = name
  map.value?.flyToBounds(townshipBounds(feature), {
    animate: true,
    duration: 0.85,
    padding: [58, 58],
    maxZoom: activeMapTheme.value === 'poi' || activeMapTheme.value === 'governance' ? 13 : 12.25,
  })
}

watch(selectedTownship, (name) => {
  selectedThemeTownship.value = name ? (townshipFeatures.value.find((feature) => townshipName(feature) === name) ?? null) : null
})

watch([map, townshipFeatures, activeMapTheme, selectedThemeTownship, governanceIssues], renderThematicMap, { flush: 'post' })
onBeforeUnmount(() => {
  clearThematicLayer()
  resetTownshipLabelPlacements()
})

onMounted(async () => {
  const issuesPromise = loadGovernanceIssues(`${import.meta.env.BASE_URL}data/governance/governance-issues.geojson`)
    .then((issues) => {
      governanceIssues.value = issues
    })
    .catch(() => {
      governanceIssues.value = []
    })

  await initialize(
    config.supermap.leafletSdkUrl,
    config.supermap.mapServices.base,
    config.map.center,
    config.map.zoom,
    config.map.crs,
    [config.supermap.mapServices.township],
    config.arcgis.accessToken,
    {
      serviceUrl: config.supermap.dem.serviceUrl,
      collectionId: config.supermap.dem.collectionId,
      renderingRule: DEM_RENDERING_RULE,
    },
    { townshipFocus: true },
  )

  try {
    demSummary.value = await loadDemSummary(config.supermap.dem.serviceUrl, config.supermap.dem.collectionId, config.supermap.dem.itemId)
  } catch (cause) {
    demError.value = cause instanceof Error ? cause.message : 'DEM 数据加载失败'
  } finally {
    demLoading.value = false
  }

  await issuesPromise
})
</script>

<template>
  <main class="screen-page master-page">
    <ScreenHeader title="兰考县和美乡村数字孪生决策平台" subtitle="生态 · 生活 · 产业综合评估 / 治理问题发现 / 决策方案辅助研判" />

    <div class="master-layout">
      <aside class="master-side">
        <PanelCard title="人口与密度特征" meta="2020—2025 / 县域统计">
          <div class="population-content">
            <div class="metric-grid">
              <article class="metric-card">
                <span>年末总人口</span>
                <strong>{{ latestPopulation.populationWan.toFixed(1) }}万</strong>
                <small>{{ latestPopulation.year }}年 · 较上年 {{ latestPopulationGrowth.toFixed(1) }}%</small>
              </article>
              <article class="metric-card">
                <span>人口密度</span>
                <strong>{{ latestPopulationDensity }}</strong>
                <small>{{ latestDensityRecord.year }}年 · 人 / km²</small>
              </article>
            </div>
            <div class="population-trend" aria-label="2020 至 2025 年兰考县人口变化趋势">
              <div class="population-trend__plot">
                <div class="population-trend__header"><span>人口变化趋势</span><em>万人</em></div>
                <svg :viewBox="`0 0 ${populationTrendChart.width} ${populationTrendChart.height}`" preserveAspectRatio="none" role="img" aria-label="人口变化趋势折线面积图">
                  <defs>
                    <linearGradient id="population-area-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#3dd6c4" stop-opacity="0.18" />
                      <stop offset="100%" stop-color="#3dd6c4" stop-opacity="0.01" />
                    </linearGradient>
                  </defs>
                  <g v-for="grid in populationTrendChart.gridLines" :key="grid.value">
                    <line class="population-grid-line" :x1="populationTrendChart.left" :x2="populationTrendChart.width - populationTrendChart.right" :y1="grid.y" :y2="grid.y" />
                  </g>
                  <path class="population-area" :d="populationTrendChart.areaPath" />
                  <polyline class="population-line" :points="populationTrendChart.linePoints" />
                  <g v-for="point in populationTrendChart.points" :key="point.year" class="population-point" tabindex="0" :aria-label="`${point.year}年人口 ${point.populationWan.toFixed(1)}万人`" @pointerenter="activePopulationPoint = point" @pointerleave="activePopulationPoint = null" @focus="activePopulationPoint = point" @blur="activePopulationPoint = null">
                    <circle class="population-point__hit" :cx="point.x" :cy="point.y" r="8" />
                    <circle class="population-point__dot" :cx="point.x" :cy="point.y" r="3.5" />
                    <text v-if="populationLabelYears.has(point.year)" class="population-value-label" :x="point.x" :y="point.y + (point.year === 2020 ? 14 : -9)">
                      {{ point.populationWan.toFixed(1) }}
                    </text>
                    <text class="population-year-label" :x="point.x" :y="populationTrendChart.height - 8">
                      {{ point.year }}
                    </text>
                  </g>
                  <g v-if="activePopulationPoint && activePopulationChartPoint" class="population-tooltip" :transform="`translate(${Math.min(populationTrendChart.width - 43, Math.max(43, activePopulationChartPoint.x))}, ${Math.max(47, activePopulationChartPoint.y - 5)})`" aria-hidden="true">
                    <g class="population-tooltip__surface">
                      <rect x="-42" y="-42" width="84" height="34" rx="4" />
                      <text class="population-tooltip__year" x="0" y="-29">{{ activePopulationPoint.year }}年</text>
                      <text x="0" y="-16">年末人口：{{ activePopulationPoint.populationWan.toFixed(1) }}万人</text>
                    </g>
                  </g>
                </svg>
              </div>
              <div class="population-trend__summary">
                <span
                  ><small>2020—2025</small><strong :class="{ 'is-negative': populationChangeRate < 0 }">{{ populationChangeRate < 0 ? '↓ ' : populationChangeRate > 0 ? '↑ ' : '' }}{{ Math.abs(populationChangeRate).toFixed(1) }}%</strong></span
                >
                <span
                  ><small>人口趋势</small><strong>{{ populationTrendLabel }}</strong></span
                >
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="GDP 特征" meta="2020—2025 / 县域统计 / 亿元">
          <div class="gdp-chart">
            <article v-for="item in gdpTrend" :key="item.year" :title="`${item.year}年地区生产总值：${item.gdpYiYuan.toFixed(2)}亿元`">
              <strong>{{ item.gdpYiYuan.toFixed(1) }}</strong>
              <i :style="{ height: `${item.barPercent}%` }" />
              <span>{{ item.year }}</span>
            </article>
          </div>
        </PanelCard>

        <PanelCard title="三生综合评价" :meta="sanshengEvaluation.meta">
          <MasterSanshengRadar v-if="sanshengEvaluation.scores" :area-name="sanshengEvaluation.areaName" :scope="sanshengEvaluation.scope" :scores="sanshengEvaluation.scores" :reference-scores="sanshengEvaluation.scope === 'township' ? COUNTY_SANSHENG_SCORES : null" />
          <div v-else class="sansheng-empty" role="status">
            <strong>暂无该区域三生评价数据</strong>
            <span>三生模型当前未配置该行政区指标</span>
          </div>
        </PanelCard>
      </aside>

      <section class="master-center">
        <section class="map-shell panel-frame master-map">
          <div ref="mapContainer" class="map-container" />
          <div class="master-theme-tabs" role="tablist" aria-label="主控专题地图">
            <button v-for="theme in masterMapThemes" :key="theme.key" type="button" role="tab" :aria-selected="activeMapTheme === theme.key" :class="{ active: activeMapTheme === theme.key }" @click="setActiveMapTheme(theme.key)">
              <strong>{{ theme.label }}</strong>
            </button>
          </div>
          <aside class="master-map-legend" aria-label="专题图例">
            <header>
              <strong>{{ activeMapThemeConfig.label }}</strong>
              <small>{{ mapThemeStatus }}</small>
            </header>
            <p>{{ activeMapThemeConfig.description }}</p>
            <ul>
              <li v-for="item in activeMapLegend" :key="item.label">
                <i :class="`legend-${item.kind ?? 'area'}`" :style="{ background: item.color }" />
                <span>{{ item.label }}</span>
                <b v-if="item.value != null">{{ item.value }} 个</b>
              </li>
            </ul>
            <div v-if="selectedThemeTownship && selectedTownshipMetric" class="master-map-selection">
              <span>当前行政区</span>
              <strong>{{ townshipName(selectedThemeTownship) }}</strong>
              <em>{{ selectedTownshipMetric.label }}</em>
              <div v-if="selectedTownshipMetric.breakdown?.length" class="master-map-breakdown">
                <span v-for="item in selectedTownshipMetric.breakdown" :key="item.label">
                  <i :style="{ background: item.color }" />
                  <b>{{ item.label }}</b>
                  <em>{{ item.value }} 个</em>
                </span>
              </div>
            </div>
          </aside>
          <MapToolbox :map="map" :focus-bounds="focusBounds" :initial-center="config.map.center" :initial-zoom="config.map.zoom" :active-base-map="activeBaseMap" :arcgis-available="arcgisAvailable" :change-base-map="setBaseMap" :reset-selection="resetMapSelection" :reset-to-administrative="resetToAdministrativeView" :clear-theme="clearActiveTheme" export-name="兰考县综合决策地图" />
          <div v-if="mapError" class="map-error">{{ mapError }}</div>
        </section>

        <TerrainAnalysisDrawer :summary="demSummary" :loading="demLoading" :error="demError" />
      </section>

      <aside class="master-side">
        <PanelCard title="土地利用数据" meta="县域统计 / 国土空间结构">
          <div class="land-use">
            <div class="land-chart">
              <div class="land-chart-note">
                <span>主导类型</span>
                <strong>耕地</strong>
              </div>
              <div class="land-visual" @mouseleave="clearActiveLandUse">
                <svg class="land-pie" viewBox="0 0 120 120" role="img" aria-label="土地利用结构饼图">
                  <path
                    v-for="item in landUseSlices"
                    :key="item.name"
                    class="land-slice"
                    :class="{ 'is-active': activeLandUse?.name === item.name }"
                    :d="item.path"
                    :fill="item.color"
                    :style="{
                      '--slice-offset-x': `${item.offsetX}px`,
                      '--slice-offset-y': `${item.offsetY}px`,
                    }"
                    tabindex="0"
                    :aria-label="`${item.name} ${item.value}%`"
                    @pointerenter="activateLandUse(item, $event)"
                    @pointermove="updateLandTooltip"
                    @pointerleave="clearActiveLandUse"
                    @focus="activateLandUse(item)"
                    @blur="clearActiveLandUse"
                  >
                    <title>{{ item.name }}：{{ item.value }}%</title>
                  </path>
                  <text
                    v-for="item in landUseSlices"
                    :key="`${item.name}-label`"
                    class="land-label"
                    :class="{ 'is-active': activeLandUse?.name === item.name }"
                    :x="item.labelX"
                    :y="item.labelY"
                    :style="{
                      '--slice-offset-x': `${item.offsetX}px`,
                      '--slice-offset-y': `${item.offsetY}px`,
                    }"
                  >
                    {{ item.shortLabel }}
                  </text>
                </svg>
                <div
                  v-if="activeLandUse"
                  class="land-tooltip"
                  :style="{
                    left: `${landTooltipPosition.x}px`,
                    top: `${landTooltipPosition.y}px`,
                  }"
                  aria-hidden="true"
                >
                  <span><i :style="{ background: activeLandUse.color }" />{{ activeLandUse.name }}</span>
                  <strong>{{ activeLandUse.value }}%</strong>
                </div>
              </div>
              <div class="land-chart-note is-right">
                <span>用地分类</span>
                <strong>5 类</strong>
              </div>
            </div>
            <ul class="land-legend">
              <li>
                <span><i class="farm" />耕地与设施农业</span><b>42%</b>
              </li>
              <li>
                <span><i class="forest" />林地草地</span><b>19%</b>
              </li>
              <li>
                <span><i class="build" />村庄建设用地</span><b>17%</b>
              </li>
              <li>
                <span><i class="water" />水域沟渠</span><b>10%</b>
              </li>
              <li>
                <span><i class="other" />其他用地</span><b>12%</b>
              </li>
            </ul>
          </div>
        </PanelCard>

        <PanelCard title="治理问题可视化发现" meta="点位 / 热点 / 属性">
          <div class="issue-stack">
            <article><b>人居环境</b><span>沟渠沿线与村庄边界</span><em>32处</em></article>
            <article><b>设施短板</b><span>15 分钟服务覆盖不足</span><em>18处</em></article>
            <article><b>违建疑似</b><span>新增硬化斑块待核查</span><em>9处</em></article>
          </div>
        </PanelCard>

        <PanelCard title="决策方案辅助研判" meta="方案比选 / 展示输出">
          <div class="plan-stack">
            <article>
              <strong>A / 生态廊道修复</strong>
              <p>优先治理水系两侧问题点位，覆盖 12 个重点村。</p>
            </article>
            <article>
              <strong>B / 产业节点集聚</strong>
              <p>联动道路、POI 与 GDP 栅格，推荐 4 处融合节点。</p>
            </article>
          </div>
          <div class="decision-actions"><button type="button">导出图件</button><button type="button">生成报告</button><button type="button">方案推演</button></div>
        </PanelCard>
      </aside>
    </div>
  </main>
  <DecisionAssistant :endpoint="`${config.apiBaseUrl.replace(/\/$/, '')}/assistant/decision`" :timeout-ms="config.reportTimeoutMs" :context="assistantContext" :prompts="assistantPrompts" />
</template>

<style scoped>
.master-layout {
  display: grid;
  min-height: 0;
  gap: 10px;
  grid-template-columns: 286px minmax(500px, 1fr) 300px;
}

.master-side,
.master-center {
  display: grid;
  min-height: 0;
  gap: 10px;
}

.master-side {
  grid-template-rows: repeat(3, minmax(0, 1fr));
}

.master-center {
  grid-template-rows: minmax(0, 1fr) auto;
}

.population-content {
  display: grid;
  height: 100%;
  min-height: 0;
  gap: 4px;
  grid-template-rows: auto minmax(0, 1fr);
}

.population-content .metric-card {
  padding: 4px 8px;
}

.population-content .metric-card strong {
  margin: 2px 0 1px;
  line-height: 1.05;
}

.population-content .metric-card span,
.population-content .metric-card small {
  line-height: 1.15;
  white-space: nowrap;
}

.population-trend {
  display: grid;
  height: 100%;
  min-height: 0;
  gap: 6px;
  grid-template-rows: 118px auto;
}

.population-trend__plot {
  position: relative;
  height: 118px;
  min-height: 0;
  overflow: hidden;
}

.population-trend__header {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 2px;
  left: 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #b8cbc5;
  font-size: 11px;
  pointer-events: none;
}

.population-trend__header em {
  color: #718b84;
  font-size: 10px;
  font-style: normal;
}

.population-trend__plot svg {
  display: block;
  width: 100%;
  height: 118px;
  overflow: visible;
}

.population-grid-line {
  stroke: rgba(126, 183, 174, 0.15);
  stroke-width: 0.7;
  vector-effect: non-scaling-stroke;
}

.population-year-label,
.population-value-label {
  fill: var(--text-soft);
  font-family: var(--font-data);
  text-anchor: middle;
}

.population-year-label {
  fill: #8fa79f;
  font-size: 10px;
}

.population-value-label {
  fill: #e7f3ef;
  font-size: 11px;
  font-weight: 600;
}

.population-area {
  fill: url('#population-area-gradient');
}

.population-line {
  fill: none;
  stroke: #3dd6c4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.5;
  vector-effect: non-scaling-stroke;
}

.population-point {
  outline: none;
}

.population-point__hit {
  fill: transparent;
  cursor: pointer;
}

.population-point__dot {
  fill: #3dd6c4;
  stroke: #a5f4e8;
  stroke-width: 1.25;
  transition: 120ms ease;
  vector-effect: non-scaling-stroke;
}

.population-point:hover .population-point__dot,
.population-point:focus-visible .population-point__dot {
  fill: #6de4d7;
  r: 4px;
}

.population-tooltip {
  pointer-events: none;
}

.population-tooltip rect {
  fill: rgba(5, 27, 25, 0.96);
  stroke: rgba(66, 232, 216, 0.5);
  stroke-width: 0.7;
}

.population-tooltip text {
  fill: #edfffc;
  font: 9px var(--font-data);
  text-anchor: middle;
}

.population-tooltip .population-tooltip__year {
  fill: #a5f4e8;
  font-weight: 600;
}

.population-trend__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 2px 0;
  color: var(--text-soft);
  border-top: 1px solid rgba(74, 126, 114, 0.2);
  font-size: 10px;
  white-space: nowrap;
}

.population-trend__summary span {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.population-trend__summary small {
  color: #829b94;
  font-size: 10px;
}

.population-trend__summary strong {
  color: #4ad9c8;
  font: 600 11px var(--font-data);
}

.population-trend__summary strong.is-negative {
  color: #4ad9c8;
}

@media (max-height: 800px) {
  .population-trend {
    gap: 2px;
    grid-template-rows: 61px auto;
  }

  .population-trend__plot,
  .population-trend__plot svg {
    height: 61px;
  }

  .population-year-label,
  .population-value-label,
  .population-point__hit,
  .population-point__dot {
    transform: scaleY(1.93);
    transform-box: fill-box;
    transform-origin: center;
  }

  .population-tooltip__surface {
    transform: scaleY(1.93);
    transform-box: fill-box;
    transform-origin: center;
  }

  .population-trend__summary {
    padding-top: 2px;
    font-size: 9px;
    line-height: 1.1;
  }

  .population-trend__summary small {
    font-size: 9px;
  }

  .population-trend__summary strong {
    font-size: 10px;
  }
}

.gdp-chart {
  display: flex;
  align-items: end;
  height: 100%;
  min-height: 110px;
  gap: 7px;
  padding-top: 10px;
  border-bottom: 1px solid var(--line);
}

.gdp-chart article {
  display: grid;
  align-items: end;
  height: 100%;
  flex: 1;
  grid-template-rows: 18px minmax(0, 1fr) 20px;
}

.gdp-chart strong {
  color: var(--text-soft);
  font: 9px var(--font-data);
  text-align: center;
}

.gdp-chart i {
  display: block;
  width: 72%;
  min-height: 8px;
  margin: auto auto 0;
  background: linear-gradient(to top, rgba(61, 214, 196, 0.26), var(--cyan));
  box-shadow: 0 0 12px rgba(61, 214, 196, 0.22);
}

.gdp-chart span {
  color: var(--text-soft);
  font: 9px var(--font-data);
  text-align: center;
}

.sansheng-empty {
  display: grid;
  height: 100%;
  min-height: 112px;
  place-content: center;
  gap: 7px;
  padding: 12px;
  color: var(--text-soft);
  text-align: center;
}

.sansheng-empty strong {
  color: var(--text);
  font-size: 12px;
}

.sansheng-empty span {
  font-size: 9px;
}

.master-map {
  min-height: 320px;
}

.master-theme-tabs {
  position: absolute;
  z-index: 640;
  top: 12px;
  right: 14px;
  left: 66px;
  display: grid;
  gap: 7px;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  pointer-events: auto;
}

.master-theme-tabs button {
  display: grid;
  min-width: 0;
  height: 56px;
  padding: 7px 6px;
  place-items: center;
  border: 1px solid rgba(122, 203, 190, 0.2);
  border-radius: 7px;
  color: var(--text-soft);
  text-align: center;
  background: linear-gradient(145deg, rgba(5, 20, 21, 0.88), rgba(12, 42, 39, 0.74));
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24);
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    transform 150ms ease;
}

.master-theme-tabs button:hover,
.master-theme-tabs button:focus-visible,
.master-theme-tabs button.active {
  color: #eafffb;
  border-color: rgba(61, 214, 196, 0.68);
  background: linear-gradient(145deg, rgba(16, 78, 73, 0.92), rgba(5, 30, 30, 0.88));
  transform: translateY(-1px);
}

.master-theme-tabs strong {
  overflow: hidden;
  color: currentColor;
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.master-map-legend {
  position: absolute;
  z-index: 630;
  right: 14px;
  bottom: 14px;
  display: grid;
  width: min(258px, calc(100% - 92px));
  gap: 9px;
  padding: 11px;
  border: 1px solid rgba(122, 203, 190, 0.22);
  border-radius: 8px;
  color: var(--text-soft);
  background: linear-gradient(145deg, rgba(5, 20, 21, 0.91), rgba(12, 42, 39, 0.82));
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(12px);
  pointer-events: auto;
}

.master-map-legend header {
  display: grid;
  gap: 2px;
  grid-template-columns: 1fr auto;
}

.master-map-legend header strong {
  color: var(--text);
  font-size: 13px;
  grid-column: 1;
}

.master-map-legend header small {
  align-self: start;
  color: var(--text-soft);
  font-size: 9px;
  grid-column: 2;
  grid-row: 1 / span 2;
}

.master-map-legend p {
  margin: 0;
  color: var(--text-soft);
  font-size: 9px;
  line-height: 1.45;
}

.master-map-legend ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.master-map-legend li {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
  font-size: 9px;
}

.master-map-legend li i {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border: 1px solid rgba(234, 255, 251, 0.34);
  border-radius: 999px;
}

.master-map-legend li i.legend-line {
  height: 2px;
  border: 0;
  border-radius: 0;
}

.master-map-legend li i.legend-dot {
  border-radius: 999px;
}

.master-map-legend li span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.master-map-legend li b {
  margin-left: auto;
  color: var(--text);
  font: 10px var(--font-data);
  white-space: nowrap;
}

.master-map-selection {
  display: grid;
  gap: 5px;
  padding: 8px;
  border: 1px solid rgba(61, 214, 196, 0.2);
  border-radius: 6px;
  background: rgba(61, 214, 196, 0.07);
}

.master-map-selection span {
  color: var(--text-soft);
  font-size: 8px;
}

.master-map-selection strong {
  color: var(--text);
  font-size: 12px;
}

.master-map-selection em {
  color: var(--cyan);
  font: normal 13px var(--font-data);
}

.master-map-breakdown {
  display: grid;
  gap: 4px;
  margin-top: 2px;
}

.master-map-breakdown span {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--text-soft);
  font-size: 9px;
}

.master-map-breakdown i {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border: 1px solid rgba(234, 255, 251, 0.34);
  border-radius: 999px;
}

.master-map-breakdown b {
  min-width: 0;
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.master-map-breakdown em {
  margin-left: auto;
  color: var(--text);
  font: normal 10px var(--font-data);
  white-space: nowrap;
}

:global(.master-map-tooltip) {
  border: 1px solid rgba(61, 214, 196, 0.36);
  border-radius: 6px;
  color: var(--text-soft);
  background: rgba(5, 20, 21, 0.94);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

:global(.master-map-tooltip::before) {
  border-top-color: rgba(5, 20, 21, 0.94);
}

:global(.master-map-tooltip strong),
:global(.master-map-tooltip em),
:global(.master-map-tooltip small),
:global(.master-map-tooltip span) {
  display: block;
  font-style: normal;
}

:global(.master-map-tooltip strong) {
  color: #eafffb;
  font-size: 12px;
}

:global(.master-map-tooltip em) {
  margin-top: 3px;
  color: var(--cyan);
  font-size: 10px;
}

:global(.master-map-tooltip small),
:global(.master-map-tooltip span) {
  margin-top: 2px;
  color: var(--text-soft);
  font-size: 9px;
}

:global(.master-map-tooltip span) {
  display: flex;
  align-items: center;
  gap: 6px;
}

:global(.master-map-tooltip span i) {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border: 1px solid rgba(234, 255, 251, 0.34);
  border-radius: 999px;
}

:global(.master-cluster-label) {
  width: 32px !important;
  height: 32px !important;
  border: 0 !important;
  background: transparent !important;
}

:global(.master-cluster-label span) {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 0;
  color: #fff;
  background: transparent;
  box-shadow: none;
  font: 700 12px var(--font-data);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}

.land-use {
  display: grid;
  height: 100%;
  min-height: 0;
  gap: 14px;
  grid-template-rows: minmax(112px, 1fr) auto;
}

.land-chart {
  display: grid;
  width: 100%;
  min-height: 0;
  align-items: center;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  place-items: center;
}

.land-chart-note {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 4px;
  padding-top: 6px;
  color: var(--text-soft);
  border-top: 1px solid rgba(61, 214, 196, 0.2);
  font-size: 8px;
  text-align: right;
  white-space: nowrap;
}

.land-chart-note strong {
  color: var(--text);
  font: 600 11px var(--font-display);
}

.land-chart-note.is-right {
  text-align: left;
}

.land-visual {
  position: relative;
  width: 126px;
  height: 126px;
}

.land-pie {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 8px 18px rgba(2, 18, 16, 0.24));
}

.land-slice {
  cursor: pointer;
  outline: none;
  stroke: #10201f;
  stroke-width: 1.4;
  transition:
    transform 160ms ease,
    filter 160ms ease,
    opacity 160ms ease;
  transform-origin: center;
}

.land-pie:has(.land-slice:hover) .land-slice:not(:hover),
.land-pie:has(.land-slice:focus-visible) .land-slice:not(:focus-visible) {
  opacity: 0.7;
}

.land-slice:hover,
.land-slice.is-active,
.land-slice:focus-visible {
  filter: brightness(1.12) drop-shadow(0 3px 5px rgba(3, 18, 16, 0.55));
  transform: translate(var(--slice-offset-x), var(--slice-offset-y));
}

.land-label {
  fill: #edf8f4;
  stroke: rgba(6, 28, 25, 0.44);
  stroke-width: 0.8px;
  paint-order: stroke;
  font: 400 8px var(--font-display);
  pointer-events: none;
  text-anchor: middle;
  dominant-baseline: central;
  transition: transform 160ms ease;
}

.land-label.is-active {
  transform: translate(var(--slice-offset-x), var(--slice-offset-y));
}

.land-tooltip {
  position: absolute;
  z-index: 2;
  display: grid;
  min-width: 92px;
  gap: 4px;
  padding: 7px 9px;
  color: var(--text-soft);
  border: 1px solid rgba(61, 214, 196, 0.24);
  background: rgba(6, 28, 25, 0.94);
  box-shadow: 0 8px 22px rgba(1, 14, 12, 0.42);
  font-size: 9px;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 8px));
  white-space: nowrap;
}

.land-tooltip span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.land-tooltip i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.land-tooltip strong {
  color: var(--text);
  font: 13px var(--font-data);
}

@media (prefers-reduced-motion: reduce) {
  .land-slice,
  .land-label {
    transition: none;
  }
}

.land-legend {
  display: grid;
  gap: 6px 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.land-legend li {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
  padding: 7px 8px;
  border: 1px solid rgba(61, 214, 196, 0.08);
  background: rgba(255, 255, 255, 0.018);
  color: var(--text-soft);
  font-size: 9px;
}

.land-legend li span {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  gap: 6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.land-legend li i {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.land-legend li b {
  margin-left: auto;
  color: var(--text);
  font: 10px var(--font-data);
}

.farm {
  background: #d6b85a;
}
.forest {
  background: #58a875;
}
.build {
  background: #c97663;
}
.water {
  background: #4ba9c5;
}
.other {
  background: #7e9189;
}

.issue-stack,
.plan-stack {
  display: grid;
  gap: 7px;
}

.issue-stack article {
  display: grid;
  align-items: center;
  gap: 5px;
  padding: 7px 8px;
  border-left: 2px solid var(--amber);
  background: rgba(255, 255, 255, 0.025);
  grid-template-columns: 62px 1fr auto;
}

.issue-stack b {
  font-size: 11px;
}
.issue-stack span {
  overflow: hidden;
  color: var(--text-soft);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.issue-stack em {
  color: var(--amber);
  font: normal 11px var(--font-data);
}

.plan-stack article {
  padding: 8px;
  border: 1px solid rgba(61, 214, 196, 0.12);
  background: rgba(61, 214, 196, 0.035);
}

.plan-stack strong {
  color: var(--cyan);
  font-size: 11px;
}
.plan-stack p {
  margin: 5px 0 0;
  color: var(--text-soft);
  font-size: 9px;
  line-height: 1.5;
}

.decision-actions {
  display: flex;
  gap: 5px;
  margin-top: 8px;
}

.decision-actions button {
  height: 26px;
  flex: 1;
  color: var(--text-soft);
  font-size: 9px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
}

@media (max-width: 1440px) {
  .master-layout {
    grid-template-columns: 260px minmax(460px, 1fr) 270px;
    gap: 8px;
  }
  .master-side,
  .master-center {
    gap: 8px;
  }
  .master-center {
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .master-theme-tabs {
    gap: 5px;
  }
  .master-theme-tabs button {
    height: 56px;
    padding: 5px 7px;
  }
  .master-map-legend {
    width: 230px;
    gap: 7px;
    padding: 9px;
  }
  .master-map-legend ul {
    grid-template-columns: 1fr;
  }
  .land-use {
    gap: 8px;
    grid-template-rows: minmax(82px, 1fr) auto;
  }
  .land-visual {
    width: 96px;
    height: 96px;
  }
  .land-legend {
    gap: 4px 6px;
  }
  .land-legend li {
    padding: 4px 6px;
  }
  .issue-stack article {
    padding: 5px 6px;
  }
}
</style>
