<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DemSummary } from './demService'

type TerrainTab = 'elevation' | 'slope' | 'hillshade' | 'statistics'

const props = defineProps<{
  summary: DemSummary | null
  loading: boolean
  error: string
}>()

const isTerrainExpanded = ref(false)
const activeTab = ref<TerrainTab>('elevation')
const terrainTabs: Array<{ key: TerrainTab; label: string; pending?: boolean }> = [
  { key: 'elevation', label: '高程分析' },
  { key: 'slope', label: '坡度分析', pending: true },
  { key: 'hillshade', label: '地形晕渲', pending: true },
  { key: 'statistics', label: '地形统计' },
]

const elevationDifference = computed(() => {
  const minimum = props.summary?.minimumElevationM
  const maximum = props.summary?.maximumElevationM
  return minimum == null || maximum == null
    ? null
    : Number((maximum - minimum).toFixed(1))
})
const averageElevation = computed(() =>
  props.summary?.averageElevationM == null
    ? '—'
    : `${props.summary.averageElevationM.toFixed(1)} m`,
)
const elevationRange = computed(() => {
  const minimum = props.summary?.minimumElevationM
  const maximum = props.summary?.maximumElevationM
  return minimum == null || maximum == null ? '—' : `${minimum}–${maximum} m`
})
const differenceLabel = computed(() =>
  elevationDifference.value == null ? '—' : `${elevationDifference.value} m`,
)
const sourceMeta = computed(() => {
  if (!props.summary) return 'SuperMap 影像服务 · 元数据读取中'
  return `${props.summary.fileName} · ${props.summary.width}×${props.summary.height} · ${props.summary.crs} · ${props.summary.pixelSizeDegrees.toFixed(6)}°`
})

function toggleTerrain() {
  isTerrainExpanded.value = !isTerrainExpanded.value
}
</script>

<template>
  <section
    class="terrain-drawer panel-frame"
    :class="{ 'is-expanded': isTerrainExpanded }"
    aria-label="兰考县地形分析"
  >
    <button
      class="terrain-drawer__summary"
      type="button"
      :aria-expanded="isTerrainExpanded"
      aria-controls="terrain-drawer-content"
      @click="toggleTerrain"
    >
      <span class="terrain-drawer__title">
        <i aria-hidden="true">{{ isTerrainExpanded ? '▴' : '▾' }}</i>
        <strong>{{ isTerrainExpanded ? '地形分析（DEM）' : '地形分析' }}</strong>
        <small>兰考县</small>
      </span>
      <span class="terrain-drawer__metrics" aria-label="地形概况">
        <span>抽样平均高程 <b>{{ averageElevation }}</b></span>
        <span>抽样高程范围 <b>{{ elevationRange }}</b></span>
        <span>抽样最大高差 <b>{{ differenceLabel }}</b></span>
      </span>
      <span class="terrain-drawer__action">{{ isTerrainExpanded ? '收起' : '展开' }} <i aria-hidden="true">{{ isTerrainExpanded ? '↓' : '↑' }}</i></span>
    </button>

    <div id="terrain-drawer-content" class="terrain-drawer__content" :aria-hidden="!isTerrainExpanded">
      <nav class="terrain-drawer__tabs" aria-label="地形分析类型">
        <button
          v-for="tab in terrainTabs"
          :key="tab.key"
          type="button"
          :class="{ 'is-active': activeTab === tab.key }"
          :aria-pressed="activeTab === tab.key"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}<small v-if="tab.pending">待接入</small>
        </button>
      </nav>

      <div v-if="activeTab === 'elevation'" class="terrain-analysis-grid">
        <figure class="terrain-preview">
          <img v-if="summary?.thumbnailUrl" :src="summary.thumbnailUrl" alt="兰考县 DEM 高程数据预览" />
          <div v-else class="terrain-state">
            {{ loading ? '正在读取 DEM 栅格…' : error || '暂无 DEM 预览' }}
          </div>
          <div v-if="summary" class="terrain-preview__legend" aria-label="抽样高程图例">
            <span>{{ summary.minimumElevationM ?? '—' }}m</span>
            <i />
            <span>{{ summary.maximumElevationM ?? '—' }}m</span>
          </div>
          <figcaption v-if="summary">
            <span>真实服务预览</span><em>有效抽样 {{ summary.validSampleCount }} 点</em>
          </figcaption>
        </figure>

        <div class="terrain-stat-grid">
          <article><span>抽样平均高程</span><strong>{{ averageElevation }}</strong></article>
          <article><span>抽样高程范围</span><strong>{{ elevationRange }}</strong></article>
          <article><span>抽样最大高差</span><strong>{{ differenceLabel }}</strong></article>
          <article><span>像元分辨率</span><strong>{{ summary ? `${summary.pixelSizeDegrees.toFixed(6)}°` : '—' }}</strong></article>
        </div>

        <aside class="terrain-distribution">
          <header><span>高程分布</span><small>数据状态</small></header>
          <div class="terrain-distribution__empty">
            <i aria-hidden="true">⌁</i>
            <strong>暂无真实高程频数统计</strong>
            <span>当前仅展示 {{ summary?.validSampleCount ?? 0 }} 个有效抽样点的汇总结果，不将抽样值冒充全量像元分布。</span>
          </div>
        </aside>
      </div>

      <div v-else-if="activeTab === 'statistics'" class="terrain-statistics-view">
        <div class="terrain-stat-grid is-wide">
          <article><span>抽样平均高程</span><strong>{{ averageElevation }}</strong></article>
          <article><span>抽样高程范围</span><strong>{{ elevationRange }}</strong></article>
          <article><span>抽样最大高差</span><strong>{{ differenceLabel }}</strong></article>
          <article><span>有效抽样点</span><strong>{{ summary?.validSampleCount ?? '—' }}</strong></article>
        </div>
        <p>统计口径：基于 SuperMap DEM 服务当前返回的有效抽样点，不代表全县 DEM 全量像元统计。</p>
      </div>

      <div v-else class="terrain-pending-state" role="status">
        <i aria-hidden="true">◇</i>
        <strong>{{ activeTab === 'slope' ? '尚未生成坡度分析结果' : '待接入地形晕渲结果' }}</strong>
        <span>{{ activeTab === 'slope' ? '可基于现有 DEM 计算坡度后接入，本次不生成模拟数据。' : '当前没有独立的 Hillshade 分析成果，本次不使用虚假效果图。' }}</span>
      </div>

      <footer class="terrain-drawer__source">
        <span>数据源</span><strong>{{ sourceMeta }}</strong>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.terrain-drawer {
  height: 48px;
  min-width: 0;
  overflow: hidden;
  border-color: rgba(61, 214, 196, 0.25);
  background: rgba(5, 32, 29, 0.96);
  box-shadow: 0 -8px 26px rgba(2, 18, 16, 0.16);
  transition: height 240ms ease;
}

.terrain-drawer.is-expanded {
  height: 285px;
}

.terrain-drawer__summary {
  display: grid;
  width: 100%;
  height: 46px;
  align-items: center;
  gap: 16px;
  padding: 0 14px;
  color: #eef5ee;
  border: 0;
  background: transparent;
  cursor: pointer;
  grid-template-columns: auto minmax(0, 1fr) auto;
  text-align: left;
}

.terrain-drawer__summary:hover,
.terrain-drawer__summary:focus-visible {
  background: rgba(61, 214, 196, 0.045);
  outline: none;
}

.terrain-drawer__title,
.terrain-drawer__metrics,
.terrain-drawer__metrics span,
.terrain-drawer__action {
  display: flex;
  align-items: center;
}

.terrain-drawer__title {
  gap: 7px;
  white-space: nowrap;
}

.terrain-drawer__title > i {
  color: #3dd6c4;
  font-style: normal;
}

.terrain-drawer__title strong {
  font: 600 13px var(--font-display);
}

.terrain-drawer__title small {
  color: #78938b;
  font-size: 9px;
}

.terrain-drawer__metrics {
  min-width: 0;
  justify-content: center;
  overflow: hidden;
  color: #8fa69f;
  font-size: 9px;
  white-space: nowrap;
}

.terrain-drawer__metrics span {
  gap: 5px;
  padding: 0 12px;
  border-right: 1px solid rgba(108, 153, 144, 0.18);
}

.terrain-drawer__metrics span:last-child {
  border-right: 0;
}

.terrain-drawer__metrics b {
  color: #3dd6c4;
  font: 600 10px var(--font-data);
}

.terrain-drawer__action {
  gap: 5px;
  color: #b6cbc4;
  font-size: 10px;
  white-space: nowrap;
}

.terrain-drawer__action i {
  color: #3dd6c4;
  font-style: normal;
}

.terrain-drawer__content {
  position: relative;
  display: grid;
  height: 237px;
  min-height: 0;
  padding: 0 12px 8px;
  opacity: 0;
  pointer-events: none;
  grid-template-rows: 34px minmax(0, 1fr) 22px;
  transition: opacity 140ms ease;
}

.is-expanded .terrain-drawer__content {
  opacity: 1;
  pointer-events: auto;
  transition-delay: 80ms;
}

.terrain-drawer__tabs {
  display: flex;
  align-items: end;
  gap: 4px;
  border-top: 1px solid rgba(61, 214, 196, 0.1);
  border-bottom: 1px solid rgba(61, 214, 196, 0.12);
}

.terrain-drawer__tabs button {
  position: relative;
  height: 33px;
  padding: 0 11px;
  color: #8fa69f;
  border: 0;
  background: transparent;
  font-size: 9px;
  cursor: pointer;
}

.terrain-drawer__tabs button::after {
  position: absolute;
  right: 9px;
  bottom: -1px;
  left: 9px;
  height: 2px;
  background: transparent;
  content: '';
}

.terrain-drawer__tabs button.is-active {
  color: #eef5ee;
}

.terrain-drawer__tabs button.is-active::after {
  background: #3dd6c4;
}

.terrain-drawer__tabs small {
  margin-left: 5px;
  color: #708a83;
  font-size: 7px;
}

.terrain-analysis-grid {
  display: grid;
  min-height: 0;
  gap: 10px;
  padding: 8px 0;
  grid-template-columns: minmax(260px, 330px) minmax(190px, 220px) minmax(210px, 1fr);
}

.terrain-preview {
  position: relative;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(61, 214, 196, 0.14);
  background: linear-gradient(135deg, #0b302b, #061d1b);
}

.terrain-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: sepia(0.18) saturate(1.25) hue-rotate(84deg) contrast(1.12);
}

.terrain-preview::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(3, 24, 21, 0.12), transparent 50%, rgba(5, 29, 26, 0.2));
  content: '';
  pointer-events: none;
}

.terrain-state {
  display: grid;
  height: 100%;
  place-items: center;
  color: #8fa69f;
  font-size: 10px;
}

.terrain-preview__legend,
.terrain-preview figcaption {
  position: absolute;
  z-index: 1;
  right: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  color: #dcebe6;
  background: rgba(4, 28, 25, 0.76);
  backdrop-filter: blur(4px);
  font: 8px var(--font-data);
}

.terrain-preview__legend {
  bottom: 28px;
  gap: 7px;
  padding: 4px 7px;
}

.terrain-preview__legend i {
  height: 5px;
  flex: 1;
  border-radius: 2px;
  background: linear-gradient(90deg, #1f6f61, #4daf7c, #8bcb78, #d7d783);
}

.terrain-preview figcaption {
  bottom: 6px;
  justify-content: space-between;
  padding: 4px 7px;
  color: #94aaa3;
}

.terrain-preview figcaption span {
  color: #3dd6c4;
}

.terrain-preview figcaption em {
  font-style: normal;
}

.terrain-stat-grid {
  display: grid;
  min-width: 0;
  gap: 6px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.terrain-stat-grid article {
  display: grid;
  min-width: 0;
  place-content: center;
  gap: 5px;
  padding: 6px;
  border: 1px solid rgba(61, 214, 196, 0.1);
  background: rgba(255, 255, 255, 0.018);
  text-align: center;
}

.terrain-stat-grid span {
  color: #8fa69f;
  font-size: 8px;
  white-space: nowrap;
}

.terrain-stat-grid strong {
  overflow: hidden;
  color: #3dd6c4;
  font: 600 13px var(--font-data);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terrain-distribution {
  display: grid;
  min-width: 0;
  border: 1px solid rgba(61, 214, 196, 0.1);
  grid-template-rows: 27px minmax(0, 1fr);
}

.terrain-distribution header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 9px;
  color: #dcebe6;
  border-bottom: 1px solid rgba(61, 214, 196, 0.09);
  font-size: 9px;
}

.terrain-distribution header small {
  color: #708a83;
  font-size: 8px;
}

.terrain-distribution__empty,
.terrain-pending-state {
  display: grid;
  min-height: 0;
  place-content: center;
  gap: 5px;
  padding: 10px;
  color: #829a93;
  text-align: center;
}

.terrain-distribution__empty > i,
.terrain-pending-state > i {
  color: #3dd6c4;
  font: normal 18px var(--font-data);
}

.terrain-distribution__empty strong,
.terrain-pending-state strong {
  color: #c7d8d2;
  font-size: 9px;
}

.terrain-distribution__empty span,
.terrain-pending-state span {
  max-width: 260px;
  font-size: 8px;
  line-height: 1.5;
}

.terrain-statistics-view {
  display: grid;
  min-height: 0;
  gap: 9px;
  padding: 12px 0;
  grid-template-rows: minmax(0, 1fr) auto;
}

.terrain-stat-grid.is-wide {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.terrain-statistics-view p {
  margin: 0;
  color: #829a93;
  font-size: 8px;
  text-align: center;
}

.terrain-drawer__source {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: #718b84;
  border-top: 1px solid rgba(61, 214, 196, 0.08);
  font-size: 8px;
}

.terrain-drawer__source strong {
  overflow: hidden;
  color: #92a7a0;
  font: 8px var(--font-data);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1440px) {
  .terrain-drawer__metrics span:nth-child(2) {
    display: none;
  }

  .terrain-analysis-grid {
    grid-template-columns: minmax(260px, 330px) minmax(180px, 1fr);
  }

  .terrain-distribution {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .terrain-drawer,
  .terrain-drawer__content {
    transition: none;
  }
}
</style>
