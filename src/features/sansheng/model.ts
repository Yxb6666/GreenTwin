export type DimensionKey = 'ecology' | 'life' | 'production'
export type Direction = 'positive' | 'negative' | 'balanced'

export interface Indicator {
  key: string
  name: string
  direction: Direction
  unit: string
  weight: number
}

export interface Town {
  id: string
  name: string
  lat: number
  lng: number
  ecology: Record<string, number>
  life: Record<string, number>
  production: Record<string, number>
}

export const dimensionMeta: Record<DimensionKey, { label: string; color: string; indicators: Indicator[] }> = {
  ecology: {
    label: '生态空间',
    color: '#78d787',
    indicators: [
      { key: 'ecoLandRatio', name: '生态用地占比', direction: 'positive', unit: '%', weight: 0.2 },
      { key: 'waterRatio', name: '水域面积占比', direction: 'positive', unit: '%', weight: 0.2 },
      { key: 'waterNetwork', name: '水网密度', direction: 'positive', unit: '分', weight: 0.2 },
      { key: 'slope', name: '坡度', direction: 'negative', unit: '分', weight: 0.2 },
      { key: 'buildDisturbance', name: '建设干扰强度', direction: 'negative', unit: '分', weight: 0.2 },
    ],
  },
  life: {
    label: '生活空间',
    color: '#3dd6c4',
    indicators: [
      { key: 'residentialRatio', name: '居住用地占比', direction: 'positive', unit: '%', weight: 0.2 },
      { key: 'poiDensity', name: '公共服务 POI 密度', direction: 'positive', unit: '个/km²', weight: 0.2 },
      { key: 'educationAccess', name: '教育设施可达性', direction: 'positive', unit: '分', weight: 0.2 },
      { key: 'medicalAccess', name: '医疗设施可达性', direction: 'positive', unit: '分', weight: 0.2 },
      { key: 'roadAccess', name: '道路通达性', direction: 'positive', unit: '分', weight: 0.2 },
    ],
  },
  production: {
    label: '生产空间',
    color: '#f0b85c',
    indicators: [
      { key: 'farmlandRatio', name: '耕地面积占比', direction: 'positive', unit: '%', weight: 0.2 },
      { key: 'constructionRatio', name: '建设用地占比', direction: 'balanced', unit: '%', weight: 0.2 },
      { key: 'industryPoi', name: '产业 POI 密度', direction: 'positive', unit: '个/km²', weight: 0.2 },
      { key: 'roadDensity', name: '道路密度', direction: 'positive', unit: 'km/km²', weight: 0.2 },
      { key: 'mainRoadDistance', name: '距主干道路', direction: 'negative', unit: '分', weight: 0.2 },
    ],
  },
}

export const towns: Town[] = [
  { id: 'chengguan', name: '城关乡', lat: 34.82, lng: 114.82, ecology: { ecoLandRatio: 66, waterRatio: 58, waterNetwork: 63, slope: 32, buildDisturbance: 48 }, life: { residentialRatio: 82, poiDensity: 88, educationAccess: 91, medicalAccess: 89, roadAccess: 92 }, production: { farmlandRatio: 62, constructionRatio: 56, industryPoi: 84, roadDensity: 86, mainRoadDistance: 24 } },
  { id: 'yifeng', name: '仪封镇', lat: 34.88, lng: 114.79, ecology: { ecoLandRatio: 72, waterRatio: 61, waterNetwork: 68, slope: 18, buildDisturbance: 42 }, life: { residentialRatio: 69, poiDensity: 64, educationAccess: 72, medicalAccess: 66, roadAccess: 78 }, production: { farmlandRatio: 84, constructionRatio: 39, industryPoi: 76, roadDensity: 74, mainRoadDistance: 31 } },
  { id: 'guying', name: '谷营镇', lat: 34.76, lng: 114.91, ecology: { ecoLandRatio: 70, waterRatio: 54, waterNetwork: 66, slope: 22, buildDisturbance: 38 }, life: { residentialRatio: 64, poiDensity: 61, educationAccess: 68, medicalAccess: 62, roadAccess: 73 }, production: { farmlandRatio: 86, constructionRatio: 34, industryPoi: 72, roadDensity: 70, mainRoadDistance: 36 } },
  { id: 'hongmiao', name: '红庙镇', lat: 34.74, lng: 114.71, ecology: { ecoLandRatio: 75, waterRatio: 69, waterNetwork: 73, slope: 20, buildDisturbance: 36 }, life: { residentialRatio: 61, poiDensity: 56, educationAccess: 64, medicalAccess: 58, roadAccess: 67 }, production: { farmlandRatio: 82, constructionRatio: 31, industryPoi: 68, roadDensity: 66, mainRoadDistance: 42 } },
  { id: 'guyang', name: '堌阳镇', lat: 34.93, lng: 114.68, ecology: { ecoLandRatio: 78, waterRatio: 64, waterNetwork: 71, slope: 16, buildDisturbance: 34 }, life: { residentialRatio: 66, poiDensity: 59, educationAccess: 70, medicalAccess: 63, roadAccess: 75 }, production: { farmlandRatio: 88, constructionRatio: 30, industryPoi: 81, roadDensity: 77, mainRoadDistance: 29 } },
  { id: 'dongbatou', name: '东坝头镇', lat: 34.89, lng: 114.98, ecology: { ecoLandRatio: 80, waterRatio: 76, waterNetwork: 79, slope: 24, buildDisturbance: 44 }, life: { residentialRatio: 58, poiDensity: 52, educationAccess: 61, medicalAccess: 57, roadAccess: 64 }, production: { farmlandRatio: 79, constructionRatio: 33, industryPoi: 66, roadDensity: 63, mainRoadDistance: 48 } },
  { id: 'putaohjia', name: '葡萄架乡', lat: 34.69, lng: 114.84, ecology: { ecoLandRatio: 74, waterRatio: 57, waterNetwork: 62, slope: 19, buildDisturbance: 37 }, life: { residentialRatio: 57, poiDensity: 49, educationAccess: 60, medicalAccess: 55, roadAccess: 68 }, production: { farmlandRatio: 90, constructionRatio: 27, industryPoi: 74, roadDensity: 71, mainRoadDistance: 39 } },
  { id: 'xuhe', name: '许河乡', lat: 34.79, lng: 115.02, ecology: { ecoLandRatio: 69, waterRatio: 52, waterNetwork: 59, slope: 21, buildDisturbance: 41 }, life: { residentialRatio: 55, poiDensity: 47, educationAccess: 57, medicalAccess: 52, roadAccess: 62 }, production: { farmlandRatio: 83, constructionRatio: 29, industryPoi: 65, roadDensity: 61, mainRoadDistance: 52 } },
]

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

export function normalizeIndicator(value: number, direction: Direction) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0))
  if (direction === 'negative') return 100 - safe
  if (direction === 'balanced') return Math.max(45, 100 - Math.abs(safe - 35) * 1.5)
  return safe
}

export function calculateDimensionScore(town: Town, dimension: DimensionKey) {
  const meta = dimensionMeta[dimension]
  const total = meta.indicators.reduce((sum, indicator) => sum + indicator.weight, 0)
  const score = meta.indicators.reduce(
    (sum, indicator) => sum + normalizeIndicator(town[dimension][indicator.key] ?? 0, indicator.direction) * indicator.weight,
    0,
  )
  return Number((score / total).toFixed(1))
}

export function scoreTown(town: Town, weights: Record<DimensionKey, number>) {
  const normalized = normalizeWeights(weights)
  const ecology = calculateDimensionScore(town, 'ecology')
  const life = calculateDimensionScore(town, 'life')
  const production = calculateDimensionScore(town, 'production')
  const composite = Number((ecology * normalized.ecology + life * normalized.life + production * normalized.production).toFixed(1))
  return { ecology, life, production, composite }
}
