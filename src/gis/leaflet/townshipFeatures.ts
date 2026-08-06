export type TownshipRing = Array<[number, number]>

export interface TownshipFeature {
  code: string
  name: string
  rings: TownshipRing[]
}

interface IServerPoint {
  x?: unknown
  y?: unknown
}

interface IServerFeature {
  fieldValues?: unknown[]
  geometry?: {
    parts?: unknown[]
    points?: IServerPoint[]
  }
}

interface IServerQueryResult {
  recordsets?: Array<{
    features?: IServerFeature[]
  }>
}

export function isTownshipAdministrativeCode(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{9}$/.test(value)) return false
  return Number(value.slice(-3)) < 400
}

export function parseTownshipFeatures(value: unknown): TownshipFeature[] {
  if (!value || typeof value !== 'object') return []

  const features = (value as IServerQueryResult).recordsets?.[0]?.features ?? []
  return features.flatMap((feature) => {
    const code = feature.fieldValues?.[0]
    if (!isTownshipAdministrativeCode(code)) return []

    const points = feature.geometry?.points ?? []
    const partSizes = feature.geometry?.parts ?? []
    const rings: TownshipRing[] = []
    let offset = 0

    for (const rawPartSize of partSizes) {
      if (typeof rawPartSize !== 'number' || !Number.isInteger(rawPartSize) || rawPartSize < 3) return []

      const partPoints = points.slice(offset, offset + rawPartSize)
      offset += rawPartSize
      if (partPoints.length !== rawPartSize) return []

      const ring: TownshipRing = []
      for (const point of partPoints) {
        if (typeof point.x !== 'number' || !Number.isFinite(point.x)) return []
        if (typeof point.y !== 'number' || !Number.isFinite(point.y)) return []
        ring.push([point.y, point.x])
      }
      rings.push(ring)
    }

    if (rings.length === 0 || offset !== points.length) return []
    return [{ code, name: String(feature.fieldValues?.[1] ?? ''), rings }]
  })
}

export async function loadTownshipFeatures(serviceUrl: string): Promise<TownshipFeature[]> {
  const response = await fetch(`${serviceUrl.replace(/\/+$/, '')}/queryResults.json?returnContent=true`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queryMode: 'SqlQuery',
      queryParameters: {
        queryParams: [{ name: 'Lankao_Township', attributeFilter: '1=1' }],
        startRecord: 0,
        expectCount: 100,
        queryOption: 'ATTRIBUTEANDGEOMETRY',
      },
    }),
  })

  if (!response.ok) throw new Error(`iServer 乡镇要素查询失败（HTTP ${response.status}）`)

  const features = parseTownshipFeatures(await response.json())
  if (features.length === 0) throw new Error('iServer 未返回有效乡镇要素')
  return features
}
