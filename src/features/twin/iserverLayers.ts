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
  height?: number
}

export interface IServerLayerSource {
  serviceUrl: string
  mapName: string
  datasetName: string
}

export function buildIServerMapUrl(source: IServerLayerSource) {
  const serviceUrl = source.serviceUrl.replace(/\/+$/, '')
  const restUrl = /\/rest$/i.test(serviceUrl) ? serviceUrl : `${serviceUrl}/rest`
  return `${restUrl}/maps/${source.mapName}`
}

export function buildWgs84BoundsFilter(
  minLongitude: number,
  minLatitude: number,
  maxLongitude: number,
  maxLatitude: number,
) {
  return `WGS84_X > ${minLongitude} AND WGS84_X < ${maxLongitude} AND WGS84_Y > ${minLatitude} AND WGS84_Y < ${maxLatitude}`
}

export interface IServerQueryBounds {
  minLongitude: number
  minLatitude: number
  maxLongitude: number
  maxLatitude: number
}

function readNumericField(feature: IServerFeature, fieldName: string) {
  const fieldIndex = feature.fieldNames?.findIndex(
    (name) => name.toLowerCase() === fieldName.toLowerCase(),
  ) ?? -1
  if (fieldIndex < 0) return undefined
  const value = Number(feature.fieldValues?.[fieldIndex])
  return Number.isFinite(value) ? value : undefined
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
      const height = readNumericField(feature, 'Height')
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
        result.push({
          kind,
          points: segment,
          name: name || undefined,
          height,
        })
      }
    }
  }
  return result
}

export async function fetchIServerFeatures(
  source: IServerLayerSource,
  options: {
    attributeFilter?: string
    bounds?: IServerQueryBounds
    expectCount?: number
    fetchImpl?: typeof fetch
    timeoutMs?: number
  } = {},
): Promise<ParsedLayerFeature[]> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 60000
  const baseUrl = buildIServerMapUrl(source)
  const queryUrl = `${baseUrl}/queryResults.json`
  const body = {
    queryMode: options.bounds ? 'BoundsQuery' : 'SqlQuery',
    ...(options.bounds
      ? {
          bounds: {
            left: options.bounds.minLongitude,
            bottom: options.bounds.minLatitude,
            right: options.bounds.maxLongitude,
            top: options.bounds.maxLatitude,
            leftBottom: {
              x: options.bounds.minLongitude,
              y: options.bounds.minLatitude,
            },
            rightTop: {
              x: options.bounds.maxLongitude,
              y: options.bounds.maxLatitude,
            },
          },
        }
      : {}),
    queryParameters: {
      startRecord: 0,
      ...(options.expectCount ? { expectCount: options.expectCount } : {}),
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
