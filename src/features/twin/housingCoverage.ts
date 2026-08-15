import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import type { ParsedLayerFeature } from './iserverLayers'

export interface HousingCoverageBand {
  minute: number
  buildings: number
  homes: number
  residents: number
  coverageRate: number
}

export interface HousingCoverageSummary {
  totalBuildings: number
  totalHomes: number
  totalResidents: number
  bands: HousingCoverageBand[]
}

export type HousingIsochroneFeature = Feature<
  Polygon | MultiPolygon,
  { contour?: number; color?: string }
>

function pointInRing(point: Position, ring: Position[]) {
  let inside = false
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const currentPoint = ring[index]
    const previousPoint = ring[previous]
    if (!currentPoint || !previousPoint) continue
    const [x, y] = point
    const [currentX, currentY] = currentPoint
    const [previousX, previousY] = previousPoint
    if (
      x === undefined ||
      y === undefined ||
      currentX === undefined ||
      currentY === undefined ||
      previousX === undefined ||
      previousY === undefined
    ) {
      continue
    }
    const crosses =
      currentY > y !== previousY > y &&
      x <
        ((previousX - currentX) * (y - currentY)) /
          (previousY - currentY || Number.EPSILON) +
          currentX
    if (crosses) inside = !inside
  }
  return inside
}

function pointInPolygon(point: Position, polygon: Position[][]) {
  const outerRing = polygon[0]
  if (!outerRing || !pointInRing(point, outerRing)) return false
  return !polygon.slice(1).some((hole) => pointInRing(point, hole))
}

function pointInGeometry(point: Position, geometry: Polygon | MultiPolygon) {
  return geometry.type === 'Polygon'
    ? pointInPolygon(point, geometry.coordinates)
    : geometry.coordinates.some((polygon) => pointInPolygon(point, polygon))
}

function buildingCenter(feature: ParsedLayerFeature): Position | null {
  if (feature.kind !== 'polygon' || feature.points.length < 3) return null
  const sum = feature.points.reduce(
    (value, point) => ({
      longitude: value.longitude + point.longitude,
      latitude: value.latitude + point.latitude,
    }),
    { longitude: 0, latitude: 0 },
  )
  return [
    sum.longitude / feature.points.length,
    sum.latitude / feature.points.length,
  ]
}

function footprintArea(feature: ParsedLayerFeature) {
  if (feature.points.length < 3) return 0
  const latitude =
    feature.points.reduce((sum, point) => sum + point.latitude, 0) /
    feature.points.length
  const longitudeScale = 111_320 * Math.cos((latitude * Math.PI) / 180)
  const latitudeScale = 111_320
  let twiceArea = 0
  for (let index = 0; index < feature.points.length; index += 1) {
    const current = feature.points[index]
    const next = feature.points[(index + 1) % feature.points.length]
    if (!current || !next) continue
    twiceArea +=
      current.longitude * longitudeScale * next.latitude * latitudeScale -
      next.longitude * longitudeScale * current.latitude * latitudeScale
  }
  return Math.abs(twiceArea) / 2
}

function estimateHomes(feature: ParsedLayerFeature) {
  const floors = Math.max(1, Math.round((feature.height ?? 3) / 3))
  const grossFloorArea = footprintArea(feature) * floors
  return Math.max(1, Math.round(grossFloorArea / 110))
}

export function calculateHousingCoverage(
  isochrones: HousingIsochroneFeature[],
  buildings: ParsedLayerFeature[],
): HousingCoverageSummary {
  const candidates = buildings
    .map((feature) => ({
      feature,
      center: buildingCenter(feature),
      homes: estimateHomes(feature),
    }))
    .filter(
      (item): item is typeof item & { center: Position } =>
        item.center !== null,
    )
  const totalHomes = candidates.reduce((sum, item) => sum + item.homes, 0)
  const bands = isochrones
    .map((isochrone) => {
      const covered = candidates.filter((item) =>
        pointInGeometry(item.center, isochrone.geometry),
      )
      const homes = covered.reduce((sum, item) => sum + item.homes, 0)
      return {
        minute: Math.max(0, Number(isochrone.properties?.contour ?? 0)),
        buildings: covered.length,
        homes,
        residents: Math.round(homes * 2.7),
        coverageRate: totalHomes
          ? Math.min(100, (homes / totalHomes) * 100)
          : 0,
      }
    })
    .sort((left, right) => left.minute - right.minute)

  const outerBand = bands.at(-1)
  return {
    totalBuildings: outerBand?.buildings ?? 0,
    totalHomes: outerBand?.homes ?? 0,
    totalResidents: outerBand?.residents ?? 0,
    bands,
  }
}
