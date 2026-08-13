export interface IServerGeometryPoint {
  x: number
  y: number
}

export interface IServerFeature {
  ID?: number
  fieldNames?: string[]
  fieldValues?: Array<string | number>
  geometry?: {
    type?: string
    points?: IServerGeometryPoint[]
    parts?: number[]
    partTopo?: number[][]
  }
}

export interface IServerRecordset {
  datasetName?: string
  features?: IServerFeature[]
}

export interface ParsedLayerFeature {
  kind: 'point' | 'line' | 'polygon'
  points: Array<{ longitude: number; latitude: number }>
  name?: string
}

export interface IServerLayerSource {
  serviceUrl: string
  mapName: string
  datasetName: string
}

export function buildWgs84BoundsFilter(
  minLongitude: number,
  minLatitude: number,
  maxLongitude: number,
  maxLatitude: number,
) {
  return `WGS84_X > ${minLongitude} AND WGS84_X < ${maxLongitude} AND WGS84_Y > ${minLatitude} AND WGS84_Y < ${maxLatitude}`
}

export function parseIServerFeatures(
  recordsets: IServerRecordset[],
): ParsedLayerFeature[] {
  const result: ParsedLayerFeature[] = []
  for (const recordset of recordsets ?? []) {
    for (const feature of recordset.features ?? []) {
      const geometry = feature.geometry
      if (!geometry?.points?.length) continue
      const nameIndex = feature.fieldNames?.indexOf('名称') ?? -1
      const name =
        nameIndex >= 0
          ? String(feature.fieldValues?.[nameIndex] ?? '').trim()
          : undefined
      const type = String(geometry.type ?? '').toUpperCase()
      const rawPoints = geometry.points.map((point) => ({
        longitude: Number(point.x),
        latitude: Number(point.y),
      }))
      const parts =
        Array.isArray(geometry.parts) && geometry.parts.length
          ? geometry.parts
          : [rawPoints.length]

      if (type === 'POINT') {
        const point = rawPoints[0]!
        result.push({
          kind: 'point',
          points: [point],
          name: name || undefined,
        })
        continue
      }

      const kind: 'line' | 'polygon' =
        type === 'REGION' || type === 'POLYGON' ? 'polygon' : 'line'
      let offset = 0
      for (const part of parts) {
        const segment = rawPoints.slice(offset, offset + part)
        offset += part
        if (segment.length < 2) continue
        result.push({ kind, points: segment, name: name || undefined })
      }
    }
  }
  return result
}

export async function fetchIServerFeatures(
  source: IServerLayerSource,
  options: {
    attributeFilter?: string
    fetchImpl?: typeof fetch
    timeoutMs?: number
  } = {},
): Promise<ParsedLayerFeature[]> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 60000
  const serviceUrl = source.serviceUrl.replace(/\/+$/, '')
  const restServiceUrl = /\/rest$/i.test(serviceUrl)
    ? serviceUrl
    : `${serviceUrl}/rest`
  const baseUrl = `${restServiceUrl}/maps/${source.mapName}`
  const queryUrl = `${baseUrl}/queryResults.json`
  const body = {
    queryMode: 'SqlQuery',
    queryParameters: {
      queryParams: [
        {
          name: source.datasetName,
          ...(options.attributeFilter
            ? { attributeFilter: options.attributeFilter }
            : {}),
        },
      ],
    },
    returnContent: true,
    returnCountOnly: false,
    returnGeometry: true,
    targetEpsgCode: 4326,
  }

  const createResponse = await fetchImpl(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!createResponse.ok) {
    throw new Error(`iServer 查询创建失败（HTTP ${createResponse.status}）`)
  }
  const created = (await createResponse.json()) as {
    newResourceLocation?: string
    error?: { errorMsg?: string }
  }
  if (!created.newResourceLocation) {
    throw new Error(created.error?.errorMsg ?? 'iServer 查询资源创建失败')
  }

  const resultResponse = await fetchImpl(
    `${created.newResourceLocation}?returnContent=true&returnCountOnly=false&returnGeometry=true&targetEpsgCode=4326`,
    { signal: AbortSignal.timeout(timeoutMs) },
  )
  if (!resultResponse.ok) {
    throw new Error(`iServer 查询结果读取失败（HTTP ${resultResponse.status}）`)
  }
  const payload = (await resultResponse.json()) as {
    recordsets?: IServerRecordset[]
    error?: { errorMsg?: string }
  }
  if (payload.error) {
    throw new Error(payload.error.errorMsg ?? 'iServer 查询失败')
  }
  return parseIServerFeatures(payload.recordsets ?? [])
}
