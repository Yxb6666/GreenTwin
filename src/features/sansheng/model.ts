import { towns as townshipIndicatorData } from './townData'

export type DimensionKey = 'ecology' | 'life' | 'production'
export type Direction = 'positive' | 'negative' | 'balanced'
export type IndicatorSourceType = 'direct' | 'proxy' | 'substitute'

export const DEFAULT_DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  ecology: 34,
  life: 33,
  production: 33,
}

export interface Indicator {
  key: string
  name: string
  direction: Direction
  unit: string
  weight: number
  sourceType: IndicatorSourceType
  note: string
  target?: number
}

export interface Town {
  id: string
  name: string
  ecology: Record<string, number | null>
  life: Record<string, number | null>
  production: Record<string, number | null>
}

export type DimensionScores = Record<DimensionKey, number>

export interface SanshengScores extends DimensionScores {
  composite: number
}

export const dimensionMeta: Record<
  DimensionKey,
  { label: string; color: string; indicators: Indicator[] }
> = {
  ecology: {
    label: '生态空间',
    color: '#78d787',
    indicators: [
      {
        key: 'ecoLandRatio',
        name: '生态用地占比',
        direction: 'positive',
        unit: '%',
        weight: 0.2,
        sourceType: 'direct',
        note: 'CLCD 森林、灌木、草原、水域和湿地面积占比',
      },
      {
        key: 'waterRatio',
        name: '水域面积占比',
        direction: 'positive',
        unit: '%',
        weight: 0.2,
        sourceType: 'direct',
        note: 'CLCD 水域面积占有效分类面积比例',
      },
      {
        key: 'waterNetwork',
        name: '水网密度',
        direction: 'positive',
        unit: 'km/km²',
        weight: 0.2,
        sourceType: 'direct',
        note: '乡镇水系长度与行政区面积之比',
      },
      {
        key: 'slope',
        name: '平均坡度',
        direction: 'negative',
        unit: '°',
        weight: 0.2,
        sourceType: 'direct',
        note: 'DEM 使用 Horn 3×3 算子计算',
      },
      {
        key: 'buildDisturbance',
        name: '建设干扰（不透水面代理）',
        direction: 'negative',
        unit: '%',
        weight: 0.2,
        sourceType: 'proxy',
        note: '以 CLCD 不透水面占比近似建设干扰程度',
      },
    ],
  },
  life: {
    label: '生活空间',
    color: '#3dd6c4',
    indicators: [
      {
        key: 'residentialRatio',
        name: '建成空间占比（不透水面代理）',
        direction: 'balanced',
        unit: '%',
        weight: 0.2,
        sourceType: 'proxy',
        note: '不能区分居住、工业、商业和道路，按适中最优评价',
        target: 25,
      },
      {
        key: 'poiDensity',
        name: '公共服务 POI 密度',
        direction: 'positive',
        unit: '个/km²',
        weight: 0.2,
        sourceType: 'direct',
        note: '公共服务相关 POI 数量与行政区面积之比',
      },
      {
        key: 'educationAccess',
        name: '教育设施密度',
        direction: 'positive',
        unit: '个/km²',
        weight: 0.2,
        sourceType: 'substitute',
        note: '替代教育可达性，暂不反映人口覆盖和通行时间',
      },
      {
        key: 'medicalAccess',
        name: '医疗设施密度',
        direction: 'positive',
        unit: '个/km²',
        weight: 0.2,
        sourceType: 'substitute',
        note: '替代医疗可达性，暂不反映人口覆盖和通行时间',
      },
      {
        key: 'roadAccess',
        name: '公共交通设施密度',
        direction: 'positive',
        unit: '个/km²',
        weight: 0.2,
        sourceType: 'substitute',
        note: '替代道路通达性，使用公交站、客运站和火车站密度',
      },
    ],
  },
  production: {
    label: '生产空间',
    color: '#f0b85c',
    indicators: [
      {
        key: 'farmlandRatio',
        name: '农田面积占比',
        direction: 'positive',
        unit: '%',
        weight: 0.2,
        sourceType: 'direct',
        note: 'CLCD 农田面积占有效分类面积比例',
      },
      {
        key: 'constructionRatio',
        name: '建设空间占比（不透水面代理）',
        direction: 'balanced',
        unit: '%',
        weight: 0.2,
        sourceType: 'proxy',
        note: '以 CLCD 不透水面占比近似建设空间，按适中最优评价',
        target: 25,
      },
      {
        key: 'industryPoi',
        name: '产业 POI 密度',
        direction: 'positive',
        unit: '个/km²',
        weight: 0.2,
        sourceType: 'direct',
        note: '公司企业类 POI 数量与行政区面积之比',
      },
      {
        key: 'roadDensity',
        name: '道路密度',
        direction: 'positive',
        unit: 'km/km²',
        weight: 0.2,
        sourceType: 'direct',
        note: '乡镇道路长度与行政区面积之比',
      },
      {
        key: 'mainRoadDistance',
        name: '产业节点距主干道路',
        direction: 'negative',
        unit: 'km',
        weight: 0.2,
        sourceType: 'direct',
        note: '产业 POI 到最近主干道路的平均直线距离',
      },
    ],
  },
}

export const towns: Town[] = townshipIndicatorData

export function normalizeWeights(weights: Record<DimensionKey, number>) {
  const safe = {
    ecology: Math.max(0, Number(weights.ecology) || 0),
    life: Math.max(0, Number(weights.life) || 0),
    production: Math.max(0, Number(weights.production) || 0),
  }
  const sum = safe.ecology + safe.life + safe.production
  if (sum <= 0) return { ecology: 0.34, life: 0.33, production: 0.33 }
  return {
    ecology: safe.ecology / sum,
    life: safe.life / sum,
    production: safe.production / sum,
  }
}

export function normalizeIndicator(
  value: number,
  direction: Direction,
  minimum = 0,
  maximum = 100,
  target = (minimum + maximum) / 2,
) {
  const safeMinimum = Math.min(minimum, maximum)
  const safeMaximum = Math.max(minimum, maximum)
  if (safeMaximum === safeMinimum) return 100
  const safe = Math.max(safeMinimum, Math.min(safeMaximum, Number(value) || 0))
  if (direction === 'negative')
    return Number(
      (((safeMaximum - safe) / (safeMaximum - safeMinimum)) * 100).toFixed(2),
    )
  if (direction === 'balanced') {
    const safeTarget = Math.max(safeMinimum, Math.min(safeMaximum, target))
    const maximumDistance = Math.max(
      safeTarget - safeMinimum,
      safeMaximum - safeTarget,
    )
    if (maximumDistance === 0) return 100
    return Number(
      Math.max(
        0,
        100 - (Math.abs(safe - safeTarget) / maximumDistance) * 100,
      ).toFixed(2),
    )
  }
  return Number(
    (((safe - safeMinimum) / (safeMaximum - safeMinimum)) * 100).toFixed(2),
  )
}

export function normalizeTownIndicator(
  town: Town,
  dimension: DimensionKey,
  indicator: Indicator,
) {
  const value = town[dimension][indicator.key]
  if (value == null || !Number.isFinite(value)) return null
  const countyValues = towns
    .map((item) => item[dimension][indicator.key])
    .filter((item): item is number => item != null && Number.isFinite(item))
  return normalizeIndicator(
    value,
    indicator.direction,
    Math.min(...countyValues),
    Math.max(...countyValues),
    indicator.target,
  )
}

export function calculateDimensionScore(town: Town, dimension: DimensionKey) {
  const meta = dimensionMeta[dimension]
  const available = meta.indicators
    .map((indicator) => ({
      indicator,
      score: normalizeTownIndicator(town, dimension, indicator),
    }))
    .filter(
      (item): item is { indicator: Indicator; score: number } =>
        item.score != null,
    )
  const total = available.reduce((sum, item) => sum + item.indicator.weight, 0)
  if (total === 0) return 0
  const score = available.reduce(
    (sum, item) => sum + item.score * item.indicator.weight,
    0,
  )
  return Number((score / total).toFixed(1))
}

export function calculateCompositeScore(
  scores: DimensionScores,
  weights: Record<DimensionKey, number>,
) {
  const normalized = normalizeWeights(weights)
  return Number(
    (
      scores.ecology * normalized.ecology +
      scores.life * normalized.life +
      scores.production * normalized.production
    ).toFixed(1),
  )
}

export function scoreTown(town: Town, weights: Record<DimensionKey, number>) {
  const ecology = calculateDimensionScore(town, 'ecology')
  const life = calculateDimensionScore(town, 'life')
  const production = calculateDimensionScore(town, 'production')
  const composite = calculateCompositeScore(
    { ecology, life, production },
    weights,
  )
  return { ecology, life, production, composite }
}
