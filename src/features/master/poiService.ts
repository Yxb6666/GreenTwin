import {
  isPointInsideTownship,
  type TownshipFeature,
  type TownshipPoint,
} from '@/gis/leaflet/townshipFeatures'

export type PoiBucket = 'publicService' | 'industry' | 'cultureTourism'

export interface PoiRecord {
  id: string
  name: string
  majorCategory: string
  middleCategory: string
  latitude: number
  longitude: number
  bucket: PoiBucket
}

export interface TownshipPoiSummary {
  publicService: number
  industry: number
  cultureTourism: number
  total: number
}

export interface TownshipPoiIndex {
  summaries: ReadonlyMap<string, TownshipPoiSummary>
  recordsByTownship: ReadonlyMap<string, PoiRecord[]>
}

interface TownshipLookup {
  feature: TownshipFeature
  bounds: {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
  }
}

interface IServerPoiFeature {
  ID?: unknown
  fieldValues?: unknown[]
  geometry?: {
    center?: { x?: unknown; y?: unknown }
    points?: Array<{ x?: unknown; y?: unknown }>
  }
}

interface IServerPoiRecordset {
  features?: IServerPoiFeature[]
}

interface IServerPoiQueryResult {
  recordsets?: IServerPoiRecordset[]
}

interface IServerMapResource {
  name?: unknown
  path?: unknown
}

const POI_EXPECT_COUNT = 30_000
const DEFAULT_POI_INDEX_CHUNK_SIZE = 200

const PUBLIC_SERVICE_CATEGORIES = new Set([
  '生活服务',
  '科教文化',
  '医疗保健',
  '交通设施',
  '金融机构',
  '鐢熸椿鏈嶅姟',
  '绉戞暀鏂囧寲',
  '鍖荤枟淇濆仴',
  '浜ら�氳鏂�',
  '閲戣瀺鏈烘瀯',
])

const CULTURE_TOURISM_CATEGORIES = new Set([
  '旅游景点',
  '休闲娱乐',
  '运动健身',
  '酒店住宿',
  '鏃呮父鏅偣',
  '浼戦棽濞变箰',
  '杩愬姩鍋ヨ韩',
  '閰掑簵浣忓',
])

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(stringValue(value))
  return Number.isFinite(parsed) ? parsed : null
}

function categorizePoi(majorCategory: string): PoiBucket {
  if (PUBLIC_SERVICE_CATEGORIES.has(majorCategory)) return 'publicService'
  if (CULTURE_TOURISM_CATEGORIES.has(majorCategory)) return 'cultureTourism'
  return 'industry'
}

function emptyPoiSummary(): TownshipPoiSummary {
  return {
    publicService: 0,
    industry: 0,
    cultureTourism: 0,
    total: 0,
  }
}

function townshipLookup(feature: TownshipFeature): TownshipLookup {
  const points = feature.rings.flat()
  return {
    feature,
    bounds: points.reduce(
      (bounds, [latitude, longitude]) => ({
        minLat: Math.min(bounds.minLat, latitude),
        maxLat: Math.max(bounds.maxLat, latitude),
        minLng: Math.min(bounds.minLng, longitude),
        maxLng: Math.max(bounds.maxLng, longitude),
      }),
      {
        minLat: Number.POSITIVE_INFINITY,
        maxLat: Number.NEGATIVE_INFINITY,
        minLng: Number.POSITIVE_INFINITY,
        maxLng: Number.NEGATIVE_INFINITY,
      },
    ),
  }
}

function pointIsInBounds(point: TownshipPoint, lookup: TownshipLookup) {
  const [latitude, longitude] = point
  return (
    latitude >= lookup.bounds.minLat &&
    latitude <= lookup.bounds.maxLat &&
    longitude >= lookup.bounds.minLng &&
    longitude <= lookup.bounds.maxLng
  )
}

function yieldToMainThread() {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, 0)
  })
}

function normalizeServiceUrl(serviceUrl: string) {
  return serviceUrl.trim().replace(/\/+$/, '')
}

async function resolvePoiMapServiceUrl(
  serviceUrl: string,
  fetchImpl: typeof fetch,
) {
  const normalizedUrl = normalizeServiceUrl(serviceUrl)
  if (/\/rest\/maps\/[^/]+$/i.test(normalizedUrl)) return normalizedUrl
  if (!/\/rest$/i.test(normalizedUrl)) return normalizedUrl

  const response = await fetchImpl(`${normalizedUrl}/maps.json`, {
    cache: 'no-store',
  })
  if (!response.ok)
    throw new Error(`POI 地图资源列表读取失败（HTTP ${response.status}）`)

  const maps = (await response.json()) as unknown
  const firstMap = Array.isArray(maps) ? (maps[0] as IServerMapResource) : null
  const mapPath = stringValue(firstMap?.path)
  if (mapPath) return mapPath

  const mapName = stringValue(firstMap?.name)
  if (!mapName) throw new Error('POI 服务未返回可用地图资源')
  return `${normalizedUrl}/maps/${encodeURIComponent(mapName)}`
}

export function parsePoiRecords(value: unknown): PoiRecord[] {
  if (!value || typeof value !== 'object') return []
  const features = (value as IServerPoiQueryResult).recordsets?.[0]?.features ?? []

  return features.flatMap((feature) => {
    const values = feature.fieldValues ?? []
    const longitude =
      numberValue(values[7]) ??
      numberValue(feature.geometry?.center?.x) ??
      numberValue(feature.geometry?.points?.[0]?.x)
    const latitude =
      numberValue(values[8]) ??
      numberValue(feature.geometry?.center?.y) ??
      numberValue(feature.geometry?.points?.[0]?.y)
    if (latitude == null || longitude == null) return []

    const majorCategory = stringValue(values[1])
    const record: PoiRecord = {
      id: stringValue(feature.ID),
      name: stringValue(values[0]),
      majorCategory,
      middleCategory: stringValue(values[2]),
      latitude,
      longitude,
      bucket: categorizePoi(majorCategory),
    }

    return [record]
  })
}

export async function loadPoiRecords(
  serviceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PoiRecord[]> {
  const mapServiceUrl = await resolvePoiMapServiceUrl(serviceUrl, fetchImpl)
  const datasetName = decodeURIComponent(
    mapServiceUrl.slice(mapServiceUrl.lastIndexOf('/') + 1),
  )
  const response = await fetchImpl(
    `${mapServiceUrl}/queryResults.json?returnContent=true`,
    {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queryMode: 'SqlQuery',
        queryParameters: {
          queryParams: [{ name: datasetName, attributeFilter: '1=1' }],
          startRecord: 0,
          expectCount: POI_EXPECT_COUNT,
          queryOption: 'ATTRIBUTEANDGEOMETRY',
        },
      }),
    },
  )
  if (!response.ok)
    throw new Error(`POI 要素查询失败（HTTP ${response.status}）`)

  const records = parsePoiRecords(await response.json())
  if (records.length === 0) throw new Error('POI 服务未返回有效点位')
  return records
}

export function summarizePoiByTownship(
  records: readonly PoiRecord[],
  townships: readonly TownshipFeature[],
) {
  const summaries = new Map<string, TownshipPoiSummary>()
  townships.forEach((township) => {
    summaries.set(township.code, {
      publicService: 0,
      industry: 0,
      cultureTourism: 0,
      total: 0,
    })
  })

  records.forEach((record) => {
    const point: TownshipPoint = [record.latitude, record.longitude]
    const township = townships.find((feature) =>
      isPointInsideTownship(point, feature),
    )
    if (!township) return

    const summary = summaries.get(township.code)
    if (!summary) return
    summary[record.bucket] += 1
    summary.total += 1
  })

  return summaries
}

export function filterPoiRecordsByTownship(
  records: readonly PoiRecord[],
  township: TownshipFeature,
) {
  return records.filter((record) =>
    isPointInsideTownship([record.latitude, record.longitude], township),
  )
}

export async function buildPoiIndexByTownship(
  records: readonly PoiRecord[],
  townships: readonly TownshipFeature[],
  chunkSize = DEFAULT_POI_INDEX_CHUNK_SIZE,
): Promise<TownshipPoiIndex> {
  const summaries = new Map<string, TownshipPoiSummary>()
  const recordsByTownship = new Map<string, PoiRecord[]>()
  const lookups = townships.map(townshipLookup)

  townships.forEach((township) => {
    summaries.set(township.code, emptyPoiSummary())
    recordsByTownship.set(township.code, [])
  })

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!
    const point: TownshipPoint = [record.latitude, record.longitude]
    const township = lookups.find(
      (lookup) => pointIsInBounds(point, lookup) && isPointInsideTownship(point, lookup.feature),
    )?.feature
    if (township) {
      const summary = summaries.get(township.code)
      summary![record.bucket] += 1
      summary!.total += 1
      recordsByTownship.get(township.code)!.push(record)
    }

    if ((index + 1) % chunkSize === 0) await yieldToMainThread()
  }

  return { summaries, recordsByTownship }
}
