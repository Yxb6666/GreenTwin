export type GeographicBounds = [[number, number], [number, number]]

interface IServerMapMetadata {
  bounds?: {
    left?: unknown
    bottom?: unknown
    right?: unknown
    top?: unknown
  }
}

export function parseIServerMapBounds(value: unknown): GeographicBounds | null {
  if (!value || typeof value !== 'object') return null
  const bounds = (value as IServerMapMetadata).bounds
  if (!bounds) return null

  const { left, bottom, right, top } = bounds
  if (![left, bottom, right, top].every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))) {
    return null
  }
  if ((left as number) >= (right as number) || (bottom as number) >= (top as number)) return null

  return [
    [bottom as number, left as number],
    [top as number, right as number],
  ]
}

export async function loadIServerMapBounds(serviceUrl: string): Promise<GeographicBounds> {
  const response = await fetch(`${serviceUrl.replace(/\/+$/, '')}.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`iServer 地图范围请求失败（HTTP ${response.status}）`)

  const bounds = parseIServerMapBounds(await response.json())
  if (!bounds) throw new Error('iServer 地图范围无效')
  return bounds
}
