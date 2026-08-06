<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import MapToolbox from '@/shared/components/MapToolbox.vue'
import RadarChart from '@/shared/components/RadarChart.vue'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useLeafletMap } from '@/gis/leaflet/useLeafletMap'
import { dimensionMeta, scoreTown, towns, type DimensionKey } from './model'
import {
  buildSanshengReportRequest,
  requestSanshengReport,
  type ReportMeta,
  type SanshengReport,
} from './report'
import { createReportDocxBlob, createReportDocxFileName } from './reportDocx'

const config = useRuntimeConfig()
const mapContainer = ref<HTMLElement | null>(null)
const activeDimension = ref<DimensionKey>('ecology')
const selectedTownId = ref('yifeng')
const report = ref<SanshengReport | null>(null)
const reportMeta = ref<ReportMeta | null>(null)
const reportError = ref('')
const reportOpen = ref(false)
const isGeneratingReport = ref(false)
const isExportingReport = ref(false)
const weights = ref<Record<DimensionKey, number>>({ ecology: 34, life: 33, production: 33 })
const { map, error: mapError, initialize } = useLeafletMap(mapContainer)

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
const selectedTownRank = computed(() => scoredTowns.value.findIndex((item) => item.id === selectedTown.value.id) + 1)
const diagnosisSummary = computed(() => {
  const scores = selectedTown.value.scores
  const entries = [
    ['生态', scores.ecology],
    ['生活', scores.life],
    ['生产', scores.production],
  ] as const
  const strongest = [...entries].sort((a, b) => b[1] - a[1])[0]!
  const weakest = [...entries].sort((a, b) => a[1] - b[1])[0]!
  return `${selectedTown.value.name}综合指数为 ${scores.composite}，优势维度为${strongest[0]}（${strongest[1]}），短板维度为${weakest[0]}（${weakest[1]}）。`
})

function resetWeights() {
  weights.value = { ecology: 34, life: 33, production: 33 }
}

async function generateReport() {
  isGeneratingReport.value = true
  reportError.value = ''
  try {
    const town = selectedTown.value
    const payload = buildSanshengReportRequest(
      town,
      town.scores,
      weights.value,
      countyScores.value.composite,
      selectedTownRank.value,
      scoredTowns.value.length,
    )
    const result = await requestSanshengReport(config.apiBaseUrl, config.reportTimeoutMs, payload)
    report.value = result.report
    reportMeta.value = result.meta
    reportOpen.value = true
  } catch (error) {
    reportError.value = error instanceof Error ? error.message : '报告生成失败，请稍后重试'
  } finally {
    isGeneratingReport.value = false
  }
}

async function exportReport() {
  if (!report.value || !reportMeta.value) await generateReport()
  if (!report.value || !reportMeta.value) return
  isExportingReport.value = true
  reportError.value = ''
  try {
    const blob = await createReportDocxBlob(report.value, reportMeta.value)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = createReportDocxFileName(selectedTown.value.name)
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    reportError.value = error instanceof Error ? `Word 报告导出失败：${error.message}` : 'Word 报告导出失败'
  } finally {
    isExportingReport.value = false
  }
}

watch(
  [selectedTownId, weights],
  () => {
    report.value = null
    reportMeta.value = null
    reportError.value = ''
    reportOpen.value = false
  },
  { deep: true },
)

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
          <MapToolbox
            :map="map"
            :initial-center="config.map.center"
            :initial-zoom="config.map.zoom"
            export-name="兰考县三生空间评价地图"
          />
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
            <span>当前排名</span><b>{{ selectedTownRank }}</b>
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
            <p>{{ report?.executiveSummary || diagnosisSummary }}</p>
            <span v-if="reportError" class="report-error" role="alert">{{ reportError }}</span>
            <div>
              <button class="action-button" type="button" :disabled="isGeneratingReport || isExportingReport" @click="generateReport">
                {{ isGeneratingReport ? 'DeepSeek 生成中…' : '生成详细报告' }}
              </button>
              <button class="action-button" type="button" :disabled="isGeneratingReport || isExportingReport" @click="exportReport">
                {{ isExportingReport ? 'Word 生成中…' : '导出 Word' }}
              </button>
            </div>
          </div>
        </PanelCard>
      </aside>
    </div>

    <Teleport to="body">
      <div v-if="reportOpen && report && reportMeta" class="report-overlay" @click.self="reportOpen = false">
        <section class="report-dialog" role="dialog" aria-modal="true" :aria-label="report.title">
          <header class="report-dialog__header">
            <div><span>DEEPSEEK 智能研判</span><h2>{{ report.title }}</h2></div>
            <button type="button" aria-label="关闭报告" @click="reportOpen = false">×</button>
          </header>
          <div class="report-dialog__meta">
            <span>模型 {{ reportMeta.model }}</span>
            <span>生成时间 {{ new Date(reportMeta.generatedAt).toLocaleString('zh-CN', { hour12: false }) }}</span>
            <span v-if="reportMeta.usage">Token {{ reportMeta.usage.totalTokens }}</span>
          </div>
          <div class="report-dialog__body">
            <section class="report-lead">
              <h3>执行摘要</h3>
              <p>{{ report.executiveSummary }}</p>
            </section>
            <section>
              <h3>总体评价</h3>
              <p>{{ report.overallAssessment }}</p>
            </section>
            <section>
              <h3>分维度分析</h3>
              <div class="dimension-report-grid">
                <article v-for="item in report.dimensionAnalysis" :key="item.dimension">
                  <header><strong>{{ item.dimension }}</strong><b>{{ item.score }}</b></header>
                  <p>{{ item.assessment }}</p>
                  <ul><li v-for="evidence in item.evidence" :key="evidence">{{ evidence }}</li></ul>
                </article>
              </div>
            </section>
            <div class="report-two-column">
              <section><h3>主要优势</h3><ol><li v-for="item in report.strengths" :key="item">{{ item }}</li></ol></section>
              <section><h3>关键短板</h3><ol><li v-for="item in report.weaknesses" :key="item">{{ item }}</li></ol></section>
            </div>
            <section>
              <h3>行动建议</h3>
              <ol class="recommendation-list">
                <li v-for="item in report.recommendations" :key="`${item.priority}-${item.action}`">
                  <header><em :class="`priority-${item.priority}`">{{ item.priority }}优先级</em><strong>{{ item.action }}</strong><span>{{ item.timeframe }}</span></header>
                  <p><b>数据依据：</b>{{ item.basis }}</p>
                  <p><b>预期成效：</b>{{ item.expectedOutcome }}</p>
                </li>
              </ol>
            </section>
            <div class="report-two-column">
              <section><h3>风险与限制</h3><ul><li v-for="item in report.risks" :key="item">{{ item }}</li></ul></section>
              <section><h3>结论</h3><p>{{ report.conclusion }}</p></section>
            </div>
          </div>
          <footer class="report-dialog__footer">
            <span>AI 报告仅供辅助研判，不替代法定规划与实地调查。</span>
            <button class="action-button" type="button" :disabled="isExportingReport" @click="exportReport">
              {{ isExportingReport ? 'Word 生成中…' : '导出 Word 文档' }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
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
  grid-template-rows: minmax(0, 1fr) auto auto;
}

.diagnosis p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--text-soft);
  font-size: 10px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.diagnosis div { display: flex; gap: 6px; }
.diagnosis button { height: 28px; flex: 1; font-size: 10px; }
.diagnosis button:disabled { cursor: wait; opacity: 0.58; }

.report-error {
  color: #f0a196;
  font-size: 9px;
}

.report-overlay {
  position: fixed;
  z-index: 5000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(2, 10, 11, 0.78);
  backdrop-filter: blur(8px);
}

.report-dialog {
  display: grid;
  width: min(1180px, 94vw);
  max-height: 92vh;
  overflow: hidden;
  border: 1px solid rgba(61, 214, 196, 0.45);
  border-radius: 10px;
  background: linear-gradient(145deg, #102222, #071414 70%);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.58), 0 0 30px rgba(61, 214, 196, 0.1);
  grid-template-rows: auto auto minmax(0, 1fr) auto;
}

.report-dialog__header {
  display: flex;
  align-items: center;
  min-height: 74px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}

.report-dialog__header span { color: var(--cyan); font: 9px var(--font-data); letter-spacing: 0.18em; }
.report-dialog__header h2 { margin: 5px 0 0; font-size: 20px; }
.report-dialog__header button {
  width: 34px;
  height: 34px;
  margin-left: auto;
  color: var(--text-soft);
  font-size: 24px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.report-dialog__meta {
  display: flex;
  gap: 22px;
  padding: 8px 20px;
  color: var(--text-soft);
  font: 9px var(--font-data);
  border-bottom: 1px solid rgba(122, 203, 190, 0.1);
}

.report-dialog__body {
  display: grid;
  gap: 14px;
  padding: 18px 20px 24px;
  overflow-y: auto;
  scrollbar-color: rgba(61, 214, 196, 0.42) rgba(255, 255, 255, 0.03);
  scrollbar-width: thin;
}

.report-dialog__body::-webkit-scrollbar { width: 7px; }
.report-dialog__body::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.03); }
.report-dialog__body::-webkit-scrollbar-thumb { border-radius: 99px; background: rgba(61, 214, 196, 0.42); }

.report-dialog__body section {
  padding: 14px;
  border: 1px solid rgba(122, 203, 190, 0.13);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.018);
}

.report-dialog__body h3 {
  margin: 0 0 10px;
  color: var(--cyan);
  font-size: 13px;
}

.report-dialog__body p,
.report-dialog__body li {
  color: var(--text-soft);
  font-size: 11px;
  line-height: 1.75;
}

.report-dialog__body p { margin: 0; }
.report-dialog__body ul,
.report-dialog__body ol { margin: 8px 0 0; padding-left: 20px; }
.report-lead { border-left: 3px solid var(--cyan) !important; background: rgba(61, 214, 196, 0.055) !important; }

.dimension-report-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dimension-report-grid article { padding: 12px; border: 1px solid var(--line); }
.dimension-report-grid header { display: flex; align-items: center; }
.dimension-report-grid header strong { font-size: 12px; }
.dimension-report-grid header b { margin-left: auto; color: var(--cyan); font: 18px var(--font-data); }

.report-two-column {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.recommendation-list {
  display: grid;
  gap: 8px;
  padding: 0 !important;
  list-style: none;
}

.recommendation-list li { padding: 10px 12px; border-left: 2px solid var(--cyan); background: rgba(61, 214, 196, 0.035); }
.recommendation-list header { display: flex; align-items: center; gap: 9px; }
.recommendation-list header strong { color: var(--text); font-size: 11px; }
.recommendation-list header span { margin-left: auto; font: 9px var(--font-data); }
.recommendation-list em { padding: 2px 5px; font-size: 9px; font-style: normal; border-radius: 3px; }
.priority-高 { color: #f0a196; background: rgba(231, 116, 104, 0.13); }
.priority-中 { color: var(--amber); background: rgba(240, 184, 92, 0.12); }
.priority-低 { color: var(--green); background: rgba(120, 215, 135, 0.12); }

.report-dialog__footer {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  border-top: 1px solid var(--line);
}

.report-dialog__footer span { color: var(--text-soft); font-size: 9px; }
.report-dialog__footer button { min-width: 130px; height: 30px; margin-left: auto; font-size: 10px; }

@media (max-width: 1440px) {
  .sansheng-layout { grid-template-columns: 270px minmax(480px, 1fr) 285px; gap: 8px; }
  .sansheng-left, .sansheng-center, .sansheng-right { gap: 8px; }
  .indicator-list { gap: 4px; }
  .indicator-list article { padding: 5px 7px; }
}
</style>
