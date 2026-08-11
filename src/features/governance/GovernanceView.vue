<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import L from 'leaflet'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import MapToolbox from '@/shared/components/MapToolbox.vue'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useLeafletMap } from '@/gis/leaflet/useLeafletMap'
import GovernanceAssistant from './GovernanceAssistant.vue'
import GovernanceIssueDetail from './GovernanceIssueDetail.vue'
import type {
  GovernanceAssistantAction,
  GovernanceAssistantContext,
} from './assistant'
import {
  issueStatuses,
  loadGovernanceIssues,
  queryIssuesByBounds,
  queryIssuesByRadius,
  type GovernanceIssue,
  type IssueStatus,
  type QueryBounds,
} from './data'

type SpatialQueryMode = 'rectangle' | 'circle'

const ISSUE_PANE = 'governanceIssuePane'
const SPATIAL_QUERY_PANE = 'governanceSpatialQueryPane'

const config = useRuntimeConfig()
const mapContainer = ref<HTMLElement | null>(null)
const issues = ref<GovernanceIssue[]>([])
const selectedId = ref('')
const detailOpen = ref(false)
const toast = ref('')
const dataError = ref('')
const aiHighlightedIds = ref<Set<string>>(new Set())
const spatialIds = ref<Set<string> | null>(null)
const spatialQueryLabel = ref('全县要素')
const spatialQueryMode = ref<SpatialQueryMode | null>(null)
const spatialControlValue = ref<'all' | 'view' | SpatialQueryMode>('all')
const filters = reactive({
  keyword: '',
  type: 'all',
  town: 'all',
  urgency: 'all',
  status: 'all',
})
const mapBounds = ref<QueryBounds | null>(null)
const mapZoom = ref(config.map.zoom)
const {
  map,
  focusBounds,
  error: mapError,
  initialize,
} = useLeafletMap(mapContainer)
let toastTimer: number | undefined
let issueLayer: L.FeatureGroup | null = null
let spatialLayer: L.FeatureGroup | null = null
let spatialDraft: L.Rectangle | L.Circle | null = null
let spatialStart: L.LatLng | null = null
const issueMarkers = new Map<string, L.Marker>()

const types = computed(() => [
  ...new Set(issues.value.map((issue) => issue.type)),
])
const towns = computed(() => [
  ...new Set(issues.value.map((issue) => issue.town)),
])
const attributeFiltered = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  return issues.value.filter((issue) => {
    if (
      keyword &&
      !`${issue.id}${issue.description}${issue.subtype}${issue.address}${issue.contact}${issue.channel}`
        .toLowerCase()
        .includes(keyword)
    )
      return false
    if (filters.type !== 'all' && issue.type !== filters.type) return false
    if (filters.town !== 'all' && issue.town !== filters.town) return false
    if (filters.urgency !== 'all' && issue.urgency !== filters.urgency)
      return false
    if (filters.status !== 'all' && issue.status !== filters.status)
      return false
    return true
  })
})
const filtered = computed(() =>
  spatialIds.value
    ? attributeFiltered.value.filter((issue) => spatialIds.value!.has(issue.id))
    : attributeFiltered.value,
)
const selected = computed(
  () =>
    filtered.value.find((issue) => issue.id === selectedId.value) ??
    filtered.value[0],
)
const summary = computed(() => {
  const rows = filtered.value
  const closed = rows.filter((issue) => issue.status === '已办结').length
  return {
    total: rows.length,
    pending: rows.filter((issue) => issue.status === '待审核').length,
    processing: rows.filter(
      (issue) => issue.status === '处理中' || issue.status === '已派单',
    ).length,
    closed,
    urgent: rows.filter((issue) => issue.urgency === '高').length,
    rate: rows.length ? Math.round((closed / rows.length) * 100) : 0,
  }
})
const townCounts = computed(() =>
  towns.value
    .map((town) => ({
      town,
      count: filtered.value.filter((issue) => issue.town === town).length,
    }))
    .sort((a, b) => b.count - a.count),
)
const maxTownCount = computed(() =>
  Math.max(1, ...townCounts.value.map((row) => row.count)),
)
const dataUpdatedAt = computed(() =>
  issues.value.reduce(
    (latest, issue) => (issue.time > latest ? issue.time : latest),
    '',
  ),
)
const viewportIssueIds = computed(() => {
  const bounds = mapBounds.value
  if (!bounds) return attributeFiltered.value.map((issue) => issue.id)
  return queryIssuesByBounds(attributeFiltered.value, bounds).map(
    (issue) => issue.id,
  )
})
const assistantContext = computed<GovernanceAssistantContext>(() => ({
  module: '乡村治理',
  scopeLabel: spatialQueryLabel.value,
  hasSpatialQuery: spatialIds.value !== null,
  selectedIssueId: selected.value?.id ?? '',
  dataUpdatedAt: dataUpdatedAt.value,
  userRole: '平台登录用户（AI只读研判）',
  map: {
    bounds: mapBounds.value ?? {
      west: config.map.center[1] - 0.1,
      south: config.map.center[0] - 0.1,
      east: config.map.center[1] + 0.1,
      north: config.map.center[0] + 0.1,
    },
    zoom: mapZoom.value,
    visibleLayers: ['影像底图', '乡镇边界', '治理问题'],
  },
  filters: { ...filters },
}))

const typeColors: Record<string, string> = {
  人居环境类: '#e77468',
  基础设施类: '#f0b85c',
  空间管控类: '#3dd6c4',
  安全风险类: '#78d787',
  农业生产类: '#8fbcff',
  生态保护类: '#77df9f',
  产业发展类: '#c29bf4',
  公共服务类: '#f3d477',
}

const statusColors: Record<IssueStatus, string> = {
  待审核: '#f0b85c',
  已派单: '#6da9ed',
  处理中: '#78d787',
  已办结: '#839b95',
}

const statusStats = computed(() =>
  issueStatuses.map((status) => {
    const count = filtered.value.filter(
      (issue) => issue.status === status,
    ).length

    return {
      status,
      count,
      color: statusColors[status],
      share: summary.value.total
        ? Math.round((count / summary.value.total) * 100)
        : 0,
    }
  }),
)

function resetFilters() {
  Object.assign(filters, {
    keyword: '',
    type: 'all',
    town: 'all',
    urgency: 'all',
    status: 'all',
  })
  clearSpatialQuery()
}

function notify(message: string) {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = ''), 2200)
}

function updateStatus(status: IssueStatus) {
  const issue = issues.value.find((item) => item.id === selected.value?.id)
  if (!issue) return
  issue.status = status
  notify(`状态已更新为：${status}`)
}

function filterByTown(town: string) {
  filters.town = filters.town === town ? 'all' : town
}

function filterByStatus(status: IssueStatus) {
  filters.status = filters.status === status ? 'all' : status
}

function issueMarkerIcon(
  issue: GovernanceIssue,
  active: boolean,
  highlighted = false,
) {
  const color = typeColors[issue.type] ?? '#3dd6c4'

  return L.divIcon({
    className: 'governance-issue-marker-shell',
    html: `<span class="governance-issue-pin${active ? ' is-active' : ''}${highlighted ? ' is-ai-highlighted' : ''}" style="--issue-color: ${color}" aria-hidden="true"><span class="governance-issue-pin__badge"><b>!</b></span></span>`,
    iconSize: [24, 29],
    iconAnchor: [12, 27],
    tooltipAnchor: [0, -24],
  })
}

function issueTooltip(issue: GovernanceIssue) {
  return `<strong>${issue.id} · ${issue.subtype}</strong><span>${issue.town} / ${issue.village}</span>`
}

function selectIssue(issue: GovernanceIssue, focus = false) {
  selectedId.value = issue.id
  const marker = issueMarkers.get(issue.id)
  marker?.openTooltip()
  if (focus && map.value)
    map.value.flyTo(
      [issue.latitude, issue.longitude],
      Math.max(map.value.getZoom(), 12.5),
      { duration: 0.7 },
    )
}

function openIssueDetail() {
  if (selected.value) detailOpen.value = true
}

function locateDetailIssue() {
  const issue = selected.value
  detailOpen.value = false
  if (issue) selectIssue(issue, true)
}

function refreshIssueMarkers() {
  const mapInstance = map.value
  if (!mapInstance) return
  const issuePane =
    mapInstance.getPane(ISSUE_PANE) ?? mapInstance.createPane(ISSUE_PANE)
  issuePane.style.zIndex = '440'
  if (!issueLayer) issueLayer = L.featureGroup().addTo(mapInstance)
  const visibleIds = new Set(filtered.value.map((issue) => issue.id))

  issues.value.forEach((issue) => {
    let marker = issueMarkers.get(issue.id)
    if (!marker) {
      marker = L.marker([issue.latitude, issue.longitude], {
        pane: ISSUE_PANE,
        icon: issueMarkerIcon(issue, false),
        keyboard: true,
        riseOnHover: true,
        riseOffset: 250,
        title: `${issue.id} · ${issue.subtype}`,
      })
        .bindTooltip(issueTooltip(issue), {
          className: 'governance-marker-tooltip',
          direction: 'top',
        })
        .on('click', () => selectIssue(issue))
      issueMarkers.set(issue.id, marker)
    }
    const isActive = selected.value?.id === issue.id
    const isHighlighted = aiHighlightedIds.value.has(issue.id)
    marker.setIcon(issueMarkerIcon(issue, isActive, isHighlighted))
    marker.setZIndexOffset(isActive ? 500 : isHighlighted ? 350 : 0)
    if (visibleIds.has(issue.id)) {
      if (!issueLayer!.hasLayer(marker)) marker.addTo(issueLayer!)
    } else if (issueLayer!.hasLayer(marker)) {
      issueLayer!.removeLayer(marker)
    }
  })
}

function getSpatialLayer() {
  if (!map.value) return null
  const queryPane =
    map.value.getPane(SPATIAL_QUERY_PANE) ??
    map.value.createPane(SPATIAL_QUERY_PANE)
  queryPane.style.zIndex = '450'
  if (!spatialLayer) spatialLayer = L.featureGroup().addTo(map.value)
  return spatialLayer
}

function stopSpatialDrawing() {
  const mapInstance = map.value
  if (!mapInstance) return
  mapInstance.off('mousedown', onSpatialStart)
  mapInstance.off('mousemove', onSpatialMove)
  mapInstance.off('mouseup', finishSpatialQuery)
  mapInstance.dragging.enable()
  mapInstance.getContainer().classList.remove('map-is-spatial-querying')
  spatialStart = null
  spatialQueryMode.value = null
}

function onSpatialStart(event: L.LeafletMouseEvent) {
  if (!spatialQueryMode.value || !map.value) return
  spatialStart = event.latlng
  getSpatialLayer()?.clearLayers()
  if (spatialQueryMode.value === 'rectangle') {
    spatialDraft = L.rectangle(L.latLngBounds(spatialStart, spatialStart), {
      pane: SPATIAL_QUERY_PANE,
      color: '#54e1ce',
      weight: 2,
      dashArray: '7 5',
      fillColor: '#3dd6c4',
      fillOpacity: 0.12,
    }).addTo(getSpatialLayer()!)
  } else {
    spatialDraft = L.circle(spatialStart, {
      pane: SPATIAL_QUERY_PANE,
      radius: 1,
      color: '#54e1ce',
      weight: 2,
      dashArray: '7 5',
      fillColor: '#3dd6c4',
      fillOpacity: 0.12,
    }).addTo(getSpatialLayer()!)
  }
}

function onSpatialMove(event: L.LeafletMouseEvent) {
  if (!spatialStart || !spatialDraft || !map.value) return
  if (spatialDraft instanceof L.Circle)
    spatialDraft.setRadius(map.value.distance(spatialStart, event.latlng))
  else spatialDraft.setBounds(L.latLngBounds(spatialStart, event.latlng))
}

function finishSpatialQuery(event: L.LeafletMouseEvent) {
  if (!spatialStart || !spatialDraft || !map.value) return
  let matches: GovernanceIssue[]
  if (spatialDraft instanceof L.Circle) {
    const radius = spatialDraft.getRadius()
    matches = queryIssuesByRadius(
      issues.value,
      [spatialStart.lat, spatialStart.lng],
      radius,
    )
    spatialQueryLabel.value = `圆形范围 ${radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${Math.round(radius)} m`}`
  } else {
    const bounds = L.latLngBounds(spatialStart, event.latlng)
    matches = queryIssuesByBounds(issues.value, {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    })
    spatialQueryLabel.value = '矩形框选范围'
  }
  spatialIds.value = new Set(matches.map((issue) => issue.id))
  stopSpatialDrawing()
  notify(`空间查询完成：命中 ${matches.length} 条问题要素`)
}

function beginSpatialQuery(mode: SpatialQueryMode) {
  if (!map.value) return notify('地图仍在初始化，请稍后再试')
  stopSpatialDrawing()
  getSpatialLayer()?.clearLayers()
  spatialDraft = null
  spatialQueryMode.value = mode
  spatialControlValue.value = mode
  map.value.dragging.disable()
  map.value.getContainer().classList.add('map-is-spatial-querying')
  map.value.on('mousedown', onSpatialStart)
  map.value.on('mousemove', onSpatialMove)
  map.value.on('mouseup', finishSpatialQuery)
  notify(`按住鼠标拖动绘制${mode === 'rectangle' ? '矩形' : '圆形'}查询范围`)
}

function queryCurrentView() {
  if (!map.value) return notify('地图仍在初始化，请稍后再试')
  stopSpatialDrawing()
  getSpatialLayer()?.clearLayers()
  spatialDraft = null
  const bounds = map.value.getBounds()
  const matches = queryIssuesByBounds(issues.value, {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  })
  spatialIds.value = new Set(matches.map((issue) => issue.id))
  spatialQueryLabel.value = '当前地图视野'
  spatialControlValue.value = 'view'
  notify(`视野查询完成：命中 ${matches.length} 条问题要素`)
}

function clearSpatialQuery() {
  stopSpatialDrawing()
  spatialIds.value = null
  spatialQueryLabel.value = '全县要素'
  spatialControlValue.value = 'all'
  spatialDraft = null
  spatialLayer?.clearLayers()
}

function onSpatialControlChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'all') clearSpatialQuery()
  else if (value === 'view') queryCurrentView()
  else if (value === 'rectangle' || value === 'circle') beginSpatialQuery(value)
}

function exportIssues() {
  const header = [
    '编号',
    '类型',
    '子类型',
    '描述',
    '乡镇代码',
    '乡镇',
    '村级代码',
    '村庄',
    '详细位置',
    '经度',
    '纬度',
    '紧急程度',
    '状态',
    '上报渠道',
    '数据类别',
    '上报时间',
  ]
  const rows = filtered.value.map((issue) => [
    issue.id,
    issue.type,
    issue.subtype,
    issue.description,
    issue.townCode,
    issue.town,
    issue.villageCode,
    issue.village,
    issue.address,
    issue.longitude,
    issue.latitude,
    issue.urgency,
    issue.status,
    issue.channel,
    issue.dataClass,
    issue.time,
  ])
  const csv = [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    )
    .join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '乡村治理问题清单.csv'
  anchor.click()
  URL.revokeObjectURL(url)
  notify('问题清单已导出')
}

function syncMapContext() {
  if (!map.value) return
  const bounds = map.value.getBounds()
  mapBounds.value = {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  }
  mapZoom.value = map.value.getZoom()
}

function handleAssistantAction(action: GovernanceAssistantAction) {
  if (action.type === 'HIGHLIGHT_ISSUES') {
    const knownIds = action.issueIds.filter((id) =>
      issues.value.some((issue) => issue.id === id),
    )
    aiHighlightedIds.value = new Set(knownIds)
    refreshIssueMarkers()
    const highlighted = issues.value.filter((issue) =>
      aiHighlightedIds.value.has(issue.id),
    )
    if (map.value && highlighted.length) {
      map.value.fitBounds(
        L.latLngBounds(
          highlighted.map((issue) => [issue.latitude, issue.longitude]),
        ),
        { padding: [46, 46], maxZoom: 13 },
      )
    }
    notify(`AI 已在地图中高亮 ${knownIds.length} 个问题`)
    return
  }

  if (action.type === 'LOCATE_ISSUE' || action.type === 'OPEN_ISSUE') {
    const issue = issues.value.find((item) => item.id === action.issueId)
    if (!issue) return notify('AI 引用的问题不在当前数据中')
    selectIssue(issue, true)
    if (action.type === 'OPEN_ISSUE') detailOpen.value = true
    return
  }

  notify(
    `${action.chart === 'type' ? '问题类型' : action.chart === 'status' ? '处置状态' : '乡镇分布'}图表已在页面中展示`,
  )
}

onMounted(async () => {
  const issuesPromise = loadGovernanceIssues(
    `${import.meta.env.BASE_URL}data/governance/governance-issues.geojson`,
  )
  await initialize(
    config.supermap.leafletSdkUrl,
    config.supermap.mapServices.base,
    config.map.center,
    config.map.zoom,
    config.map.crs,
    [config.supermap.mapServices.township],
  )
  syncMapContext()
  map.value?.on('moveend zoomend', syncMapContext)
  try {
    issues.value = await issuesPromise
    selectedId.value = issues.value[0]?.id ?? ''
  } catch (cause) {
    dataError.value =
      cause instanceof Error ? cause.message : '治理问题要素数据加载失败'
  }
})

watch(filtered, () => {
  if (!filtered.value.some((issue) => issue.id === selectedId.value))
    selectedId.value = filtered.value[0]?.id ?? ''
})

watch([map, issues, filtered, selectedId, aiHighlightedIds], refreshIssueMarkers, {
  immediate: true,
})

onBeforeUnmount(() => {
  window.clearTimeout(toastTimer)
  map.value?.off('moveend zoomend', syncMapContext)
  stopSpatialDrawing()
  issueMarkers.clear()
})
</script>

<template>
  <main class="screen-page governance-page">
    <ScreenHeader
      title="乡村治理闭环处置模块"
      subtitle="群众参与 / 空间落图 / 数据分析 / 闭环处置"
    />

    <div class="governance-layout">
      <aside class="governance-left">
        <PanelCard
          title="处置总览"
          :meta="`${filtered.length}/${issues.length} 条联动结果`"
        >
          <div class="metric-grid overview-grid">
            <article class="metric-card">
              <span>问题总数</span><strong>{{ summary.total }}</strong>
            </article>
            <article class="metric-card">
              <span>待审核</span><strong>{{ summary.pending }}</strong>
            </article>
            <article class="metric-card">
              <span>处置中</span><strong>{{ summary.processing }}</strong>
            </article>
            <article class="metric-card">
              <span>已办结</span><strong>{{ summary.closed }}</strong>
            </article>
            <article class="metric-card">
              <span>闭环率</span><strong>{{ summary.rate }}%</strong>
            </article>
            <article class="metric-card urgent">
              <span>高紧急</span><strong>{{ summary.urgent }}</strong>
            </article>
          </div>
        </PanelCard>

        <PanelCard title="筛选条件" :meta="spatialQueryLabel">
          <template #action
            ><button
              class="tiny-button reset-button"
              type="button"
              @click="resetFilters"
            >
              重置
            </button></template
          >
          <div class="filter-list">
            <label
              ><span>编号或描述</span
              ><input
                v-model="filters.keyword"
                type="search"
                placeholder="输入关键词"
            /></label>
            <label
              ><span>问题类型</span
              ><select v-model="filters.type">
                <option value="all">全部类型</option>
                <option v-for="type in types" :key="type">{{ type }}</option>
              </select></label
            >
            <label
              ><span>所属乡镇</span
              ><select v-model="filters.town">
                <option value="all">全部乡镇</option>
                <option v-for="town in towns" :key="town">{{ town }}</option>
              </select></label
            >
            <label
              ><span>空间范围</span
              ><select
                :value="spatialControlValue"
                @change="onSpatialControlChange"
              >
                <option value="all">全县要素</option>
                <option value="view">当前地图视野</option>
                <option value="rectangle">矩形框选（拖动绘制）</option>
                <option value="circle">圆形查询（拖动绘制）</option>
              </select></label
            >
            <label
              ><span>紧急程度</span
              ><select v-model="filters.urgency">
                <option value="all">全部程度</option>
                <option>高</option>
                <option>中</option>
                <option>低</option>
              </select></label
            >
            <label
              ><span>处置状态</span
              ><select v-model="filters.status">
                <option value="all">全部状态</option>
                <option v-for="status in issueStatuses" :key="status">
                  {{ status }}
                </option>
              </select></label
            >
          </div>
        </PanelCard>
      </aside>

      <section class="governance-center">
        <section class="map-shell panel-frame governance-map">
          <div ref="mapContainer" class="map-container" />
          <MapToolbox
            :map="map"
            :focus-bounds="focusBounds"
            :initial-center="config.map.center"
            :initial-zoom="config.map.zoom"
            export-name="兰考县乡村治理地图"
          />
          <div v-if="mapError" class="map-error">{{ mapError }}</div>
          <div v-if="dataError" class="map-error data-error">
            {{ dataError }}
          </div>
          <div class="map-linkage-hint">
            <b>{{ filtered.length }}</b> 条要素参与列表与图表统计
          </div>
        </section>

        <div class="governance-charts">
          <PanelCard title="乡镇问题分布">
            <div class="data-bars scroll-region">
              <button
                v-for="row in townCounts"
                :key="row.town"
                class="data-bar"
                :class="{ active: filters.town === row.town }"
                type="button"
                :title="`筛选${row.town}`"
                @click="filterByTown(row.town)"
              >
                <span>{{ row.town }}</span
                ><i
                  :style="{ '--value': `${(row.count / maxTownCount) * 100}%` }"
                /><b>{{ row.count }}</b>
              </button>
            </div>
          </PanelCard>
          <PanelCard title="处置状态统计">
            <div class="status-visual">
              <div class="status-summary">
                <div
                  class="status-donut"
                  :style="{ '--rate': `${summary.rate * 3.6}deg` }"
                >
                  <strong>{{ summary.rate }}%</strong><span>闭环率</span>
                </div>
                <p>
                  <strong>
                    {{ summary.closed }}<small>/{{ summary.total }}</small>
                  </strong>
                  <span>已完成处置</span>
                </p>
              </div>
              <ul>
                <li v-for="(item, index) in statusStats" :key="item.status">
                  <button
                    type="button"
                    :class="{ active: filters.status === item.status }"
                    :style="{
                      '--status-color': item.color,
                      '--status-share': `${item.share}%`,
                    }"
                    :title="`筛选${item.status}问题`"
                    @click="filterByStatus(item.status)"
                  >
                    <span class="status-stat__heading">
                      <small>{{ String(index + 1).padStart(2, '0') }}</small>
                      <i />
                      {{ item.status }}
                    </span>
                    <b>{{ item.count }}</b>
                    <em>{{ item.share }}%</em>
                    <span class="status-stat__track" aria-hidden="true">
                      <i />
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </PanelCard>
        </div>
      </section>

      <aside class="governance-right">
        <PanelCard title="最新上报问题" :meta="`${filtered.length} 条`">
          <div class="issue-list scroll-region">
            <button
              v-for="issue in filtered"
              :key="issue.id"
              :class="{ active: selected?.id === issue.id }"
              type="button"
              @click="selectIssue(issue, true)"
            >
              <i :style="{ background: typeColors[issue.type] }" />
              <span
                ><strong>{{ issue.id }} · {{ issue.subtype }}</strong
                ><small>{{ issue.village }} / {{ issue.status }}</small></span
              >
              <em :class="`urgency-${issue.urgency}`">{{ issue.urgency }}</em>
            </button>
            <p v-if="!filtered.length" class="empty-state">
              没有符合条件的问题
            </p>
          </div>
        </PanelCard>

        <PanelCard title="当前问题详情" :meta="selected?.id ?? '未选择'">
          <template #action>
            <button
              class="issue-detail__entry"
              type="button"
              :disabled="!selected"
              @click="openIssueDetail"
            >
              处置详情 <span aria-hidden="true">→</span>
            </button>
          </template>
          <div v-if="selected" class="issue-detail">
            <h3>{{ selected.subtype }}</h3>
            <p>{{ selected.description }}</p>
            <dl>
              <div>
                <dt>位置</dt>
                <dd>{{ selected.town }} / {{ selected.village }}</dd>
              </div>
              <div>
                <dt>详细地址</dt>
                <dd>{{ selected.address }}</dd>
              </div>
              <div>
                <dt>上报人</dt>
                <dd>{{ selected.contact }} · {{ selected.phone }}</dd>
              </div>
              <div>
                <dt>上报渠道</dt>
                <dd>{{ selected.channel }} · {{ selected.dataClass }}</dd>
              </div>
              <div>
                <dt>紧急程度</dt>
                <dd>{{ selected.urgency }}</dd>
              </div>
              <div>
                <dt>当前状态</dt>
                <dd>{{ selected.status }}</dd>
              </div>
              <div>
                <dt>坐标</dt>
                <dd>
                  {{ selected.longitude.toFixed(6) }},
                  {{ selected.latitude.toFixed(6) }}
                </dd>
              </div>
            </dl>
          </div>
          <p v-else class="empty-state">请选择一个问题</p>
        </PanelCard>

        <PanelCard title="状态更新" meta="处置闭环">
          <div class="status-actions">
            <button
              v-for="status in issueStatuses"
              :key="status"
              :class="{ active: selected?.status === status }"
              type="button"
              @click="updateStatus(status)"
            >
              {{ status }}
            </button>
          </div>
          <button
            class="action-button export-button"
            type="button"
            @click="exportIssues"
          >
            导出当前问题清单
          </button>
        </PanelCard>
      </aside>
    </div>
    <Teleport to="body">
      <Transition name="detail-page">
        <GovernanceIssueDetail
          v-if="detailOpen && selected"
          :issue="selected"
          @close="detailOpen = false"
          @locate="locateDetailIssue"
          @update-status="updateStatus"
        />
      </Transition>
    </Teleport>
    <Transition name="module"
      ><div v-if="toast" class="toast">{{ toast }}</div></Transition
    >
    <GovernanceAssistant
      :endpoint="`${config.apiBaseUrl.replace(/\/$/, '')}/assistant/governance`"
      :timeout-ms="config.reportTimeoutMs"
      :context="assistantContext"
      :issues="attributeFiltered"
      :scope-issue-ids="filtered.map((issue) => issue.id)"
      :viewport-issue-ids="viewportIssueIds"
      @action="handleAssistantAction"
    />
  </main>
</template>

<style scoped>
.governance-layout {
  display: grid;
  min-height: 0;
  gap: 10px;
  grid-template-columns: 286px minmax(520px, 1fr) 330px;
}

.governance-left,
.governance-center,
.governance-right {
  display: grid;
  min-height: 0;
  gap: 10px;
}

.governance-left {
  grid-template-rows: 270px minmax(0, 1fr);
}
.governance-center {
  grid-template-rows: minmax(380px, 1fr) 205px;
}
.governance-right {
  grid-template-rows: minmax(230px, 1.1fr) minmax(210px, 1fr) 160px;
}

.overview-grid {
  grid-template-columns: repeat(3, 1fr);
}
.overview-grid .metric-card {
  padding: 10px 7px;
  text-align: center;
}
.overview-grid .metric-card strong {
  font-size: 22px;
}
.overview-grid .urgent strong {
  color: var(--red);
}

.reset-button {
  margin-left: 10px;
  padding: 3px 8px;
  color: var(--text-soft);
  font-size: 9px;
}

.filter-list {
  display: grid;
  gap: 9px;
}

.filter-list label {
  display: grid;
  gap: 4px;
}
.filter-list span {
  color: var(--text-soft);
  font-size: 9px;
}
.filter-list input,
.filter-list select {
  width: 100%;
  height: 31px;
  padding: 0 8px;
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(5, 16, 17, 0.78);
  font-size: 10px;
}

.governance-charts {
  display: grid;
  min-height: 0;
  gap: 10px;
  grid-template-columns: 1fr 1fr;
}

.map-linkage-hint {
  position: absolute;
  z-index: 640;
  right: 12px;
  bottom: 12px;
  padding: 6px 9px;
  border: 1px solid rgba(122, 203, 190, 0.2);
  border-radius: 5px;
  color: var(--text-soft);
  background: rgba(5, 20, 21, 0.86);
  font-size: 9px;
  backdrop-filter: blur(8px);
}

.map-linkage-hint b {
  color: var(--cyan);
  font: 11px var(--font-data);
}
.data-error {
  top: 48px;
}

.status-visual {
  display: grid;
  align-items: center;
  height: 100%;
  min-height: 0;
  padding: 5px 8px;
  gap: 14px;
  grid-template-columns: minmax(140px, 0.75fr) minmax(0, 2fr);
}

.status-summary {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 78%;
  gap: 9px;
  padding-right: 14px;
  border-right: 1px solid rgba(122, 203, 190, 0.14);
}

.status-donut {
  display: grid;
  flex: 0 0 auto;
  place-content: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: conic-gradient(
    var(--cyan) var(--rate),
    rgba(255, 255, 255, 0.06) 0
  );
  box-shadow:
    inset 0 0 0 14px #10201f,
    0 0 24px rgba(61, 214, 196, 0.06);
  text-align: center;
}

.status-donut strong {
  font: 18px var(--font-data);
}
.status-donut span {
  color: var(--text-soft);
  font-size: 8px;
}
.status-summary p {
  display: grid;
  min-width: 0;
  gap: 4px;
  margin: 0;
}
.status-summary p strong {
  color: var(--text);
  font: 18px var(--font-data);
  white-space: nowrap;
}
.status-summary p small {
  color: var(--text-dim);
  font-size: 9px;
}
.status-summary p span {
  color: var(--text-soft);
  font-size: 8px;
  white-space: nowrap;
}
.status-visual ul {
  display: grid;
  height: 100%;
  min-height: 0;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}
.status-visual li {
  min-width: 0;
  min-height: 0;
  color: var(--text-soft);
  font-size: 9px;
}
.status-visual li button {
  position: relative;
  display: grid;
  align-items: center;
  width: 100%;
  height: 100%;
  min-height: 46px;
  padding: 7px 9px 8px;
  gap: 2px 8px;
  border: 1px solid rgba(122, 203, 190, 0.1);
  border-radius: 5px;
  color: inherit;
  text-align: left;
  background: rgba(255, 255, 255, 0.018);
  font-size: inherit;
  cursor: pointer;
  overflow: hidden;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto 1fr 3px;
}
.status-visual li button:hover,
.status-visual li button.active {
  color: var(--text);
  border-color: var(--status-color);
  background: rgba(61, 214, 196, 0.055);
  box-shadow: inset 2px 0 0 var(--status-color);
}
.status-stat__heading {
  display: flex;
  align-items: center;
  grid-column: 1 / -1;
  gap: 5px;
  white-space: nowrap;
}
.status-stat__heading small {
  color: var(--text-dim);
  font: 7px var(--font-data);
  letter-spacing: 0.08em;
}
.status-stat__heading > i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--status-color);
  box-shadow: 0 0 7px var(--status-color);
}
.status-visual li b {
  color: var(--text);
  font: 18px/1 var(--font-data);
  align-self: end;
}
.status-visual li em {
  color: var(--status-color);
  font: normal 9px var(--font-data);
  align-self: end;
}
.status-stat__track {
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.05);
  grid-column: 1 / -1;
  overflow: hidden;
}
.status-stat__track > i {
  display: block;
  width: var(--status-share);
  height: 100%;
  border-radius: inherit;
  background: var(--status-color);
  opacity: 0.8;
}

.governance-charts .data-bar {
  width: 100%;
  padding: 3px 5px;
  border: 1px solid transparent;
  border-radius: 4px;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.governance-charts .data-bars {
  height: 100%;
  padding-right: 5px;
  align-content: start;
  overflow-y: auto;
}

.governance-charts .data-bar:hover,
.governance-charts .data-bar.active {
  border-color: rgba(61, 214, 196, 0.28);
  background: rgba(61, 214, 196, 0.08);
}

.issue-list {
  display: grid;
  align-content: start;
  gap: 5px;
  height: 100%;
  padding-right: 2px;
  overflow: auto;
}

.issue-list button {
  display: grid;
  align-items: center;
  min-height: 48px;
  padding: 6px 8px;
  color: var(--text);
  text-align: left;
  border: 1px solid rgba(122, 203, 190, 0.08);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  grid-template-columns: 4px 1fr 22px;
}

.issue-list button:hover,
.issue-list button.active {
  border-color: var(--line-bright);
  background: rgba(61, 214, 196, 0.08);
}
.issue-list button > i {
  width: 3px;
  height: 28px;
  border-radius: 2px;
}
.issue-list button span {
  display: grid;
  gap: 4px;
  padding-left: 8px;
}
.issue-list button strong {
  font-size: 10px;
  font-weight: 600;
}
.issue-list button small {
  color: var(--text-soft);
  font-size: 8px;
}
.issue-list button em {
  display: grid;
  place-content: center;
  width: 20px;
  height: 20px;
  font: normal 9px var(--font-data);
  border-radius: 50%;
}
.urgency-高 {
  color: #ffd6d1;
  background: rgba(231, 116, 104, 0.24);
}
.urgency-中 {
  color: #ffe3ad;
  background: rgba(240, 184, 92, 0.2);
}
.urgency-低 {
  color: #cfe2dd;
  background: rgba(109, 169, 237, 0.14);
}

.issue-detail h3 {
  margin: 0;
  color: var(--cyan);
  font-size: 15px;
}
.issue-detail p {
  margin: 8px 0;
  color: var(--text-soft);
  font-size: 10px;
  line-height: 1.6;
}
.issue-detail dl {
  display: grid;
  gap: 5px;
  margin: 0;
}
.issue-detail dl div {
  display: flex;
  padding: 5px 0;
  border-bottom: 1px solid rgba(122, 203, 190, 0.08);
}
.issue-detail dt {
  width: 55px;
  color: var(--text-soft);
  font-size: 9px;
}
.issue-detail dd {
  margin: 0;
  font-size: 9px;
}

.issue-detail__entry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  height: 25px;
  margin-left: 9px;
  padding: 0 8px;
  gap: 5px;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.42);
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(61, 214, 196, 0.14), rgba(61, 214, 196, 0.05));
  font-size: 9px;
  white-space: nowrap;
  cursor: pointer;
}

.issue-detail__entry span {
  margin-left: 0;
  color: currentcolor;
  font-size: 11px;
  transition: transform 160ms ease;
}

.issue-detail__entry:hover,
.issue-detail__entry:focus-visible {
  color: #eafffb;
  border-color: var(--line-bright);
  outline: none;
  background: rgba(61, 214, 196, 0.13);
}

.issue-detail__entry:hover span,
.issue-detail__entry:focus-visible span {
  transform: translateX(3px);
}

.issue-detail__entry:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

:global(.map-is-spatial-querying),
:global(.map-is-spatial-querying *) {
  cursor: crosshair !important;
}
:global(.governance-marker-tooltip) {
  padding: 6px 8px !important;
  border: 1px solid rgba(61, 214, 196, 0.45) !important;
  color: #eafffb !important;
  background: rgba(5, 24, 24, 0.94) !important;
  box-shadow: 0 7px 20px rgba(0, 0, 0, 0.3) !important;
  font-size: 9px !important;
}
:global(.governance-marker-tooltip strong),
:global(.governance-marker-tooltip span) {
  display: block;
}
:global(.governance-marker-tooltip span) {
  margin-top: 3px;
  color: #9ab7b0;
}
:global(.governance-marker-tooltip::before) {
  border-top-color: rgba(61, 214, 196, 0.45) !important;
}

:global(.governance-issue-marker-shell) {
  border: 0;
  background: transparent;
  overflow: visible;
}

:global(.governance-issue-pin) {
  position: relative;
  display: block;
  width: 24px;
  height: 29px;
  filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.55));
  transform-origin: 50% 93%;
  transition: filter 160ms ease, transform 160ms ease;
}

:global(.governance-issue-pin::before) {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
  border: 1px solid var(--issue-color);
  border-radius: 50%;
  content: '';
  opacity: 0;
}

:global(.governance-issue-pin__badge) {
  position: absolute;
  top: 3px;
  left: 4px;
  display: grid;
  width: 16px;
  height: 16px;
  border: 1.5px solid rgba(242, 255, 251, 0.95);
  border-radius: 50% 50% 50% 3px;
  place-items: center;
  color: #071413;
  background: var(--issue-color);
  box-shadow:
    0 0 0 1px rgba(4, 19, 18, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
  transform: rotate(45deg);
}

:global(.governance-issue-pin__badge b) {
  font: 800 11px/1 var(--font-data);
  transform: rotate(-45deg);
}

:global(.governance-issue-marker-shell:hover .governance-issue-pin) {
  filter:
    drop-shadow(0 3px 4px rgba(0, 0, 0, 0.62))
    drop-shadow(0 0 4px var(--issue-color));
  transform: scale(1.12);
}

:global(.governance-issue-pin.is-active) {
  z-index: 1;
  filter:
    drop-shadow(0 4px 5px rgba(0, 0, 0, 0.68))
    drop-shadow(0 0 5px var(--issue-color));
  transform: scale(1.28);
}

:global(.governance-issue-pin.is-ai-highlighted) {
  outline: 2px solid #f6e58d;
  outline-offset: 3px;
  filter:
    drop-shadow(0 4px 5px rgba(0, 0, 0, 0.68))
    drop-shadow(0 0 9px #f6e58d);
}

:global(.governance-issue-pin.is-active::before) {
  animation: governance-issue-pulse 1.7s ease-out infinite;
}

@keyframes governance-issue-pulse {
  0% {
    opacity: 0.85;
    transform: scale(0.68);
  }
  75%,
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

@media (prefers-reduced-motion: reduce) {
  :global(.governance-issue-pin),
  :global(.governance-issue-pin.is-active::before) {
    animation: none;
    transition: none;
  }

  :global(.governance-issue-pin.is-active::before) {
    opacity: 0.55;
    transform: scale(1.08);
  }
}

.status-actions {
  display: grid;
  gap: 5px;
  grid-template-columns: repeat(2, 1fr);
}
.status-actions button {
  height: 28px;
  color: var(--text-soft);
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.025);
  font-size: 9px;
  cursor: pointer;
}
.status-actions button.active {
  color: var(--cyan);
  border-color: var(--line-bright);
  background: rgba(61, 214, 196, 0.12);
}
.export-button {
  width: 100%;
  height: 28px;
  margin-top: 7px;
  font-size: 9px;
}
.empty-state {
  color: var(--text-soft);
  font-size: 10px;
  text-align: center;
}

.toast {
  position: fixed;
  z-index: 5000;
  right: 22px;
  bottom: 22px;
  padding: 10px 15px;
  color: #eafffb;
  border: 1px solid var(--line-bright);
  border-radius: 6px;
  background: rgba(9, 34, 32, 0.94);
  box-shadow: var(--shadow);
  font-size: 11px;
}

.detail-page-enter-active,
.detail-page-leave-active {
  transition: opacity 180ms ease;
}

.detail-page-enter-active :deep(.issue-detail-page__canvas),
.detail-page-leave-active :deep(.issue-detail-page__canvas) {
  transition: transform 220ms ease;
}

.detail-page-enter-from,
.detail-page-leave-to {
  opacity: 0;
}

.detail-page-enter-from :deep(.issue-detail-page__canvas),
.detail-page-leave-to :deep(.issue-detail-page__canvas) {
  transform: translateY(10px);
}

@media (prefers-reduced-motion: reduce) {
  .issue-detail__entry span,
  .detail-page-enter-active,
  .detail-page-leave-active,
  .detail-page-enter-active :deep(.issue-detail-page__canvas),
  .detail-page-leave-active :deep(.issue-detail-page__canvas) {
    transition: none;
  }
}

@media (max-width: 1440px) {
  .governance-layout {
    grid-template-columns: 258px minmax(470px, 1fr) 290px;
    gap: 8px;
  }
  .governance-left,
  .governance-center,
  .governance-right {
    gap: 8px;
  }
  .governance-left {
    grid-template-rows: 245px minmax(0, 1fr);
  }
  .governance-center {
    grid-template-rows: minmax(350px, 1fr) 175px;
  }
  .governance-right {
    grid-template-rows: minmax(210px, 1.1fr) minmax(190px, 1fr) 145px;
  }
}
</style>
