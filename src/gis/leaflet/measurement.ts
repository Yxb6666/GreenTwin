export interface GeographicPoint {
  lat: number
  lng: number
}

const earthRadiusMeters = 6_378_137

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

export function calculateGeodesicArea(points: readonly GeographicPoint[]) {
  if (points.length < 3) return 0

  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    area +=
      toRadians(next.lng - current.lng) *
      (2 + Math.sin(toRadians(current.lat)) + Math.sin(toRadians(next.lat)))
  }

  return Math.abs((area * earthRadiusMeters * earthRadiusMeters) / 2)
}

export function formatDistance(meters: number) {
  if (meters < 1_000) return `${Math.round(meters)} 米`
  return `${(meters / 1_000).toFixed(meters < 10_000 ? 2 : 1)} 千米`
}

export function formatArea(squareMeters: number) {
  if (squareMeters < 10_000) return `${Math.round(squareMeters)} 平方米`
  if (squareMeters < 1_000_000) return `${(squareMeters / 10_000).toFixed(2)} 公顷`
  return `${(squareMeters / 1_000_000).toFixed(2)} 平方千米`
}
