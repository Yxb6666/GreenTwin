<script setup lang="ts">
import { computed } from 'vue'
import type { IsochroneProfile } from './isochrone'
import type { HousingCoverageSummary } from './housingCoverage'

const props = defineProps<{
  phase: 'idle' | 'picking' | 'loading' | 'complete' | 'error'
  profile: IsochroneProfile
  minutes: number[]
  coverage: HousingCoverageSummary | null
  buildingDataReady: boolean
  stale: boolean
}>()

const profileLabel = computed(() =>
  props.profile === 'walking'
    ? '步行'
    : props.profile === 'cycling'
      ? '骑行'
      : '驾车',
)
const outerMinute = computed(() => Math.max(...props.minutes))
const maxHomes = computed(() => Math.max(1, props.coverage?.totalHomes ?? 1))
const statusLabel = computed(() => {
  if (!props.buildingDataReady) return '建筑数据加载中'
  if (props.phase === 'loading') return '正在统计服务覆盖'
  if (props.phase === 'picking') return '等待地图落点'
  if (props.phase === 'error') return '分析暂不可用'
  if (props.stale) return '参数已变更，待重新分析'
  if (props.coverage) return '空间统计完成'
  return '生成服务圈后显示结果'
})

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatArea(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
</script>

<template>
  <div class="housing-coverage">
    <div class="coverage-context">
      <span><i />当前分析</span>
      <strong>{{ profileLabel }} · {{ minutes.join('/') }} 分钟</strong>
    </div>

    <div class="coverage-hero" :class="{ 'is-empty': !coverage || stale }">
      <div>
        <span>{{ outerMinute }} 分钟服务覆盖住房</span>
        <strong>{{
          coverage && !stale ? formatNumber(coverage.totalHomes) : '—'
        }}</strong>
        <small>户</small>
      </div>
      <div class="coverage-ring" aria-hidden="true">
        <span>{{
          coverage && !stale
            ? `${Math.round(coverage.bands.at(-1)?.coverageRate ?? 0)}%`
            : '--'
        }}</span>
      </div>
    </div>

    <div class="coverage-kpis">
      <div>
        <span>住宅建筑</span>
        <strong
          >{{ coverage && !stale ? formatNumber(coverage.totalBuildings) : '—'
          }}<small> 栋</small></strong
        >
      </div>
      <div>
        <span>服务人口</span>
        <strong
          >{{ coverage && !stale ? formatNumber(coverage.totalResidents) : '—'
          }}<small> 人</small></strong
        >
      </div>
      <div>
        <span>覆盖面积</span>
        <strong
          >{{ coverage && !stale ? formatArea(coverage.totalCoverageArea) : '—'
          }}<small> km²</small></strong
        >
      </div>
    </div>

    <div class="coverage-bands">
      <div class="coverage-heading">
        <strong>分圈层覆盖</strong><small>累计统计</small>
      </div>
      <div v-if="coverage && !stale" class="coverage-band-list">
        <div
          v-for="band in coverage.bands"
          :key="band.minute"
          class="coverage-band"
        >
          <span>{{ band.minute }}<small>分钟</small></span>
          <div>
            <i :style="{ width: `${(band.homes / maxHomes) * 100}%` }" />
          </div>
          <strong>{{ formatNumber(band.homes) }} 户</strong>
        </div>
      </div>
      <div v-else class="coverage-placeholder">
        <i v-for="minute in minutes" :key="minute" />
      </div>
    </div>

    <div class="coverage-note" :class="{ active: coverage && !stale }">
      <i />
      <span>{{ statusLabel }}</span>
    </div>
    <p>基于建筑白模中心点、占地面积与层高估算，结果用于方案比选。</p>
  </div>
</template>

<style scoped>
.housing-coverage {
  display: grid;
  gap: 8px;
}

.coverage-context,
.coverage-heading,
.coverage-note {
  display: flex;
  align-items: center;
}

.coverage-context {
  padding-bottom: 6px;
  color: var(--text-soft);
  border-bottom: 1px solid rgba(122, 203, 190, 0.12);
  font-size: 8px;
}

.coverage-context span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.coverage-context i,
.coverage-note i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 7px rgba(61, 214, 196, 0.75);
}

.coverage-context strong {
  margin-left: auto;
  color: var(--cyan);
  font: 9px var(--font-data);
}

.coverage-hero {
  display: grid;
  align-items: center;
  min-height: 88px;
  padding: 11px 14px;
  border: 1px solid rgba(61, 214, 196, 0.28);
  border-radius: 8px;
  background:
    radial-gradient(
      circle at 86% 48%,
      rgba(61, 214, 196, 0.16),
      transparent 28%
    ),
    linear-gradient(120deg, rgba(61, 214, 196, 0.12), rgba(61, 214, 196, 0.02));
  grid-template-columns: 1fr 60px;
}

.coverage-hero.is-empty {
  border-color: rgba(122, 203, 190, 0.13);
  filter: saturate(0.55);
}

.coverage-hero > div:first-child {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
}

.coverage-hero span {
  width: 100%;
  margin-bottom: 4px;
  color: var(--text-soft);
  font-size: 8px;
}

.coverage-hero strong {
  color: var(--text);
  font: 30px/1 var(--font-data);
  letter-spacing: -1px;
}

.coverage-hero small {
  margin-left: 5px;
  color: var(--cyan);
  font-size: 9px;
}

.coverage-ring {
  display: grid;
  width: 56px;
  height: 56px;
  place-content: center;
  border: 5px solid rgba(61, 214, 196, 0.14);
  border-top-color: var(--cyan);
  border-right-color: rgba(61, 214, 196, 0.64);
  border-radius: 50%;
  box-shadow: inset 0 0 16px rgba(61, 214, 196, 0.08);
}

.coverage-ring span {
  width: auto;
  margin: 0;
  color: var(--cyan);
  font: 12px var(--font-data);
}

.coverage-kpis {
  display: grid;
  gap: 7px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.coverage-kpis > div {
  display: grid;
  min-width: 0;
  padding: 7px;
  gap: 4px;
  border: 1px solid rgba(122, 203, 190, 0.13);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
}

.coverage-kpis span,
.coverage-heading small {
  color: var(--text-soft);
  font-size: 8px;
}

.coverage-kpis strong {
  color: var(--text);
  font: 14px var(--font-data);
  white-space: nowrap;
}

.coverage-kpis small {
  color: var(--text-soft);
  font-size: 8px;
}

.coverage-bands {
  display: grid;
  gap: 6px;
}

.coverage-heading strong {
  font-size: 9px;
}

.coverage-heading small {
  margin-left: auto;
}

.coverage-band-list {
  display: grid;
  gap: 8px;
}

.coverage-band {
  display: grid;
  align-items: center;
  gap: 7px;
  grid-template-columns: 42px 1fr 58px;
}

.coverage-band > span,
.coverage-band > strong {
  font: 9px var(--font-data);
}

.coverage-band > span small {
  margin-left: 2px;
  color: var(--text-soft);
  font-size: 7px;
}

.coverage-band > div {
  height: 5px;
  overflow: hidden;
  border-radius: 99px;
  background: rgba(122, 203, 190, 0.1);
}

.coverage-band > div i {
  display: block;
  height: 100%;
  min-width: 4px;
  border-radius: inherit;
  background: linear-gradient(90deg, #2f8d91, var(--cyan));
  box-shadow: 0 0 8px rgba(61, 214, 196, 0.32);
}

.coverage-band > strong {
  text-align: right;
}

.coverage-placeholder {
  display: grid;
  gap: 7px;
}

.coverage-placeholder i {
  width: 100%;
  height: 5px;
  border-radius: 99px;
  background: linear-gradient(
    90deg,
    rgba(122, 203, 190, 0.12),
    rgba(122, 203, 190, 0.025)
  );
}

.coverage-note {
  min-height: 28px;
  padding: 6px 8px;
  gap: 7px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.1);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.018);
  font-size: 8px;
}

.coverage-note:not(.active) i {
  background: var(--amber);
  box-shadow: 0 0 7px rgba(240, 184, 92, 0.65);
}

.housing-coverage > p {
  margin: 0;
  color: rgba(154, 183, 176, 0.72);
  font-size: 7px;
  line-height: 1.5;
}

@media (max-height: 800px) {
  .housing-coverage {
    gap: 7px;
  }
  .coverage-hero {
    min-height: 78px;
    padding-block: 9px;
  }
  .coverage-kpis > div {
    padding-block: 6px;
  }
}
</style>
