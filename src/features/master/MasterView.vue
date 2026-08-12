<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import MapToolbox from '@/shared/components/MapToolbox.vue'
import RadarChart from '@/shared/components/RadarChart.vue'
import DecisionAssistant from '@/shared/assistant/DecisionAssistant.vue'
import type { DecisionAssistantContext } from '@/shared/assistant/assistant'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useLeafletMap } from '@/gis/leaflet/useLeafletMap'
import {
  townshipRepresentativePoint,
  type TownshipFeature,
} from '@/gis/leaflet/townshipFeatures'
import { loadGovernanceIssues, type GovernanceIssue } from '@/features/governance/data'
import { DEM_RENDERING_RULE, loadDemSummary, type DemSummary } from '@/features/master/demService'
import {
  gdpTrend,
  latestDensityRecord,
  latestPopulation,
  latestPopulationDensity,
  latestPopulationGrowth,
  populationTrend,
} from '@/features/master/data'
import {
  landUseSource,
  masterMapThemeLegends,
  masterMapThemes,
  resolveTownshipThemeMetric,
  type MasterMapThemeKey,
  type ThemeLegendItem,
  type TownshipThemeMetric,
} from '@/features/master/mapThemes'

const config = useRuntimeConfig()
const mapContainer = ref<HTMLElement | null>(null)
const {
  map,
  focusBounds,
  townshipFeatures,
  activeBaseMap,
  arcgisAvailable,
  error: mapError,
  initialize,
  setBaseMap,
} = useLeafletMap(mapContainer)
const demSummary = ref<DemSummary | null>(null)
const demError = ref('')
const demLoading = ref(true)
const activeMapTheme = ref<MasterMapThemeKey>('population')
const selectedTownship = ref<TownshipFeature | null>(null)
const governanceIssues = ref<GovernanceIssue[]>([])
let thematicLayer: L.LayerGroup | null = null
const assistantContext = computed<DecisionAssistantContext>(() => ({
  module: '三生空间',
  scopeLabel: activeLandUse.value ? `全县综合态势 · ${activeLandUse.value.name}` : '兰考县全域综合态势',
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
    countyScores: { ecology: 88, life: 82, production: 90 },
    dem: demSummary.value === null ? (demLoading.value ? '加载中' : demError.value || '暂无数据') : JSON.stringify(demSummary.value),
  },
}))
const assistantPrompts = ['概括当前全县三生空间态势', '人口与 GDP 趋势反映了什么？', '土地利用结构有哪些优化方向？', '结合当前数据给出三项优先行动']

const activeMapThemeConfig = computed(
  () => masterMapThemes.find((theme) => theme.key === activeMapTheme.value) ?? masterMapThemes[0]!,
)
const activeMapLegend = computed(() =>
  activeMapTheme.value === 'poi'
    ? buildPoiLegend()
    : masterMapThemeLegends[activeMapTheme.value],
)
const selectedTownshipMetric = computed(() => {
  if (!selectedTownship.value) return null
  const index = townshipFeatures.value.findIndex((feature) => feature.code === selectedTownship.value?.code)
  return resolveTownshipThemeMetric(activeMapTheme.value, selectedTownship.value, Math.max(index, 0), governanceIssues.value)
})
const mapThemeStatus = computed(() =>
  townshipFeatures.value.length > 0
    ? `${townshipFeatures.value.length} 个行政区`
    : '行政区划加载中',
)

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
  const totals = new Map(
    masterMapThemeLegends.poi.map((item) => [
      item.label,
      { ...item, value: 0 },
    ]),
  )

  townshipFeatures.value.forEach((feature, index) => {
    const metric = resolveTownshipThemeMetric('poi', feature, index, governanceIssues.value)
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
  const isPointTheme = activeMapTheme.value === 'poi' || activeMapTheme.value === 'governance'

  return {
    color: selected ? '#eafffb' : '#d6ed9f',
    fillColor: metric.color,
    fillOpacity: isPointTheme ? 0.2 : 0.58,
    opacity: selected ? 1 : 0.92,
    weight: selected ? 2.6 : 1.15,
    dashArray: isPointTheme ? '5 5' : undefined,
  }
}

function tooltipContent(feature: TownshipFeature, metric: TownshipThemeMetric) {
  const details =
    metric.breakdown
      ?.map(
        (item) =>
          `<span><i style="background:${item.color}"></i>${escapeHtml(item.label)} ${item.value}</span>`,
      )
      .join('') ??
    metric.details?.map((detail) => `<span>${escapeHtml(detail)}</span>`).join('') ??
    ''
  return `<strong>${escapeHtml(townshipName(feature))}</strong><em>${escapeHtml(activeMapThemeConfig.value.label)}：${escapeHtml(metric.label)}</em><small>${escapeHtml(metric.meta)}</small>${details}`
}

function addClusterMarker(feature: TownshipFeature, metric: TownshipThemeMetric) {
  if (!thematicLayer) return
  const center = L.latLng(townshipRepresentativePoint(feature))
  const isGovernance = activeMapTheme.value === 'governance'

  L.circleMarker(center, {
    radius: metric.radius ?? 18,
    color: isGovernance ? '#ffe0cc' : '#eafffb',
    fillColor: metric.color,
    fillOpacity: metric.value > 0 ? 0.78 : 0.38,
    opacity: 0.96,
    weight: 1.4,
  })
    .bindTooltip(tooltipContent(feature, metric), {
      className: 'master-map-tooltip',
      direction: 'top',
      opacity: 1,
      sticky: true,
    })
    .on('click', () => focusTownship(feature))
    .addTo(thematicLayer)

  L.marker(center, {
    interactive: false,
    icon: L.divIcon({
      className: 'master-cluster-label',
      html: `<span>${metric.value}</span>`,
      iconAnchor: [16, 12],
    }),
  }).addTo(thematicLayer)
}

function clearThematicLayer() {
  thematicLayer?.remove()
  thematicLayer = null
}

function renderThematicMap() {
  const instance = map.value
  if (!instance) return

  clearThematicLayer()
  if (townshipFeatures.value.length === 0) return

  thematicLayer = L.layerGroup().addTo(instance)

  townshipFeatures.value.forEach((feature, index) => {
    const metric = resolveTownshipThemeMetric(activeMapTheme.value, feature, index, governanceIssues.value)
    const selected = selectedTownship.value?.code === feature.code
    const style = polygonStyle(metric, selected)
    const polygon = L.polygon(feature.rings, style)

    polygon
      .bindTooltip(tooltipContent(feature, metric), {
        className: 'master-map-tooltip',
        direction: 'top',
        opacity: 1,
        sticky: true,
      })
      .on('mouseover', () => {
        polygon.setStyle({ ...style, color: '#eafffb', fillOpacity: Math.min((style.fillOpacity ?? 0.58) + 0.12, 0.74), weight: 2.4 })
      })
      .on('mouseout', () => {
        polygon.setStyle(polygonStyle(metric, selectedTownship.value?.code === feature.code))
      })
      .on('click', () => focusTownship(feature))
      .addTo(thematicLayer!)

    if (activeMapTheme.value === 'poi' || activeMapTheme.value === 'governance') {
      addClusterMarker(feature, metric)
    }
  })
}

function setActiveMapTheme(themeKey: MasterMapThemeKey) {
  activeMapTheme.value = themeKey
}

function focusTownship(feature: TownshipFeature) {
  selectedTownship.value = feature
  map.value?.flyToBounds(townshipBounds(feature), {
    animate: true,
    duration: 0.85,
    padding: [58, 58],
    maxZoom: activeMapTheme.value === 'poi' || activeMapTheme.value === 'governance' ? 13 : 12.25,
  })
}

watch([map, townshipFeatures, activeMapTheme, selectedTownship, governanceIssues], renderThematicMap, { flush: 'post' })
onBeforeUnmount(clearThematicLayer)

onMounted(async () => {
  const issuesPromise = loadGovernanceIssues(`${import.meta.env.BASE_URL}data/governance/governance-issues.geojson`)
    .then((issues) => {
      governanceIssues.value = issues
    })
    .catch(() => {
      governanceIssues.value = []
    })

  await initialize(config.supermap.leafletSdkUrl, config.supermap.mapServices.base, config.map.center, config.map.zoom, config.map.crs, [config.supermap.mapServices.township], config.arcgis.accessToken, {
    serviceUrl: config.supermap.dem.serviceUrl,
    collectionId: config.supermap.dem.collectionId,
    renderingRule: DEM_RENDERING_RULE,
  })

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
            <div class="data-bars master-bars scroll-region">
              <div v-for="item in populationTrend" :key="item.year" class="data-bar">
                <span>{{ item.year }}年</span>
                <i :style="{ '--value': `${item.barPercent}%` }" />
                <b>{{ item.populationWan.toFixed(1) }}</b>
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="GDP 特征" meta="2020—2025 / 亿元">
          <div class="gdp-chart">
            <article v-for="item in gdpTrend" :key="item.year" :title="`${item.year}年地区生产总值：${item.gdpYiYuan.toFixed(2)}亿元`">
              <strong>{{ item.gdpYiYuan.toFixed(1) }}</strong>
              <i :style="{ height: `${item.barPercent}%` }" />
              <span>{{ item.year }}</span>
            </article>
          </div>
        </PanelCard>

        <PanelCard title="三生综合评价" meta="县域协同指数">
          <RadarChart :labels="['生态', '生活', '生产']" :values="[88, 82, 90]" />
        </PanelCard>
      </aside>

      <section class="master-center">
        <section class="map-shell panel-frame master-map">
          <div ref="mapContainer" class="map-container" />
          <div class="master-theme-tabs" role="tablist" aria-label="主控专题地图">
            <button
              v-for="(theme, index) in masterMapThemes"
              :key="theme.key"
              type="button"
              role="tab"
              :aria-selected="activeMapTheme === theme.key"
              :class="{ active: activeMapTheme === theme.key }"
              @click="setActiveMapTheme(theme.key)"
            >
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <strong>{{ theme.shortLabel }}</strong>
              <small>{{ theme.modeLabel }}</small>
            </button>
          </div>
          <aside class="master-map-legend" aria-label="专题图例">
            <header>
              <span>{{ activeMapThemeConfig.modeLabel }}</span>
              <strong>{{ activeMapThemeConfig.label }}</strong>
              <small>{{ mapThemeStatus }}</small>
            </header>
            <p>{{ activeMapThemeConfig.description }}</p>
            <ul>
              <li v-for="item in activeMapLegend" :key="item.label">
                <i :style="{ background: item.color }" />
                <span>{{ item.label }}</span>
                <b v-if="item.value != null">{{ item.value }} 个</b>
              </li>
            </ul>
            <div v-if="selectedTownship && selectedTownshipMetric" class="master-map-selection">
              <span>当前行政区</span>
              <strong>{{ townshipName(selectedTownship) }}</strong>
              <em>{{ selectedTownshipMetric.label }}</em>
              <div
                v-if="selectedTownshipMetric.breakdown?.length"
                class="master-map-breakdown"
              >
                <span
                  v-for="item in selectedTownshipMetric.breakdown"
                  :key="item.label"
                >
                  <i :style="{ background: item.color }" />
                  <b>{{ item.label }}</b>
                  <em>{{ item.value }} 个</em>
                </span>
              </div>
            </div>
          </aside>
          <MapToolbox
            :map="map"
            :focus-bounds="focusBounds"
            :initial-center="config.map.center"
            :initial-zoom="config.map.zoom"
            :active-base-map="activeBaseMap"
            :arcgis-available="arcgisAvailable"
            :change-base-map="setBaseMap"
            export-name="兰考县综合决策地图"
          />
          <div v-if="mapError" class="map-error">{{ mapError }}</div>
        </section>

        <PanelCard title="DEM 栅格数据" :meta="demSummary ? `${demSummary.collectionId} / ${demSummary.crs}` : 'SuperMap 影像服务'">
          <div class="dem-overview">
            <figure class="dem-preview">
              <img v-if="demSummary?.thumbnailUrl" :src="demSummary.thumbnailUrl" alt="兰考县 DEM 栅格缩略图" />
              <div v-else class="dem-state">
                {{ demLoading ? '正在读取 DEM 栅格…' : demError }}
              </div>
              <figcaption v-if="demSummary">
                <span>实时栅格</span><b>{{ demSummary.fileName }}</b
                ><em>有效抽样 {{ demSummary.validSampleCount }} 点</em>
              </figcaption>
            </figure>
            <div class="dem-stats">
              <article>
                <span>抽样平均高程</span>
                <strong>{{ demSummary?.averageElevationM != null ? `${demSummary.averageElevationM} m` : '—' }}</strong>
              </article>
              <article>
                <span>抽样高程范围</span>
                <strong v-if="demSummary?.minimumElevationM != null && demSummary.maximumElevationM != null">
                  {{ demSummary.minimumElevationM }}–{{ demSummary.maximumElevationM }}
                  m
                </strong>
                <strong v-else>—</strong>
              </article>
              <article>
                <span>栅格尺寸</span>
                <strong>{{ demSummary ? `${demSummary.width} × ${demSummary.height}` : '—' }}</strong>
              </article>
              <article>
                <span>像元分辨率</span>
                <strong>{{ demSummary ? `${demSummary.pixelSizeDegrees.toFixed(6)}°` : '—' }}</strong>
              </article>
            </div>
          </div>
        </PanelCard>
      </section>

      <aside class="master-side">
        <PanelCard title="土地利用数据" meta="国土空间结构">
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
  grid-template-rows: minmax(0, 1fr) 196px;
}

.population-content {
  display: grid;
  height: 100%;
  min-height: 0;
  gap: 10px;
  grid-template-rows: auto minmax(0, 1fr);
}

.master-bars {
  padding-right: 4px;
  overflow-x: hidden;
  overflow-y: auto;
  align-content: start;
}

.master-bars .data-bar {
  grid-template-columns: 48px minmax(0, 1fr) 30px;
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
  min-height: 46px;
  padding: 7px 9px;
  border: 1px solid rgba(122, 203, 190, 0.2);
  border-radius: 7px;
  color: var(--text-soft);
  text-align: left;
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

.master-theme-tabs span {
  color: var(--cyan);
  font: 9px var(--font-data);
  letter-spacing: 0.08em;
}

.master-theme-tabs strong {
  overflow: hidden;
  color: currentColor;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.master-theme-tabs small {
  overflow: hidden;
  font-size: 8px;
  opacity: 0.8;
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

.master-map-legend header span {
  color: var(--cyan);
  font: 9px var(--font-data);
  letter-spacing: 0.14em;
  text-transform: uppercase;
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
  width: auto !important;
  height: auto !important;
  border: 0 !important;
  background: transparent !important;
}

:global(.master-cluster-label span) {
  display: grid;
  min-width: 32px;
  height: 22px;
  padding: 0 7px;
  place-items: center;
  border: 1px solid rgba(234, 255, 251, 0.55);
  border-radius: 999px;
  color: #eafffb;
  background: rgba(5, 20, 21, 0.82);
  box-shadow: 0 5px 14px rgba(0, 0, 0, 0.24);
  font: 11px var(--font-data);
}

.dem-overview {
  display: grid;
  height: 100%;
  gap: 14px;
  grid-template-columns: minmax(260px, 1fr) 250px;
}

.dem-preview {
  position: relative;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(61, 214, 196, 0.12);
  background: linear-gradient(135deg, rgba(14, 52, 47, 0.9), rgba(6, 24, 23, 0.96));
}

.dem-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: sepia(0.2) saturate(1.4) hue-rotate(90deg) contrast(1.18);
}

.dem-preview::after {
  position: absolute;
  inset: 0;
  content: '';
  pointer-events: none;
  background: linear-gradient(90deg, rgba(5, 25, 22, 0.14), transparent 55%, rgba(8, 31, 28, 0.25));
}

.dem-preview figcaption {
  position: absolute;
  z-index: 1;
  right: 8px;
  bottom: 7px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  color: #dff6ec;
  background: rgba(4, 24, 21, 0.76);
  backdrop-filter: blur(4px);
  font-size: 9px;
}

.dem-preview figcaption span {
  color: var(--cyan);
}

.dem-preview figcaption b {
  font-family: var(--font-data);
}

.dem-preview figcaption em {
  margin-left: auto;
  color: var(--text-soft);
  font-style: normal;
}

.dem-state {
  display: grid;
  height: 100%;
  place-items: center;
  color: var(--text-soft);
  font-size: 11px;
}

.dem-stats {
  display: grid;
  gap: 7px;
  grid-template-columns: repeat(2, 1fr);
}

.dem-stats article {
  display: grid;
  place-content: center;
  padding: 7px;
  border: 1px solid rgba(61, 214, 196, 0.12);
  text-align: center;
}

.dem-stats span {
  color: var(--text-soft);
  font-size: 10px;
}

.dem-stats strong {
  margin-top: 6px;
  color: var(--cyan);
  font: 15px var(--font-data);
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
  background: #d6b657;
}
.forest {
  background: #4da668;
}
.build {
  background: #d26d57;
}
.water {
  background: #48a5cc;
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
  .master-layout { grid-template-columns: 260px minmax(460px, 1fr) 270px; gap: 8px; }
  .master-side, .master-center { gap: 8px; }
  .master-center { grid-template-rows: minmax(0, 1fr) 170px; }
  .master-theme-tabs { gap: 5px; }
  .master-theme-tabs button { min-height: 40px; padding: 5px 7px; }
  .master-theme-tabs small { display: none; }
  .master-map-legend { width: 230px; gap: 7px; padding: 9px; }
  .master-map-legend ul { grid-template-columns: 1fr; }
  .land-use { gap: 8px; grid-template-rows: minmax(82px, 1fr) auto; }
  .land-visual { width: 96px; height: 96px; }
  .land-legend { gap: 4px 6px; }
  .land-legend li { padding: 4px 6px; }
  .issue-stack article { padding: 5px 6px; }
}
</style>
