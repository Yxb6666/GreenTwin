import {
  getTownshipLabel,
  OFFICIAL_TOWNSHIP_LABELS,
  type TownshipFeature,
  type TownshipRing,
} from './townshipFeatures'

interface BoundaryEdge {
  count: number
  startKey: string
  endKey: string
}

const COORDINATE_PRECISION = 8
const MIN_BOUNDARY_AREA_RATIO = 1e-6
const MIN_TOWNSHIP_PART_AREA_RATIO = 2e-3

function pointKey(point: [number, number]) {
  return `${point[0].toFixed(COORDINATE_PRECISION)},${point[1].toFixed(COORDINATE_PRECISION)}`
}

function normalizeRing(ring: TownshipRing) {
  const normalized: TownshipRing = []
  let previousKey = ''

  ring.forEach((point) => {
    const key = pointKey(point)
    if (key === previousKey) return
    normalized.push(point)
    previousKey = key
  })

  if (normalized.length > 1 && pointKey(normalized[0]!) === pointKey(normalized.at(-1)!)) normalized.pop()
  return normalized.length >= 3 ? normalized : []
}

function addAdjacentEdge(adjacency: Map<string, number[]>, point: string, edgeIndex: number) {
  const adjacentEdges = adjacency.get(point) ?? []
  adjacentEdges.push(edgeIndex)
  adjacency.set(point, adjacentEdges)
}

function getRingArea(ring: TownshipRing) {
  const points = normalizeRing(ring)
  if (points.length < 3) return 0

  const [originLatitude, originLongitude] = points[0]!
  return Math.abs(
    points.reduce((area, [latitude, longitude], index) => {
      const [nextLatitude, nextLongitude] = points[(index + 1) % points.length]!
      const x = longitude - originLongitude
      const y = latitude - originLatitude
      const nextX = nextLongitude - originLongitude
      const nextY = nextLatitude - originLatitude
      return area + x * nextY - nextX * y
    }, 0) / 2,
  )
}

function isPointInsideRing([latitude, longitude]: [number, number], ring: TownshipRing) {
  const points = normalizeRing(ring)
  let inside = false

  for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index++) {
    const [currentLatitude, currentLongitude] = points[index]!
    const [previousLatitude, previousLongitude] = points[previousIndex]!
    const crossesRay =
      currentLatitude > latitude !== previousLatitude > latitude &&
      longitude <
        ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude) +
          currentLongitude
    if (crossesRay) inside = !inside
  }

  return inside
}

/**
 * Dissolves adjoining township polygons by cancelling their shared segments.
 * The remaining segments are stitched into one or more closed county rings.
 */
export function buildCountyBoundaryRings(features: Pick<TownshipFeature, 'rings'>[]): TownshipRing[] {
  const points = new Map<string, [number, number]>()
  const edges = new Map<string, BoundaryEdge>()

  features.forEach((feature) => {
    feature.rings.forEach((sourceRing) => {
      const ring = normalizeRing(sourceRing)
      ring.forEach((point, index) => {
        const nextPoint = ring[(index + 1) % ring.length]!
        const startKey = pointKey(point)
        const endKey = pointKey(nextPoint)
        if (startKey === endKey) return

        points.set(startKey, point)
        points.set(endKey, nextPoint)
        const edgeKey = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`
        const existing = edges.get(edgeKey)
        if (existing) existing.count += 1
        else edges.set(edgeKey, { count: 1, startKey, endKey })
      })
    })
  })

  const boundaryEdges = [...edges.values()].filter((edge) => edge.count % 2 === 1)
  const adjacency = new Map<string, number[]>()
  boundaryEdges.forEach((edge, index) => {
    addAdjacentEdge(adjacency, edge.startKey, index)
    addAdjacentEdge(adjacency, edge.endKey, index)
  })

  const unusedEdges = new Set(boundaryEdges.map((_, index) => index))
  const boundaryRings: TownshipRing[] = []

  while (unusedEdges.size > 0) {
    const firstEdgeIndex = unusedEdges.values().next().value as number
    const firstEdge = boundaryEdges[firstEdgeIndex]!
    const ringKeys = [firstEdge.startKey, firstEdge.endKey]
    unusedEdges.delete(firstEdgeIndex)

    let currentKey = firstEdge.endKey
    while (currentKey !== firstEdge.startKey) {
      const nextEdgeIndex = adjacency.get(currentKey)?.find((edgeIndex) => unusedEdges.has(edgeIndex))
      if (nextEdgeIndex === undefined) break

      const nextEdge = boundaryEdges[nextEdgeIndex]!
      currentKey = nextEdge.startKey === currentKey ? nextEdge.endKey : nextEdge.startKey
      ringKeys.push(currentKey)
      unusedEdges.delete(nextEdgeIndex)
    }

    if (currentKey !== firstEdge.startKey || ringKeys.length < 4) continue
    boundaryRings.push(ringKeys.map((key) => points.get(key)!))
  }

  return boundaryRings
}

function filterRingsByArea(rings: TownshipRing[], minimumAreaRatio: number) {
  const ringAreas = rings.map(getRingArea)
  const largestArea = Math.max(...ringAreas, 0)
  if (largestArea === 0) return []

  return rings.filter((_, index) => ringAreas[index]! >= largestArea * minimumAreaRatio)
}

export function filterCountyBoundaryArtifacts(boundaryRings: TownshipRing[]) {
  return filterRingsByArea(boundaryRings, MIN_BOUNDARY_AREA_RATIO)
}

export function filterTownshipBoundaryArtifacts(townshipRings: TownshipRing[]) {
  return filterRingsByArea(townshipRings, MIN_TOWNSHIP_PART_AREA_RATIO)
}

/**
 * Merges historical source records into the 16 current township/street units.
 * Shared internal edges are dissolved while detached, meaningful parts remain
 * as independent rings of the same logical feature.
 */
export function mergeTownshipFeatures(features: TownshipFeature[]): TownshipFeature[] {
  const groups = new Map<string, TownshipFeature[]>()

  features.forEach((feature) => {
    const label = getTownshipLabel(feature)
    if (!label) return
    const group = groups.get(label) ?? []
    group.push(feature)
    groups.set(label, group)
  })

  return OFFICIAL_TOWNSHIP_LABELS.flatMap((name) => {
    const group = groups.get(name)
    if (!group?.length) return []
    const rings = filterCountyBoundaryArtifacts(buildCountyBoundaryRings(group))
    if (rings.length === 0) return []
    const code = [...group].sort((first, second) => first.code.localeCompare(second.code))[0]!.code
    return [{ code, name, rings }]
  })
}

export function getCountyOuterBoundaryRings(boundaryRings: TownshipRing[]) {
  const ringAreas = boundaryRings.map(getRingArea)
  return boundaryRings.filter((ring, index) => {
    const samplePoint = normalizeRing(ring)[0]
    if (!samplePoint) return false

    return !boundaryRings.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        ringAreas[candidateIndex]! > ringAreas[index]! &&
        isPointInsideRing(samplePoint, candidate),
    )
  })
}

export function buildCountyInverseMaskRings(boundaryRings: TownshipRing[], paddingRatio = 4): TownshipRing[] {
  const coordinates = boundaryRings.flat()
  if (coordinates.length === 0) return []

  const latitudes = coordinates.map(([latitude]) => latitude)
  const longitudes = coordinates.map(([, longitude]) => longitude)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  const latitudePadding = Math.max((north - south) * paddingRatio, 0.1)
  const longitudePadding = Math.max((east - west) * paddingRatio, 0.1)
  const outerRing: TownshipRing = [
    [south - latitudePadding, west - longitudePadding],
    [north + latitudePadding, west - longitudePadding],
    [north + latitudePadding, east + longitudePadding],
    [south - latitudePadding, east + longitudePadding],
    [south - latitudePadding, west - longitudePadding],
  ]

  return [outerRing, ...boundaryRings]
}
