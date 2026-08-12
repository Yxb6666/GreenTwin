<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DemSummary } from './demService'

const props = defineProps<{
  summary: DemSummary | null
  loading: boolean
  error: string
}>()

const isTerrainExpanded = ref(false)

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
  return `${props.summary.fileName} · ${props.summary.width}×${props.summary.height} · ${props.summary.crs}`
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
      <span v-if="!isTerrainExpanded" class="terrain-drawer__metrics" aria-label="地形概况">
        <span>抽样平均 <b>{{ averageElevation }}</b></span>
        <span>抽样范围 <b>{{ elevationRange }}</b></span>
        <span>抽样高差 <b>{{ differenceLabel }}</b></span>
      </span>
      <span class="terrain-drawer__action">{{ isTerrainExpanded ? '收起' : '展开' }} <i aria-hidden="true">{{ isTerrainExpanded ? '↓' : '↑' }}</i></span>
    </button>

    <div id="terrain-drawer-content" class="terrain-drawer__content" :aria-hidden="!isTerrainExpanded">
      <div class="terrain-drawer__body">
        <div class="terrain-dem-panel">
          <figure class="terrain-preview">
            <img v-if="summary?.thumbnailUrl" :src="summary.thumbnailUrl" alt="兰考县 DEM 灰度地形数据预览" />
            <div v-else class="terrain-state">
              {{ loading ? '正在读取 DEM 栅格…' : error || '暂无 DEM 预览' }}
            </div>
          </figure>
          <div v-if="summary" class="terrain-dem-legend" aria-label="DEM 灰度高程图例">
            <span>{{ summary.minimumElevationM ?? '—' }}m</span>
            <i />
            <span>{{ summary.maximumElevationM ?? '—' }}m</span>
          </div>
        </div>

        <aside class="terrain-indicators" aria-label="DEM 地形指标">
          <div class="terrain-stat-grid">
            <article><span>抽样平均高程</span><strong>{{ averageElevation }}</strong></article>
            <article><span>抽样高程范围</span><strong>{{ elevationRange }}</strong></article>
            <article><span>抽样最大高差</span><strong>{{ differenceLabel }}</strong></article>
            <article><span>像元分辨率</span><strong>{{ summary ? `${summary.pixelSizeDegrees.toFixed(6)}°` : '—' }}</strong></article>
          </div>
          <p>当前统计基于 <b>{{ summary?.validSampleCount ?? 0 }}</b> 个有效抽样点，不代表全量 DEM 像元统计。</p>
        </aside>
      </div>

      <footer class="terrain-drawer__source">
        <span>数据源</span><strong>{{ sourceMeta }}</strong>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.terrain-drawer {
  width: 100%;
  max-width: none;
  height: 48px;
  min-width: 0;
  overflow: hidden;
  border-color: rgba(61, 214, 196, 0.25);
  background: rgba(5, 32, 29, 0.96);
  box-shadow: 0 -8px 26px rgba(2, 18, 16, 0.16);
  transition: height 240ms ease;
}

.terrain-drawer.is-expanded {
  height: 430px;
}

.terrain-drawer__summary {
  display: grid;
  width: 100%;
  height: 52px;
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

.is-expanded .terrain-drawer__summary {
  grid-template-columns: minmax(0, 1fr) auto;
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
  font-size: 10px;
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
  display: grid;
  height: 378px;
  min-height: 0;
  padding: 0 12px 8px;
  opacity: 0;
  pointer-events: none;
  grid-template-rows: minmax(0, 1fr) 28px;
  transition: opacity 140ms ease;
}

.is-expanded .terrain-drawer__content {
  opacity: 1;
  pointer-events: auto;
  transition-delay: 80ms;
}

.terrain-drawer__body {
  display: grid;
  min-height: 0;
  gap: 12px;
  padding: 10px 0 8px;
  border-top: 1px solid rgba(61, 214, 196, 0.1);
  grid-template-columns: minmax(0, 72fr) minmax(220px, 28fr);
}

.terrain-dem-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
}

.terrain-preview {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  margin: 0;
  overflow: hidden;
  padding: 10px 12px;
  border: 1px solid rgba(61, 214, 196, 0.14);
  background: #031513;
}

.terrain-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.terrain-state {
  display: grid;
  height: 100%;
  place-items: center;
  color: #8fa69f;
  font-size: 10px;
}

.terrain-dem-legend {
  display: flex;
  height: 26px;
  flex: 0 0 26px;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
  color: #9cafaa;
  font: 9px var(--font-data);
}

.terrain-dem-legend i {
  height: 7px;
  flex: 1;
  border: 1px solid rgba(226, 237, 233, 0.12);
  border-radius: 999px;
  background: linear-gradient(90deg, #263733, #66756f, #abb7b2, #edf3f0);
}

.terrain-indicators {
  display: grid;
  min-width: 0;
  min-height: 0;
  gap: 9px;
  grid-template-rows: minmax(0, 1fr) auto;
}

.terrain-stat-grid {
  display: grid;
  min-width: 0;
  min-height: 0;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
}

.terrain-stat-grid article {
  display: grid;
  min-width: 0;
  min-height: 0;
  place-content: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(61, 214, 196, 0.16);
  background: rgba(8, 42, 37, 0.52);
  text-align: center;
}

.terrain-stat-grid span {
  color: #8fa69f;
  font-size: 12px;
  white-space: nowrap;
}

.terrain-stat-grid strong {
  overflow: hidden;
  color: #3dd6c4;
  font: 600 24px var(--font-data);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terrain-indicators p {
  margin: 0;
  color: #839b94;
  font-size: 10px;
  line-height: 1.45;
  text-align: center;
}

.terrain-indicators p b {
  color: #b9cbc5;
  font-family: var(--font-data);
}

.terrain-drawer__source {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: #718b84;
  border-top: 1px solid rgba(61, 214, 196, 0.08);
  font-size: 10px;
}

.terrain-drawer__source strong {
  overflow: hidden;
  color: #92a7a0;
  font: 10px var(--font-data);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1440px) {
  .terrain-drawer.is-expanded {
    height: 380px;
  }

  .terrain-drawer__content {
    height: 328px;
  }

  .terrain-drawer__body {
    gap: 10px;
    grid-template-columns: minmax(0, 65fr) minmax(220px, 35fr);
  }

  .terrain-stat-grid {
    gap: 7px;
  }

  .terrain-stat-grid article {
    gap: 6px;
    padding: 7px;
  }

  .terrain-stat-grid span {
    font-size: 10px;
  }

  .terrain-stat-grid strong {
    font-size: 17px;
  }
}

@media (max-width: 1050px) {
  .terrain-drawer__metrics span:nth-child(2) {
    display: none;
  }

  .terrain-drawer__body {
    grid-template-columns: minmax(0, 1fr) 220px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .terrain-drawer,
  .terrain-drawer__content {
    transition: none;
  }
}
</style>
