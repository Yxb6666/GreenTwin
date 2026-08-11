import {
  DEFAULT_DIMENSION_WEIGHTS,
  scoreTown,
  towns,
  type DimensionKey,
} from '@/features/sansheng/model'

export type SanshengRadarScores = Record<DimensionKey, number>

export interface MasterSanshengEvaluation {
  areaName: string
  meta: string
  scope: 'county' | 'township' | 'unavailable'
  scores: SanshengRadarScores | null
}

export const COUNTY_SANSHENG_SCORES: SanshengRadarScores = {
  ecology: 88,
  life: 82,
  production: 90,
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

  const { ecology, life, production } = scoreTown(
    town,
    DEFAULT_DIMENSION_WEIGHTS,
  )
  return {
    areaName,
    meta: `${areaName} / 行政区评价`,
    scope: 'township',
    scores: { ecology, life, production },
  }
}
