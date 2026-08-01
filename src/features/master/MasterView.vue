<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ScreenHeader from '@/shared/components/ScreenHeader.vue'
import PanelCard from '@/shared/components/PanelCard.vue'
import RadarChart from '@/shared/components/RadarChart.vue'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useLeafletMap } from '@/gis/leaflet/useLeafletMap'

type LayerKey = 'population' | 'gdp' | 'land' | 'issues'

interface Village {
  id: string
  name: string
  lat: number
  lng: number
  population: number
  gdp: number
  land: number
  issues: number
}

const config = useRuntimeConfig()
const mapContainer = ref<HTMLElement | null>(null)
const activeLayer = ref<LayerKey>('population')
const { error: mapError, initialize, setPoints } = useLeafletMap(mapContainer)

const villages: Village[] = [
  { id: 'yifeng', name: '仪封镇', lat: 34.88, lng: 114.79, population: 74, gdp: 88, land: 82, issues: 8 },
  { id: 'guying', name: '谷营镇', lat: 34.9, lng: 114.68, population: 61, gdp: 71, land: 89, issues: 6 },
  { id: 'hongmiao', name: '红庙镇', lat: 34.76, lng: 114.86, population: 58, gdp: 63, land: 78, issues: 9 },
  { id: 'xuhe', name: '许河乡', lat: 34.72, lng: 114.72, population: 46, gdp: 52, land: 91, issues: 5 },
  { id: 'dongbatou', name: '东坝头镇', lat: 34.94, lng: 114.98, population: 69, gdp: 78, land: 84, issues: 4 },
  { id: 'putaohjia', name: '葡萄架乡', lat: 34.81, lng: 114.64, population: 53, gdp: 66, land: 86, issues: 7 },
  { id: 'guyang', name: '堌阳镇', lat: 34.66, lng: 114.82, population: 64, gdp: 82, land: 76, issues: 3 },
]

const layerMeta: Record<LayerKey, { label: string; description: string; colors: string[] }> = {
  population: {
    label: '人口热力',
    description: '人口密度专题显示村庄集聚强度与公共服务承载压力，亮度越高代表人口越集中。',
    colors: ['#315c51', '#4c8d71', '#3dd6c4'],
  },
  gdp: {
    label: 'GDP 等级',
    description: '产业活力格网用于识别高贡献村域与产业提升潜力区。',
    colors: ['#72572d', '#bb843c', '#f0b85c'],
  },
  land: {
    label: '土地利用',
    description: '土地利用专题表达耕地、林地、水域、建设用地和生态弹性空间。',
    colors: ['#486a3b', '#70a858', '#a4d67d'],
  },
  issues: {
    label: '治理问题',
    description: '治理问题专题汇聚人居环境、设施短板、违建疑似与占地异常点位。',
    colors: ['#755646', '#bd7258', '#e77468'],
  },
}

const currentMeta = computed(() => layerMeta[activeLayer.value])

function colorFor(value: number, layer: LayerKey) {
  const colors = layerMeta[layer].colors
  const normalized = layer === 'issues' ? Math.min(100, value * 10) : value
  return normalized >= 75 ? colors[2]! : normalized >= 58 ? colors[1]! : colors[0]!
}

function refreshPoints() {
  const layer = activeLayer.value
  setPoints(
    villages.map((village) => ({
      id: village.id,
      name: village.name,
      lat: village.lat,
      lng: village.lng,
      color: colorFor(village[layer], layer),
      value: `${layerMeta[layer].label}：${village[layer]}`,
    })),
  )
}

onMounted(async () => {
  await initialize(config.supermap.leafletSdkUrl, config.supermap.mapServices.base, config.map.center, config.map.zoom, config.map.crs)
  refreshPoints()
})

watch(activeLayer, refreshPoints)
</script>

<template>
  <main class="screen-page master-page">
    <ScreenHeader
      title="兰考县和美乡村数字孪生决策平台"
      subtitle="生态 · 生活 · 产业综合评估 / 治理问题发现 / 决策方案辅助研判"
      status="主控模块运行中"
    />

    <div class="master-layout">
      <aside class="master-side">
        <PanelCard title="人口密度特征" meta="村域网格 / 人口承载">
          <div class="metric-grid">
            <article class="metric-card"><span>常住人口</span><strong>72.6万</strong><small>较上期 +1.8%</small></article>
            <article class="metric-card"><span>平均密度</span><strong>642</strong><small>人 / km²</small></article>
          </div>
          <div class="data-bars master-bars">
            <div v-for="village in villages.slice(0, 5)" :key="village.id" class="data-bar">
              <span>{{ village.name }}</span><i :style="{ '--value': `${village.population}%` }" /><b>{{ village.population }}</b>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="GDP 特征" meta="产业贡献 / 增长态势">
          <div class="gdp-chart">
            <div v-for="(item, index) in [56, 68, 63, 79, 74, 88, 92]" :key="index">
              <i :style="{ height: `${item}%` }" /><span>{{ 2020 + index }}</span>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="三生综合评价" meta="县域协同指数">
          <RadarChart :labels="['生态', '生活', '生产', '治理']" :values="[88, 82, 90, 78]" />
        </PanelCard>
      </aside>

      <section class="master-center">
        <section class="map-shell panel-frame master-map">
          <div ref="mapContainer" class="map-container" />
          <div class="map-toolbar">
            <button
              v-for="(meta, key) in layerMeta"
              :key="key"
              class="layer-button"
              :class="{ active: activeLayer === key }"
              type="button"
              @click="activeLayer = key"
            >
              {{ meta.label }}
            </button>
          </div>
          <div v-if="mapError" class="map-error">{{ mapError }}</div>
          <div class="map-caption"><strong>乡村空间资源一张图</strong><br />{{ currentMeta.description }}</div>
        </section>

        <PanelCard title="DEM 数据三维表达" meta="高程 / 坡度 / 低洼风险">
          <div class="dem-overview">
            <div class="terrain-model" aria-hidden="true">
              <i v-for="index in 15" :key="index" :style="{ '--height': `${22 + ((index * 23) % 66)}%` }" />
            </div>
            <div class="dem-stats">
              <article><span>平均高程</span><strong>63.8 m</strong></article>
              <article><span>最大坡度</span><strong>8.6°</strong></article>
              <article><span>低洼网格</span><strong>124</strong></article>
              <article><span>建设适宜区</span><strong>71.2%</strong></article>
            </div>
          </div>
        </PanelCard>
      </section>

      <aside class="master-side">
        <PanelCard title="土地利用数据" meta="国土空间结构">
          <div class="land-use">
            <div class="land-donut"><strong>42%</strong><span>耕地</span></div>
            <ul>
              <li><i class="farm" />耕地与设施农业 <b>42%</b></li>
              <li><i class="forest" />林地草地 <b>19%</b></li>
              <li><i class="build" />村庄建设用地 <b>17%</b></li>
              <li><i class="water" />水域沟渠 <b>10%</b></li>
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
            <article><strong>A / 生态廊道修复</strong><p>优先治理水系两侧问题点位，覆盖 12 个重点村。</p></article>
            <article><strong>B / 产业节点集聚</strong><p>联动道路、POI 与 GDP 栅格，推荐 4 处融合节点。</p></article>
          </div>
          <div class="decision-actions">
            <button type="button">导出图件</button><button type="button">生成报告</button><button type="button">方案推演</button>
          </div>
        </PanelCard>
      </aside>
    </div>
  </main>
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

.master-bars {
  margin-top: 10px;
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

.gdp-chart div {
  display: grid;
  align-items: end;
  height: 100%;
  flex: 1;
  grid-template-rows: minmax(0, 1fr) 20px;
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

.map-caption strong {
  color: var(--text);
}

.dem-overview {
  display: grid;
  height: 100%;
  gap: 14px;
  grid-template-columns: minmax(260px, 1fr) 250px;
}

.terrain-model {
  display: flex;
  align-items: end;
  gap: 2px;
  padding: 16px 20px 5px;
  overflow: hidden;
  perspective: 500px;
  border: 1px solid rgba(61, 214, 196, 0.12);
  background: linear-gradient(to bottom, rgba(61, 214, 196, 0.03), rgba(61, 214, 196, 0.09));
  transform: skewX(-7deg);
}

.terrain-model i {
  width: 7%;
  height: var(--height);
  background: linear-gradient(to top, #1d5548, #80cc79 55%, #d9c069);
  clip-path: polygon(20% 100%, 0 30%, 42% 0, 100% 45%, 82% 100%);
  opacity: 0.9;
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
  font: 17px var(--font-data);
}

.land-use {
  display: grid;
  align-items: center;
  height: 100%;
  gap: 12px;
  grid-template-columns: 96px 1fr;
}

.land-donut {
  display: grid;
  place-content: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: conic-gradient(#d6b657 0 42%, #4da668 42% 61%, #d26d57 61% 78%, #48a5cc 78% 88%, #345349 88%);
  box-shadow: inset 0 0 0 16px #10201f;
  text-align: center;
}

.land-donut strong {
  font: 17px var(--font-data);
}

.land-donut span {
  color: var(--text-soft);
  font-size: 9px;
}

.land-use ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.land-use li {
  display: flex;
  gap: 6px;
  color: var(--text-soft);
  font-size: 10px;
}

.land-use li i {
  width: 7px;
  height: 7px;
  margin-top: 3px;
  border-radius: 50%;
}

.land-use li b {
  margin-left: auto;
  color: var(--text);
}

.farm { background: #d6b657; }
.forest { background: #4da668; }
.build { background: #d26d57; }
.water { background: #48a5cc; }

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

.issue-stack b { font-size: 11px; }
.issue-stack span { overflow: hidden; color: var(--text-soft); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.issue-stack em { color: var(--amber); font: normal 11px var(--font-data); }

.plan-stack article {
  padding: 8px;
  border: 1px solid rgba(61, 214, 196, 0.12);
  background: rgba(61, 214, 196, 0.035);
}

.plan-stack strong { color: var(--cyan); font-size: 11px; }
.plan-stack p { margin: 5px 0 0; color: var(--text-soft); font-size: 9px; line-height: 1.5; }

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
  .issue-stack article { padding: 5px 6px; }
}
</style>
