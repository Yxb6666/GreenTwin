import type { ParsedLayerFeature } from './iserverLayers'

export type TreatmentMeasureKey = 'ditch' | 'outlet' | 'pump' | 'road'

export interface TreatmentRuleParameters {
  ditchWidth: number
  ditchDepth: number
  roadRaiseHeight: number
  outletCount?: number
  outletDiameter?: number
  pumpCount?: number
  pumpCapacity?: number
}

const SCORE_INCREMENTS: Record<TreatmentMeasureKey, readonly number[]> = {
  ditch: [4, 10, 3],
  outlet: [3, 7, 1],
  pump: [2, 9, 1],
  road: [8, 6, 1],
}

const DEFAULT_PARAMETERS: TreatmentRuleParameters = {
  ditchWidth: 0.5,
  ditchDepth: 0.7,
  roadRaiseHeight: 0.25,
  outletCount: 4,
  outletDiameter: 500,
  pumpCount: 2,
  pumpCapacity: 1000,
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function measureScale(
  measure: TreatmentMeasureKey,
  parameters: TreatmentRuleParameters,
) {
  if (measure === 'ditch') {
    return clamp(
      (parameters.ditchWidth / DEFAULT_PARAMETERS.ditchWidth +
        parameters.ditchDepth / DEFAULT_PARAMETERS.ditchDepth) /
        2,
      0.5,
      2,
    )
  }
  if (measure === 'outlet') {
    return clamp(
      ((parameters.outletCount ?? DEFAULT_PARAMETERS.outletCount!) /
        DEFAULT_PARAMETERS.outletCount!) *
        ((parameters.outletDiameter ?? DEFAULT_PARAMETERS.outletDiameter!) /
          DEFAULT_PARAMETERS.outletDiameter!),
      0,
      2.5,
    )
  }
  if (measure === 'pump') {
    return clamp(
      ((parameters.pumpCount ?? DEFAULT_PARAMETERS.pumpCount!) /
        DEFAULT_PARAMETERS.pumpCount!) *
        ((parameters.pumpCapacity ?? DEFAULT_PARAMETERS.pumpCapacity!) /
          DEFAULT_PARAMETERS.pumpCapacity!),
      0,
      2.5,
    )
  }
  return clamp(
    parameters.roadRaiseHeight / DEFAULT_PARAMETERS.roadRaiseHeight,
    0.4,
    2.4,
  )
}

function roundScore(value: number) {
  return Number(value.toFixed(1))
}

export function applyTreatmentScoreRules(
  baseScores: readonly number[],
  baselineScores: readonly number[],
  selectedMeasures: readonly TreatmentMeasureKey[],
  parameters: TreatmentRuleParameters = DEFAULT_PARAMETERS,
) {
  const scores = baseScores.map((score, index) =>
    roundScore(
      Math.min(
        100,
        score +
          selectedMeasures.reduce(
            (total, measure) =>
              total +
              (SCORE_INCREMENTS[measure][index] ?? 0) *
                measureScale(measure, parameters),
            0,
          ),
      ),
    ),
  )
  const composite = Number(
    (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(
      1,
    ),
  )
  const deltas = scores.map((score, index) => {
    const delta = roundScore(score - (baselineScores[index] ?? 0))
    return delta > 0 ? `+${delta}` : String(delta)
  })
  return { scores, composite, deltas }
}

export function selectTreatmentRoad(
  features: readonly ParsedLayerFeature[],
  focus: { longitude: number; latitude: number },
  maximumPoints = 18,
) {
  let selected: ParsedLayerFeature | null = null
  let selectedPointIndex = 0
  let minimumDistance = Number.POSITIVE_INFINITY

  for (const feature of features) {
    if (feature.kind !== 'line' || feature.points.length < 2) continue
    feature.points.forEach((point, index) => {
      const longitudeScale = Math.cos((focus.latitude * Math.PI) / 180)
      const longitudeDistance =
        (point.longitude - focus.longitude) * longitudeScale
      const latitudeDistance = point.latitude - focus.latitude
      const distance = longitudeDistance ** 2 + latitudeDistance ** 2
      if (distance < minimumDistance) {
        minimumDistance = distance
        selected = feature
        selectedPointIndex = index
      }
    })
  }

  if (!selected) return null
  const road = selected as ParsedLayerFeature
  if (road.points.length <= maximumPoints) return road
  const halfWindow = Math.floor(maximumPoints / 2)
  const start = Math.max(
    0,
    Math.min(
      road.points.length - maximumPoints,
      selectedPointIndex - halfWindow,
    ),
  )
  return { ...road, points: road.points.slice(start, start + maximumPoints) }
}

export function offsetTreatmentLine(
  points: ParsedLayerFeature['points'],
  offsetMeters: number,
) {
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)] ?? point
    const next = points[Math.min(points.length - 1, index + 1)] ?? point
    const latitudeRadians = (point.latitude * Math.PI) / 180
    const metersPerLatitudeDegree = 111_320
    const metersPerLongitudeDegree = Math.max(
      1,
      metersPerLatitudeDegree * Math.cos(latitudeRadians),
    )
    const dx = (next.longitude - previous.longitude) * metersPerLongitudeDegree
    const dy = (next.latitude - previous.latitude) * metersPerLatitudeDegree
    const length = Math.hypot(dx, dy)
    if (!length) return point
    return {
      longitude:
        point.longitude +
        (-dy / length / metersPerLongitudeDegree) * offsetMeters,
      latitude:
        point.latitude + (dx / length / metersPerLatitudeDegree) * offsetMeters,
    }
  })
}
