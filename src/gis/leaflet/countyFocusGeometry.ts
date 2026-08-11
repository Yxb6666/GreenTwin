import type { TownshipFeature, TownshipRing } from './townshipFeatures'

interface BoundaryEdge {
  count: number
  startKey: string
  endKey: string
}

const COORDINATE_PRECISION = 8

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
