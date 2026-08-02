<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import RadarChart from '@/shared/components/RadarChart.vue'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useLeafletMap } from '@/gis/leaflet/useLeafletMap'
import { dimensionMeta, scoreTown, towns, type DimensionKey } from './model'

const config = useRuntimeConfig()
const mapContainer = ref<HTMLElement | null>(null)
const activeDimension = ref<DimensionKey>('ecology')
const selectedTownId = ref('yifeng')
const report = ref('')
const weights = ref<Record<DimensionKey, number>>({ ecology: 34, life: 33, production: 33 })
const { error: mapError, initialize } = useLeafletMap(mapContainer)

const scoredTowns = computed(() =>
  towns
    .map((town) => ({ ...town, scores: scoreTown(town, weights.value) }))
    .sort((a, b) => b.scores.composite - a.scores.composite),
)
const selectedTown = computed(() => scoredTowns.value.find((town) => town.id === selectedTownId.value) ?? scoredTowns.value[0]!)
const currentIndicators = computed(() => dimensionMeta[activeDimension.value].indicators)
const countyScores = computed(() => {
  const total = scoredTowns.value.reduce(
    (sum, town) => ({
      ecology: sum.ecology + town.scores.ecology,
      life: sum.life + town.scores.life,
      production: sum.production + town.scores.production,
      composite: sum.composite + town.scores.composite,
    }),
    { ecology: 0, life: 0, production: 0, composite: 0 },
  )
  const count = scoredTowns.value.length
  return Object.fromEntries(Object.entries(total).map(([key, value]) => [key, Number((value / count).toFixed(1))])) as Record<
    DimensionKey | 'composite',
    number
  >
})

function resetWeights() {
  weights.value = { ecology: 34, life: 33, production: 33 }
}

function generateReport() {
  const town = selectedTown.value
  const scores = town.scores
  const entries = [
    ['生态', scores.ecology],
    ['生活', scores.life],
    ['生产', scores.production],
  ] as const
  const strongest = [...entries].sort((a, b) => b[1] - a[1])[0]!
  const weakest = [...entries].sort((a, b) => a[1] - b[1])[0]!
  report.value = `${town.name}三生综合指数为 ${scores.composite}，优势维度为${strongest[0]}（${strongest[1]}），当前短板为${weakest[0]}（${weakest[1]}）。建议优先围绕短板指标配置治理项目，并保持优势空间连续性。`
}

function exportReport() {
  if (!report.value) generateReport()
  const blob = new Blob([report.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${selectedTown.value.name}-三生空间评价.txt`
  anchor.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await initialize(config.supermap.leafletSdkUrl, config.supermap.mapServices.base, config.map.center, config.map.zoom, config.map.crs)
})
</script>

<template>
  <main class="screen-page sansheng-page">
    <ScreenHeader
      title="三生空间综合分析模块"
      subtitle="指标建模 / 权重推演 / 空间评价 / 优势短板识别"
    />

    <div class="sansheng-layout">
      <aside class="sansheng-left">
        <PanelCard title="三生指标体系" meta="15 项指标">
          <div class="dimension-tabs segmented">
            <button
              v-for="(meta, key) in dimensionMeta"
              :key="key"
              :class="{ active: activeDimension === key }"
              type="button"
              @click="activeDimension = key"
            >{{ meta.label }}</button>
          </div>
          <div class="indicator-list">
            <article v-for="indicator in currentIndicators" :key="indicator.key">
              <span>{{ indicator.name }}</span>
              <em>{{ indicator.direction === 'positive' ? '正向' : indicator.direction === 'negative' ? '负向' : '适中' }}</em>
              <b>{{ indicator.weight * 100 }}%</b>
            </article>
          </div>
        </PanelCard>

        <PanelCard title="权重配置" meta="自动归一化">
          <div class="weight-list">
            <label v-for="(meta, key) in dimensionMeta" :key="key">
              <span>{{ meta.label }}</span>
              <input v-model.number="weights[key]" type="range" min="0" max="100" />
              <b>{{ weights[key] }}%</b>
            </label>
          </div>
          <div class="weight-total">原始权重合计 <strong>{{ weights.ecology + weights.life + weights.production }}%</strong></div>
          <button class="action-button full-button" type="button" @click="resetWeights">恢复默认权重</button>
        </PanelCard>
      </aside>

      <section class="sansheng-center">
        <section class="map-shell panel-frame sansheng-map">
          <div ref="mapContainer" class="map-container" />
          <div v-if="mapError" class="map-error">{{ mapError }}</div>
        </section>

        <PanelCard title="评价明细" :meta="selectedTown.name">
          <table class="indicator-table">
            <thead><tr><th>指标维度</th><th>指标名称</th><th>原始值</th><th>评价方向</th></tr></thead>
            <tbody>
              <tr v-for="indicator in currentIndicators" :key="indicator.key">
                <td>{{ dimensionMeta[activeDimension].label }}</td>
                <td>{{ indicator.name }}</td>
                <td>{{ selectedTown[activeDimension][indicator.key] }} {{ indicator.unit }}</td>
                <td>{{ indicator.direction === 'positive' ? '正向' : indicator.direction === 'negative' ? '负向' : '适中最优' }}</td>
              </tr>
            </tbody>
          </table>
        </PanelCard>
      </section>

      <aside class="sansheng-right">
        <PanelCard title="三生综合指数" :meta="selectedTown.name">
          <div class="score-summary">
            <div class="score-orbit"><strong>{{ selectedTown.scores.composite }}</strong><span>综合指数</span></div>
            <RadarChart
              :labels="['生态', '生活', '生产']"
              :values="[selectedTown.scores.ecology, selectedTown.scores.life, selectedTown.scores.production]"
            />
          </div>
          <div class="county-strip">
            <span>县域均值</span><b>{{ countyScores.composite }}</b>
            <span>当前排名</span><b>{{ scoredTowns.findIndex((item) => item.id === selectedTown.id) + 1 }}</b>
          </div>
        </PanelCard>

        <PanelCard title="乡镇综合排名" meta="点击切换乡镇">
          <ol class="ranking-list">
            <li
              v-for="(town, index) in scoredTowns"
              :key="town.id"
              :class="{ active: selectedTownId === town.id }"
              @click="selectedTownId = town.id"
            >
              <i>{{ String(index + 1).padStart(2, '0') }}</i><span>{{ town.name }}</span><b>{{ town.scores.composite }}</b>
            </li>
          </ol>
        </PanelCard>

        <PanelCard title="优势短板识别" meta="研判输出">
          <div class="diagnosis">
            <p>{{ report || '选择乡镇并生成分析结论，系统将根据当前权重识别优势与短板。' }}</p>
            <div><button class="action-button" type="button" @click="generateReport">生成结论</button><button class="action-button" type="button" @click="exportReport">导出报告</button></div>
          </div>
        </PanelCard>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.sansheng-layout {
  display: grid;
  min-height: 0;
  gap: 10px;
  grid-template-columns: 300px minmax(520px, 1fr) 320px;
}

.sansheng-left,
.sansheng-center,
.sansheng-right {
  display: grid;
  min-height: 0;
  gap: 10px;
}

.sansheng-left { grid-template-rows: 1.2fr 1fr; }
.sansheng-center { grid-template-rows: minmax(360px, 1fr) 230px; }
.sansheng-right { grid-template-rows: 1.1fr 1.15fr 0.8fr; }

.dimension-tabs {
  display: grid;
  gap: 5px;
  grid-template-columns: repeat(3, 1fr);
}

.indicator-list {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.indicator-list article {
  display: grid;
  align-items: center;
  padding: 7px 8px;
  border-left: 2px solid var(--cyan);
  background: rgba(255, 255, 255, 0.025);
  grid-template-columns: 1fr 34px 34px;
}

.indicator-list span { font-size: 11px; }
.indicator-list em { color: var(--text-soft); font-size: 9px; font-style: normal; }
.indicator-list b { color: var(--cyan); font: 11px var(--font-data); text-align: right; }

.weight-list {
  display: grid;
  gap: 14px;
}

.weight-list label {
  display: grid;
  align-items: center;
  gap: 8px;
  grid-template-columns: 62px 1fr 42px;
}

.weight-list span { color: var(--text-soft); font-size: 10px; }
.weight-list b { color: var(--cyan); font: 12px var(--font-data); text-align: right; }
.weight-list input { width: 100%; accent-color: var(--cyan); }

.weight-total {
  margin: 15px 0 10px;
  padding: 8px;
  color: var(--text-soft);
  font-size: 10px;
  border: 1px solid var(--line);
}

.weight-total strong { float: right; color: var(--text); }
.full-button { width: 100%; height: 30px; }

.indicator-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
}

.indicator-table th,
.indicator-table td {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(122, 203, 190, 0.1);
  text-align: left;
}

.indicator-table th { color: var(--text-soft); font-weight: 500; }
.indicator-table td:nth-child(3) { color: var(--cyan); font-family: var(--font-data); }

.score-summary {
  display: grid;
  align-items: center;
  height: calc(100% - 34px);
  grid-template-columns: 105px 1fr;
}

.score-orbit {
  display: grid;
  place-content: center;
  width: 96px;
  height: 96px;
  border: 1px solid rgba(61, 214, 196, 0.6);
  border-radius: 50%;
  box-shadow: inset 0 0 24px rgba(61, 214, 196, 0.13), 0 0 18px rgba(61, 214, 196, 0.1);
  text-align: center;
}

.score-orbit strong { color: var(--cyan); font: 27px var(--font-data); }
.score-orbit span { color: var(--text-soft); font-size: 9px; }

.county-strip {
  display: grid;
  align-items: center;
  padding: 8px;
  color: var(--text-soft);
  font-size: 9px;
  border-top: 1px solid var(--line);
  grid-template-columns: 1fr auto 1fr auto;
}

.county-strip span:nth-of-type(2) { margin-left: 16px; }
.county-strip b { color: var(--text); font: 12px var(--font-data); }

.ranking-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ranking-list li {
  display: grid;
  align-items: center;
  min-height: 28px;
  padding: 0 8px;
  color: var(--text-soft);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  grid-template-columns: 28px 1fr auto;
}

.ranking-list li:hover,
.ranking-list li.active { color: var(--text); border-color: var(--line); background: rgba(61, 214, 196, 0.08); }
.ranking-list i { color: var(--cyan); font: normal 10px var(--font-data); }
.ranking-list span { font-size: 10px; }
.ranking-list b { font: 12px var(--font-data); }

.diagnosis {
  display: grid;
  height: 100%;
  gap: 8px;
  grid-template-rows: 1fr auto;
}

.diagnosis p {
  margin: 0;
  color: var(--text-soft);
  font-size: 10px;
  line-height: 1.65;
}

.diagnosis div { display: flex; gap: 6px; }
.diagnosis button { height: 28px; flex: 1; font-size: 10px; }

@media (max-width: 1440px) {
  .sansheng-layout { grid-template-columns: 270px minmax(480px, 1fr) 285px; gap: 8px; }
  .sansheng-left, .sansheng-center, .sansheng-right { gap: 8px; }
  .indicator-list { gap: 4px; }
  .indicator-list article { padding: 5px 7px; }
}
</style>
