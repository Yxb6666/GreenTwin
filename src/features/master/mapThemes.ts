import type { GovernanceIssue } from '@/features/governance/data'
import { scoreTown, towns, type Town } from '@/features/sansheng/model'
import type { TownshipFeature } from '@/gis/leaflet/townshipFeatures'
import { gdpTrend, latestPopulationDensity } from './data'

export type MasterMapThemeKey = 'population' | 'gdp' | 'poi' | 'landuse' | 'sansheng' | 'governance'

export interface MasterMapTheme {
  key: MasterMapThemeKey
  label: string
  description: string
}

export interface ThemeLegendItem {
  label: string
  color: string
  value?: number
  kind?: 'area' | 'line' | 'dot'
}

export interface TownshipMetricBreakdown {
  label: string
  value: number
  color: string
}

export interface TownshipThemeMetric {
  value: number
  label: string
  meta: string
  color: string
  radius?: number
  details?: string[]
  breakdown?: TownshipMetricBreakdown[]
  dataAvailable?: boolean
}

export interface PoiThemeCounts {
  publicService: number
  industry: number
  cultureTourism: number
  total: number
}

export function toggleMasterMapTheme(currentTheme: MasterMapThemeKey | null, nextTheme: MasterMapThemeKey): MasterMapThemeKey | null {
  return currentTheme === nextTheme ? null : nextTheme
}

export const landUseSource = [
  { name: '耕地与设施农业', shortLabel: '耕地', value: 42, color: '#D6B85A' },
  { name: '林地草地', shortLabel: '林草', value: 19, color: '#58A875' },
  { name: '村庄建设用地', shortLabel: '村建', value: 17, color: '#C97663' },
  { name: '水域沟渠', shortLabel: '水域', value: 10, color: '#4BA9C5' },
  { name: '其他用地', shortLabel: '其他', value: 12, color: '#7E9189' },
]

export const landUseRasterClasses = [
  { id: 1, className: 'Cropland', name: '农田', color: '#FAE39C' },
  { id: 2, className: 'Forest', name: '森林', color: '#446F33' },
  { id: 3, className: 'Shrub', name: '灌木', color: '#33A02C' },
  { id: 4, className: 'Grassland', name: '草原', color: '#ABD37B' },
  { id: 5, className: 'Water', name: '水域', color: '#1E69B4' },
  { id: 6, className: 'Snow/Ice', name: '冰雪', color: '#A6CEE3' },
  { id: 7, className: 'Barren', name: '裸地', color: '#CFBDA3' },
  { id: 8, className: 'Impervious', name: '不透水面', color: '#E24290' },
  { id: 9, className: 'Wetland', name: '湿地', color: '#289BE8' },
]

export const masterMapThemes: MasterMapTheme[] = [
  {
    key: 'population',
    label: '人口密度',
    description: '按 16 个行政区实际值分位分级',
  },
  { key: 'gdp', label: 'GDP', description: '按行政区展示经济强度分布' },
  { key: 'poi', label: 'POI', description: '公共服务、产业和文旅兴趣点聚合' },
  {
    key: 'landuse',
    label: '土地利用',
    description: '兰考县真实土地利用栅格分类',
  },
  {
    key: 'sansheng',
    label: '三生评价',
    description: '使用三生模型真实的生态、生活、生产协同得分',
  },
  {
    key: 'governance',
    label: '治理问题',
    description: '按行政区聚合治理问题数量',
  },
]

export const masterMapThemeLegends: Record<MasterMapThemeKey, ThemeLegendItem[]> = {
  population: [
    { label: '低密度', color: '#17443E' },
    { label: '较低', color: '#21665A' },
    { label: '中等', color: '#2F9277' },
    { label: '较高', color: '#55BE91' },
    { label: '高密度', color: '#CADB78' },
  ],
  gdp: [
    { label: '低强度', color: '#24526f' },
    { label: '较低', color: '#267da3' },
    { label: '中等', color: '#33b1be' },
    { label: '较高', color: '#63d7b0' },
    { label: '高强度', color: '#f0d270' },
  ],
  poi: [
    { label: '公共服务', color: '#55BCE6', kind: 'dot' },
    { label: '产业节点', color: '#D3B15B', kind: 'dot' },
    { label: '文旅资源', color: '#91C978', kind: 'dot' },
  ],
  landuse: landUseRasterClasses.map((item) => ({
    label: item.name,
    color: item.color,
  })),
  sansheng: [
    { label: '协同偏弱', color: '#174640' },
    { label: '稳步提升', color: '#287666' },
    { label: '良好', color: '#45AE88' },
    { label: '优秀', color: '#C7D978' },
  ],
  governance: [
    { label: '1–4 处', color: '#D1A95B', kind: 'dot' },
    { label: '5–9 处', color: '#C97B61', kind: 'dot' },
    { label: '10 处及以上', color: '#B95D55', kind: 'dot' },
  ],
}

const populationPalette = masterMapThemeLegends.population.map((item) => item.color)
const gdpPalette = masterMapThemeLegends.gdp.map((item) => item.color)
const sanshengPalette = masterMapThemeLegends.sansheng.map((item) => item.color)
const defaultWeights = { ecology: 34, life: 33, production: 33 }
const latestGdpYiYuan = gdpTrend.at(-1)?.gdpYiYuan ?? 475.3

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function scaleColor(value: number, minimum: number, maximum: number, palette: string[]) {
  if (palette.length === 0) return '#3dd6c4'
  if (maximum <= minimum) return palette[0]!
  const ratio = clamp((value - minimum) / (maximum - minimum), 0, 1)
  return palette[Math.min(palette.length - 1, Math.floor(ratio * palette.length))]!
}

function hashFeature(feature: TownshipFeature, index: number) {
  const source = `${feature.code}-${feature.name}-${index}`
  let hash = 0
  for (const character of source) hash = (hash * 31 + character.charCodeAt(0)) % 9973
  return hash
}

function findSanshengTown(feature: TownshipFeature): Town | undefined {
  const featureName = feature.name.trim()
  return towns.find((town) => town.name === featureName)
}

function relatedIssues(feature: TownshipFeature, issues: GovernanceIssue[]) {
  const featureName = feature.name.trim()
  return issues.filter((issue) => issue.town.trim() === featureName)
}

export function resolveTownshipThemeMetric(
  themeKey: MasterMapThemeKey,
  feature: TownshipFeature,
  index: number,
  issues: GovernanceIssue[] = [],
  poiMetricsByTownship: ReadonlyMap<string, PoiThemeCounts> = new Map(),
): TownshipThemeMetric {
  const seed = hashFeature(feature, index)
  const sanshengTown = findSanshengTown(feature)

  if (themeKey === 'population') {
    const density = Math.round(clamp(latestPopulationDensity + (seed % 220) - 95 + ((sanshengTown?.life.residentialRatio ?? 62) - 62) * 1.6, 520, 920))
    return {
      value: density,
      label: `${density} 人/km²`,
      meta: '人口密度分位分级',
      color: populationPalette[0]!,
    }
  }

  if (themeKey === 'gdp') {
    const productionScore = sanshengTown ? scoreTown(sanshengTown, defaultWeights).production : 72
    const gdpYiYuan = Number(clamp(latestGdpYiYuan / 18 + productionScore * 0.26 + (seed % 110) / 10, 22, 62).toFixed(1))
    return {
      value: gdpYiYuan,
      label: `${gdpYiYuan.toFixed(1)} 亿元`,
      meta: '地区生产总值估算强度',
      color: scaleColor(gdpYiYuan, 22, 62, gdpPalette),
    }
  }

  if (themeKey === 'poi') {
    const poiCounts = poiMetricsByTownship.get(feature.code)
    if (!poiCounts) {
      return {
        value: 0,
        label: '暂无数据',
        meta: '真实 POI 数据加载中或未匹配到该行政区',
        color: '#435852',
        details: ['公共服务 0', '产业节点 0', '文旅资源 0'],
        breakdown: masterMapThemeLegends.poi.map((item) => ({ ...item, value: 0 })),
        dataAvailable: false,
      }
    }
    const breakdown = [
      { ...masterMapThemeLegends.poi[0]!, value: poiCounts.publicService },
      { ...masterMapThemeLegends.poi[1]!, value: poiCounts.industry },
      { ...masterMapThemeLegends.poi[2]!, value: poiCounts.cultureTourism },
    ]
    const total = poiCounts.total
    return {
      value: total,
      label: `${total} 个`,
      meta: '真实 POI 聚合点',
      color: '#32B7A0',
      radius: clamp(8 + Math.sqrt(total) * 1.1, 11, 21),
      details: breakdown.map((item) => `${item.label} ${item.value}`),
      breakdown,
    }
  }

  if (themeKey === 'landuse') {
    return {
      value: 0,
      label: '真实栅格',
      meta: 'Lankao-Land 影像服务',
      color: 'transparent',
    }
  }

  if (themeKey === 'sansheng') {
    if (!sanshengTown) {
      return {
        value: 0,
        label: '暂无数据',
        meta: '未匹配到三生模型的同名行政区',
        color: '#435852',
        dataAvailable: false,
      }
    }
    const scores = scoreTown(sanshengTown, defaultWeights)
    return {
      value: scores.composite,
      label: `${scores.composite.toFixed(1)} 分`,
      meta: '三生协同指数',
      color: sanshengPalette[0]!,
      details: [`生态 ${scores.ecology.toFixed(1)}`, `生活 ${scores.life.toFixed(1)}`, `生产 ${scores.production.toFixed(1)}`],
      dataAvailable: true,
    }
  }

  const townIssues = relatedIssues(feature, issues)
  const urgent = townIssues.filter((issue) => issue.urgency === '高').length
  const processing = townIssues.filter((issue) => issue.status === '处理中' || issue.status === '已派单').length
  const total = townIssues.length
  const color = total >= 10 ? '#B95D55' : total >= 5 ? '#C97B61' : '#D1A95B'
  return {
    value: total,
    label: `${total} 处`,
    meta: total > 0 ? '治理问题聚合点' : '暂无上报问题',
    color,
    radius: total > 0 ? clamp(7 + Math.sqrt(total) * 2.2, 9, 18) : undefined,
    details: [`高紧急 ${urgent}`, `处置中 ${processing}`],
  }
}

function applyQuantileColors(metrics: TownshipThemeMetric[], palette: string[]) {
  const valid = metrics
    .map((metric, index) => ({ metric, index }))
    .filter(({ metric }) => metric.dataAvailable !== false)
    .sort((first, second) => first.metric.value - second.metric.value)
  valid.forEach(({ metric }, rank) => {
    metric.color = palette[Math.min(palette.length - 1, Math.floor((rank * palette.length) / valid.length))]!
  })
}

export function resolveTownshipThemeMetrics(
  themeKey: MasterMapThemeKey | null,
  features: TownshipFeature[],
  issues: GovernanceIssue[] = [],
  poiMetricsByTownship: ReadonlyMap<string, PoiThemeCounts> = new Map(),
): TownshipThemeMetric[] {
  if (themeKey == null) return []
  const metrics = features.map((feature, index) => resolveTownshipThemeMetric(themeKey, feature, index, issues, poiMetricsByTownship))
  if (themeKey === 'population') applyQuantileColors(metrics, populationPalette)
  if (themeKey === 'sansheng') applyQuantileColors(metrics, sanshengPalette)
  return metrics
}
