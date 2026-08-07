import type { GovernanceIssue } from '@/features/governance/data'
import { scoreTown, towns, type Town } from '@/features/sansheng/model'
import type { TownshipFeature } from '@/gis/leaflet/townshipFeatures'
import { gdpTrend, latestPopulationDensity } from './data'

export type MasterMapThemeKey =
  | 'population'
  | 'gdp'
  | 'poi'
  | 'landuse'
  | 'sansheng'
  | 'governance'

export interface MasterMapTheme {
  key: MasterMapThemeKey
  label: string
  shortLabel: string
  modeLabel: string
  description: string
}

export interface ThemeLegendItem {
  label: string
  color: string
}

export interface TownshipThemeMetric {
  value: number
  label: string
  meta: string
  color: string
  radius?: number
  details?: string[]
}

export const landUseSource = [
  { name: '耕地与设施农业', shortLabel: '耕地', value: 42, color: '#d6b657' },
  { name: '林地草地', shortLabel: '林草', value: 19, color: '#4da668' },
  { name: '村庄建设用地', shortLabel: '村建', value: 17, color: '#d26d57' },
  { name: '水域沟渠', shortLabel: '水域', value: 10, color: '#48a5cc' },
  { name: '其他用地', shortLabel: '其他', value: 12, color: '#345349' },
]

export const masterMapThemes: MasterMapTheme[] = [
  {
    key: 'population',
    label: '人口密度',
    shortLabel: '人口密度',
    modeLabel: '分级设色',
    description: '按行政区展示人口密度梯度',
  },
  {
    key: 'gdp',
    label: 'GDP',
    shortLabel: 'GDP',
    modeLabel: '分级设色',
    description: '按行政区展示经济强度分布',
  },
  {
    key: 'poi',
    label: 'POI',
    shortLabel: 'POI',
    modeLabel: '聚类',
    description: '公共服务、产业和文旅兴趣点聚合',
  },
  {
    key: 'landuse',
    label: '土地利用',
    shortLabel: '土地利用',
    modeLabel: '分类设色',
    description: '按行政区主导用地类型展示',
  },
  {
    key: 'sansheng',
    label: '三生综合评价',
    shortLabel: '三生评价',
    modeLabel: '分级设色',
    description: '生态、生活、生产协同指数',
  },
  {
    key: 'governance',
    label: '治理问题点位',
    shortLabel: '治理问题',
    modeLabel: '点位聚类',
    description: '按行政区聚合治理问题数量',
  },
]

export const masterMapThemeLegends: Record<MasterMapThemeKey, ThemeLegendItem[]> = {
  population: [
    { label: '低密度', color: '#1f7460' },
    { label: '较低', color: '#238d71' },
    { label: '中等', color: '#2fbf95' },
    { label: '较高', color: '#74dfaa' },
    { label: '高密度', color: '#d6ed9f' },
  ],
  gdp: [
    { label: '低强度', color: '#24526f' },
    { label: '较低', color: '#267da3' },
    { label: '中等', color: '#33b1be' },
    { label: '较高', color: '#63d7b0' },
    { label: '高强度', color: '#f0d270' },
  ],
  poi: [
    { label: '公共服务', color: '#54c8ff' },
    { label: '产业节点', color: '#f0b85c' },
    { label: '文旅资源', color: '#b8e986' },
  ],
  landuse: landUseSource.map((item) => ({ label: item.name, color: item.color })),
  sansheng: [
    { label: '协同偏弱', color: '#24675f' },
    { label: '稳步提升', color: '#2fa48e' },
    { label: '良好', color: '#56d2a5' },
    { label: '优秀', color: '#d6ed9f' },
  ],
  governance: [
    { label: '无问题', color: '#2d8272' },
    { label: '一般关注', color: '#f0b85c' },
    { label: '重点处置', color: '#e77468' },
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
  const index = Math.min(palette.length - 1, Math.floor(ratio * palette.length))
  return palette[index]!
}

function normalizeName(value: string) {
  return value.replace(/\s/g, '')
}

function hashFeature(feature: TownshipFeature, index: number) {
  const source = `${feature.code}-${feature.name}-${index}`
  let hash = 0
  for (const character of source) {
    hash = (hash * 31 + character.charCodeAt(0)) % 9973
  }
  return hash
}

function findSanshengTown(feature: TownshipFeature): Town | undefined {
  const featureName = normalizeName(feature.name)
  if (!featureName) return undefined
  return towns.find((town) => {
    const townName = normalizeName(town.name)
    return featureName.includes(townName) || townName.includes(featureName)
  })
}

function relatedIssues(feature: TownshipFeature, issues: GovernanceIssue[]) {
  const featureName = normalizeName(feature.name)
  if (!featureName) return []

  return issues.filter((issue) => {
    const issueTown = normalizeName(issue.town)
    return featureName.includes(issueTown) || issueTown.includes(featureName)
  })
}

export function resolveTownshipThemeMetric(
  themeKey: MasterMapThemeKey,
  feature: TownshipFeature,
  index: number,
  issues: GovernanceIssue[] = [],
): TownshipThemeMetric {
  const seed = hashFeature(feature, index)
  const sanshengTown = findSanshengTown(feature)

  if (themeKey === 'population') {
    const density = Math.round(
      clamp(
        latestPopulationDensity +
          (seed % 220) -
          95 +
          ((sanshengTown?.life.residentialRatio ?? 62) - 62) * 1.6,
        520,
        920,
      ),
    )
    return {
      value: density,
      label: `${density} 人/km²`,
      meta: '人口密度分级',
      color: scaleColor(density, 520, 920, populationPalette),
    }
  }

  if (themeKey === 'gdp') {
    const productionScore = sanshengTown ? scoreTown(sanshengTown, defaultWeights).production : 72
    const gdpYiYuan = Number(
      clamp(latestGdpYiYuan / 18 + productionScore * 0.26 + (seed % 110) / 10, 22, 62).toFixed(1),
    )
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
    const total = publicService + industry + cultureTourism
    return {
      value: total,
      label: `${total} 个`,
      meta: 'POI 聚合点',
      color: scaleColor(total, 70, 130, ['#2d8272', '#3dd6c4', '#54c8ff', '#f0d270']),
      radius: clamp(12 + total / 9, 16, 28),
      details: [`公共服务 ${publicService}`, `产业 ${industry}`, `文旅 ${cultureTourism}`],
    }
  }

  if (themeKey === 'landuse') {
    const landUse = landUseSource[seed % landUseSource.length]!
    const share = Math.round(clamp(landUse.value + (seed % 19) - 9, 8, 56))
    return {
      value: share,
      label: `${landUse.shortLabel} ${share}%`,
      meta: `主导类型：${landUse.name}`,
      color: landUse.color,
    }
  }

  if (themeKey === 'sansheng') {
    const score = Number(
      (sanshengTown ? scoreTown(sanshengTown, defaultWeights).composite : clamp(68 + (seed % 260) / 10, 68, 94)).toFixed(1),
    )
    return {
      value: score,
      label: `${score.toFixed(1)} 分`,
      meta: '三生协同指数',
      color: scaleColor(score, 68, 94, sanshengPalette),
    }
  }

  const townIssues = relatedIssues(feature, issues)
  const urgent = townIssues.filter((issue) => issue.urgency === '高').length
  const processing = townIssues.filter((issue) => issue.status === '处理中' || issue.status === '已派单').length
  const total = townIssues.length

  return {
    value: total,
    label: `${total} 处`,
    meta: total > 0 ? '治理问题聚合点' : '暂无上报问题',
    color: total >= 2 ? '#e77468' : total === 1 ? '#f0b85c' : '#2d8272',
    radius: total > 0 ? clamp(13 + total * 4, 14, 30) : 10,
    details: [`高紧急 ${urgent}`, `处置中 ${processing}`],
  }
}
