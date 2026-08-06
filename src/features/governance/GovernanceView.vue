<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import MapToolbox from '@/shared/components/MapToolbox.vue'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useLeafletMap } from '@/gis/leaflet/useLeafletMap'
import { initialIssues, type GovernanceIssue, type IssueStatus } from './data'

const config = useRuntimeConfig()
const mapContainer = ref<HTMLElement | null>(null)
const issues = ref<GovernanceIssue[]>(initialIssues.map((issue) => ({ ...issue })))
const selectedId = ref(initialIssues[0]!.id)
const toast = ref('')
const filters = reactive({ keyword: '', type: 'all', town: 'all', village: 'all', urgency: 'all' })
const { map, error: mapError, initialize } = useLeafletMap(mapContainer)
let toastTimer: number | undefined

const types = computed(() => [...new Set(issues.value.map((issue) => issue.type))])
const towns = computed(() => [...new Set(issues.value.map((issue) => issue.town))])
const villages = computed(() => [
  ...new Set(issues.value.filter((issue) => filters.town === 'all' || issue.town === filters.town).map((issue) => issue.village)),
])
const filtered = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  return issues.value.filter((issue) => {
    if (keyword && !`${issue.id}${issue.description}${issue.subtype}`.toLowerCase().includes(keyword)) return false
    if (filters.type !== 'all' && issue.type !== filters.type) return false
    if (filters.town !== 'all' && issue.town !== filters.town) return false
    if (filters.village !== 'all' && issue.village !== filters.village) return false
    if (filters.urgency !== 'all' && issue.urgency !== filters.urgency) return false
    return true
  })
})
const selected = computed(() => filtered.value.find((issue) => issue.id === selectedId.value) ?? filtered.value[0])
const summary = computed(() => {
  const rows = filtered.value
  const closed = rows.filter((issue) => issue.status === '已办结').length
  return {
    total: rows.length,
    pending: rows.filter((issue) => issue.status === '待审核').length,
    processing: rows.filter((issue) => issue.status === '处理中' || issue.status === '已派单').length,
    closed,
    urgent: rows.filter((issue) => issue.urgency === '高').length,
    rate: rows.length ? Math.round((closed / rows.length) * 100) : 0,
  }
})
const townCounts = computed(() =>
  towns.value
    .map((town) => ({ town, count: filtered.value.filter((issue) => issue.town === town).length }))
    .sort((a, b) => b.count - a.count),
)

const typeColors: Record<string, string> = {
  人居环境类: '#e77468',
  基础设施类: '#f0b85c',
  空间管控类: '#3dd6c4',
  安全风险类: '#78d787',
}

const statusColors: Record<IssueStatus, string> = {
  待审核: '#f0b85c',
  已派单: '#6da9ed',
  处理中: '#78d787',
  已办结: '#839b95',
}

function resetFilters() {
  Object.assign(filters, { keyword: '', type: 'all', town: 'all', village: 'all', urgency: 'all' })
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

function exportIssues() {
  const header = ['编号', '类型', '描述', '乡镇', '村庄', '紧急程度', '状态']
  const rows = filtered.value.map((issue) => [issue.id, issue.type, issue.description, issue.town, issue.village, issue.urgency, issue.status])
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '乡村治理问题清单.csv'
  anchor.click()
  URL.revokeObjectURL(url)
  notify('问题清单已导出')
}

onMounted(async () => {
  await initialize(
    config.supermap.leafletSdkUrl,
    config.supermap.mapServices.base,
    config.map.center,
    config.map.zoom,
    config.map.crs,
    [config.supermap.mapServices.township],
  )
})

watch(filtered, () => {
  if (!filtered.value.some((issue) => issue.id === selectedId.value)) selectedId.value = filtered.value[0]?.id ?? ''
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
        <PanelCard title="处置总览" meta="当前筛选结果">
          <div class="metric-grid overview-grid">
            <article class="metric-card"><span>问题总数</span><strong>{{ summary.total }}</strong></article>
            <article class="metric-card"><span>待审核</span><strong>{{ summary.pending }}</strong></article>
            <article class="metric-card"><span>处置中</span><strong>{{ summary.processing }}</strong></article>
            <article class="metric-card"><span>已办结</span><strong>{{ summary.closed }}</strong></article>
            <article class="metric-card"><span>闭环率</span><strong>{{ summary.rate }}%</strong></article>
            <article class="metric-card urgent"><span>高紧急</span><strong>{{ summary.urgent }}</strong></article>
          </div>
        </PanelCard>

        <PanelCard title="筛选条件" meta="空间属性组合查询">
          <template #action><button class="tiny-button reset-button" type="button" @click="resetFilters">重置</button></template>
          <div class="filter-list">
            <label><span>编号或描述</span><input v-model="filters.keyword" type="search" placeholder="输入关键词" /></label>
            <label><span>问题类型</span><select v-model="filters.type"><option value="all">全部类型</option><option v-for="type in types" :key="type">{{ type }}</option></select></label>
            <label><span>所属乡镇</span><select v-model="filters.town"><option value="all">全部乡镇</option><option v-for="town in towns" :key="town">{{ town }}</option></select></label>
            <label><span>所属村庄</span><select v-model="filters.village"><option value="all">全部村庄</option><option v-for="village in villages" :key="village">{{ village }}</option></select></label>
            <label><span>紧急程度</span><select v-model="filters.urgency"><option value="all">全部程度</option><option>高</option><option>中</option><option>低</option></select></label>
          </div>
        </PanelCard>
      </aside>

      <section class="governance-center">
        <section class="map-shell panel-frame governance-map">
          <div ref="mapContainer" class="map-container" />
          <MapToolbox
            :map="map"
            :initial-center="config.map.center"
            :initial-zoom="config.map.zoom"
            export-name="兰考县乡村治理地图"
          />
          <div v-if="mapError" class="map-error">{{ mapError }}</div>
        </section>

        <div class="governance-charts">
          <PanelCard title="村庄问题分布">
            <div class="data-bars">
              <div v-for="row in townCounts.slice(0, 5)" :key="row.town" class="data-bar">
                <span>{{ row.town }}</span><i :style="{ '--value': `${Math.min(100, row.count * 32)}%` }" /><b>{{ row.count }}</b>
              </div>
            </div>
          </PanelCard>
          <PanelCard title="处置状态统计">
            <div class="status-visual">
              <div class="status-donut" :style="{ '--rate': `${summary.rate * 3.6}deg` }"><strong>{{ summary.rate }}%</strong><span>闭环率</span></div>
              <ul><li v-for="status in (['待审核', '已派单', '处理中', '已办结'] as IssueStatus[])" :key="status"><i :style="{ background: statusColors[status] }" />{{ status }}<b>{{ filtered.filter((issue) => issue.status === status).length }}</b></li></ul>
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
              @click="selectedId = issue.id"
            >
              <i :style="{ background: typeColors[issue.type] }" />
              <span><strong>{{ issue.id }} · {{ issue.subtype }}</strong><small>{{ issue.village }} / {{ issue.status }}</small></span>
              <em :class="`urgency-${issue.urgency}`">{{ issue.urgency }}</em>
            </button>
            <p v-if="!filtered.length" class="empty-state">没有符合条件的问题</p>
          </div>
        </PanelCard>

        <PanelCard title="当前问题详情" :meta="selected?.id ?? '未选择'">
          <div v-if="selected" class="issue-detail">
            <h3>{{ selected.subtype }}</h3>
            <p>{{ selected.description }}</p>
            <dl>
              <div><dt>位置</dt><dd>{{ selected.town }} / {{ selected.village }}</dd></div>
              <div><dt>上报人</dt><dd>{{ selected.contact }} · {{ selected.phone }}</dd></div>
              <div><dt>紧急程度</dt><dd>{{ selected.urgency }}</dd></div>
              <div><dt>当前状态</dt><dd>{{ selected.status }}</dd></div>
            </dl>
          </div>
          <p v-else class="empty-state">请选择一个问题</p>
        </PanelCard>

        <PanelCard title="状态更新" meta="处置闭环">
          <div class="status-actions">
            <button v-for="status in (['待审核', '已派单', '处理中', '已办结'] as IssueStatus[])" :key="status" :class="{ active: selected?.status === status }" type="button" @click="updateStatus(status)">{{ status }}</button>
          </div>
          <button class="action-button export-button" type="button" @click="exportIssues">导出当前问题清单</button>
        </PanelCard>
      </aside>
    </div>
    <Transition name="module"><div v-if="toast" class="toast">{{ toast }}</div></Transition>
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

.governance-left { grid-template-rows: 270px minmax(0, 1fr); }
.governance-center { grid-template-rows: minmax(380px, 1fr) 205px; }
.governance-right { grid-template-rows: minmax(230px, 1.1fr) minmax(210px, 1fr) 160px; }

.overview-grid { grid-template-columns: repeat(3, 1fr); }
.overview-grid .metric-card { padding: 10px 7px; text-align: center; }
.overview-grid .metric-card strong { font-size: 22px; }
.overview-grid .urgent strong { color: var(--red); }

.reset-button { margin-left: 10px; padding: 3px 8px; color: var(--text-soft); font-size: 9px; }

.filter-list {
  display: grid;
  gap: 9px;
}

.filter-list label { display: grid; gap: 4px; }
.filter-list span { color: var(--text-soft); font-size: 9px; }
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

.status-visual {
  display: grid;
  align-items: center;
  height: 100%;
  grid-template-columns: 112px 1fr;
}

.status-donut {
  display: grid;
  place-content: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: conic-gradient(var(--cyan) var(--rate), rgba(255, 255, 255, 0.06) 0);
  box-shadow: inset 0 0 0 15px #10201f;
  text-align: center;
}

.status-donut strong { font: 18px var(--font-data); }
.status-donut span { color: var(--text-soft); font-size: 8px; }
.status-visual ul { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.status-visual li { display: flex; gap: 6px; color: var(--text-soft); font-size: 9px; }
.status-visual li i { width: 7px; height: 7px; margin-top: 2px; border-radius: 50%; }
.status-visual li b { margin-left: auto; color: var(--text); }

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
.issue-list button.active { border-color: var(--line-bright); background: rgba(61, 214, 196, 0.08); }
.issue-list button > i { width: 3px; height: 28px; border-radius: 2px; }
.issue-list button span { display: grid; gap: 4px; padding-left: 8px; }
.issue-list button strong { font-size: 10px; font-weight: 600; }
.issue-list button small { color: var(--text-soft); font-size: 8px; }
.issue-list button em { display: grid; place-content: center; width: 20px; height: 20px; font: normal 9px var(--font-data); border-radius: 50%; }
.urgency-高 { color: #ffd6d1; background: rgba(231, 116, 104, 0.24); }
.urgency-中 { color: #ffe3ad; background: rgba(240, 184, 92, 0.2); }
.urgency-低 { color: #cfe2dd; background: rgba(109, 169, 237, 0.14); }

.issue-detail h3 { margin: 0; color: var(--cyan); font-size: 15px; }
.issue-detail p { margin: 8px 0; color: var(--text-soft); font-size: 10px; line-height: 1.6; }
.issue-detail dl { display: grid; gap: 5px; margin: 0; }
.issue-detail dl div { display: flex; padding: 5px 0; border-bottom: 1px solid rgba(122, 203, 190, 0.08); }
.issue-detail dt { width: 55px; color: var(--text-soft); font-size: 9px; }
.issue-detail dd { margin: 0; font-size: 9px; }

.status-actions { display: grid; gap: 5px; grid-template-columns: repeat(2, 1fr); }
.status-actions button { height: 28px; color: var(--text-soft); border: 1px solid var(--line); border-radius: 4px; background: rgba(255, 255, 255, 0.025); font-size: 9px; cursor: pointer; }
.status-actions button.active { color: var(--cyan); border-color: var(--line-bright); background: rgba(61, 214, 196, 0.12); }
.export-button { width: 100%; height: 28px; margin-top: 7px; font-size: 9px; }
.empty-state { color: var(--text-soft); font-size: 10px; text-align: center; }

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

@media (max-width: 1440px) {
  .governance-layout { grid-template-columns: 258px minmax(470px, 1fr) 290px; gap: 8px; }
  .governance-left, .governance-center, .governance-right { gap: 8px; }
  .governance-left { grid-template-rows: 245px minmax(0, 1fr); }
  .governance-center { grid-template-rows: minmax(350px, 1fr) 175px; }
  .governance-right { grid-template-rows: minmax(210px, 1.1fr) minmax(190px, 1fr) 145px; }
}
</style>
