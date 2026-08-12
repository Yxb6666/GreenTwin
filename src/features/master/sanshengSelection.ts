import {
  calculateCompositeScore,
  DEFAULT_DIMENSION_WEIGHTS,
  scoreTown,
  towns,
  type SanshengScores,
} from '@/features/sansheng/model'

export interface MasterSanshengEvaluation {
  areaName: string
  meta: string
  scope: 'county' | 'township' | 'unavailable'
  scores: SanshengScores | null
}

const COUNTY_SANSHENG_DIMENSIONS = {
  ecology: 88,
  life: 82,
  production: 90,
}

export const COUNTY_SANSHENG_SCORES: SanshengScores = {
  ...COUNTY_SANSHENG_DIMENSIONS,
  composite: calculateCompositeScore(
    COUNTY_SANSHENG_DIMENSIONS,
    DEFAULT_DIMENSION_WEIGHTS,
  ),
}

export function resolveMasterSanshengEvaluation(
  selectedTownship: string | null,
): MasterSanshengEvaluation {
  const areaName = selectedTownship?.trim()
  if (!areaName) {
    return {
      areaName: '兰考县',
      meta: '县域协同指数',
      scope: 'county',
      scores: COUNTY_SANSHENG_SCORES,
    }
  }

  const town = towns.find((item) => item.name === areaName)
  if (!town) {
    return {
      areaName,
      meta: `${areaName} / 行政区评价`,
      scope: 'unavailable',
      scores: null,
    }
  }

  return {
    areaName,
    meta: `${areaName} / 行政区评价`,
    scope: 'township',
    scores: scoreTown(town, DEFAULT_DIMENSION_WEIGHTS),
  }
}
