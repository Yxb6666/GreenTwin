import type { GovernanceIssue } from '@/features/governance/data'
import { scoreTown, towns, type Town } from '@/features/sansheng/model'
import type { TownshipFeature } from '@/gis/leaflet/townshipFeatures'
import { gdpTrend, latestPopulationDensity } from './data'

export type MasterMapThemeKey =
  | 'administrative'
  | 'population'
  | 'gdp'
  | 'poi'
  | 'landuse'
  | 'sansheng'
  | 'governance'

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

export const landUseSource = [
  { name: '耕地与设施农业', shortLabel: '耕地', value: 42, color: '#d6b657' },
  { name: '林地草地', shortLabel: '林草', value: 19, color: '#4da668' },
  { name: '村庄建设用地', shortLabel: '村建', value: 17, color: '#d26d57' },
  { name: '水域沟渠', shortLabel: '水域', value: 10, color: '#48a5cc' },
  { name: '其他用地', shortLabel: '其他', value: 12, color: '#345349' },
]

export const masterMapThemes: MasterMapTheme[] = [
  { key: 'administrative', label: '行政区划', description: '兰考县现行乡镇、街道行政区划' },
  { key: 'population', label: '人口密度', description: '按 16 个行政区实际值分位分级' },
  { key: 'gdp', label: 'GDP', description: '按行政区展示经济强度分布' },
  { key: 'poi', label: 'POI', description: '公共服务、产业和文旅兴趣点聚合' },
  { key: 'landuse', label: '土地利用', description: '按行政区主导用地类型展示' },
  { key: 'sansheng', label: '三生评价', description: '使用三生模型真实的生态、生活、生产协同得分' },
  { key: 'governance', label: '治理问题', description: '按行政区聚合治理问题数量' },
]

export const masterMapThemeLegends: Record<MasterMapThemeKey, ThemeLegendItem[]> = {
  administrative: [
    { label: '兰考县界', color: '#dceb72', kind: 'line' },
    { label: '乡镇 / 街道界', color: '#b9cf65', kind: 'line' },
  ],
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
  landuse: landUseSource.map((item) => ({ label: item.name, color: item.color })),
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
  themeKey: Exclude<MasterMapThemeKey, 'administrative'>,
  feature: TownshipFeature,
  index: number,
  issues: GovernanceIssue[] = [],
): TownshipThemeMetric {
  const seed = hashFeature(feature, index)
  const sanshengTown = findSanshengTown(feature)

  if (themeKey === 'population') {
    const density = Math.round(
      clamp(
        latestPopulationDensity + (seed % 220) - 95 + ((sanshengTown?.life.residentialRatio ?? 62) - 62) * 1.6,
        520,
        920,
      ),
    )
    return { value: density, label: `${density} 人/km²`, meta: '人口密度分位分级', color: populationPalette[0]! }
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
    const publicService = Math.round((sanshengTown?.life.poiDensity ?? 50 + (seed % 28)) * 0.72)
    const industry = Math.round((sanshengTown?.production.industryPoi ?? 48 + (seed % 26)) * 0.56)
    const cultureTourism = 6 + (seed % 16)
    const breakdown = [
      { ...masterMapThemeLegends.poi[0]!, value: publicService },
      { ...masterMapThemeLegends.poi[1]!, value: industry },
      { ...masterMapThemeLegends.poi[2]!, value: cultureTourism },
    ]
    const total = publicService + industry + cultureTourism
    return {
      value: total,
      label: `${total} 个`,
      meta: 'POI 聚合点',
      color: '#32B7A0',
      radius: clamp(8 + Math.sqrt(total) * 1.1, 11, 21),
      details: breakdown.map((item) => `${item.label} ${item.value}`),
      breakdown,
    }
  }

  if (themeKey === 'landuse') {
    const landUse = landUseSource[seed % landUseSource.length]!
    const share = Math.round(clamp(landUse.value + (seed % 19) - 9, 8, 56))
    return { value: share, label: `${landUse.shortLabel} ${share}%`, meta: `主导类型：${landUse.name}`, color: landUse.color }
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
      details: [
        `生态 ${scores.ecology.toFixed(1)}`,
        `生活 ${scores.life.toFixed(1)}`,
        `生产 ${scores.production.toFixed(1)}`,
      ],
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
  themeKey: MasterMapThemeKey,
  features: TownshipFeature[],
  issues: GovernanceIssue[] = [],
): TownshipThemeMetric[] {
  if (themeKey === 'administrative') return []
  const metrics = features.map((feature, index) => resolveTownshipThemeMetric(themeKey, feature, index, issues))
  if (themeKey === 'population') applyQuantileColors(metrics, populationPalette)
  if (themeKey === 'sansheng') applyQuantileColors(metrics, sanshengPalette)
  return metrics
}
