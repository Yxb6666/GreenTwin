export type TownshipRing = Array<[number, number]>

const COUNTY_SERVICE_NAME = 'Lankao_County'

export interface TownshipFeature {
  code: string
  name: string
  rings: TownshipRing[]
}

export type TownshipPoint = [number, number]

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

interface IServerRecordset {
  fieldCaptions?: unknown[]
  fields?: unknown[]
  features?: IServerFeature[]
}

interface IServerQueryResult {
  recordsets?: IServerRecordset[]
}

export const OFFICIAL_TOWNSHIP_LABELS = [
  '兰阳街道',
  '桐乡街道',
  '惠安街道',
  '东坝头镇',
  '谷营镇',
  '堌阳镇',
  '孟寨乡',
  '南彰镇',
  '闫楼乡',
  '小宋镇',
  '许河镇',
  '考城镇',
  '葡萄架乡',
  '红庙镇',
  '仪封镇',
  '三义寨乡',
] as const

const OFFICIAL_TOWNSHIP_NAMES: Record<string, string> = {
  '410225001': '兰阳街道',
  '410225002': '桐乡街道',
  '410225003': '惠安街道',
  '410225101': '堌阳镇',
  '410225102': '南彰镇',
  '410225103': '考城镇',
  '410225104': '红庙镇',
  '410225105': '谷营镇',
  '410225106': '东坝头镇',
  '410225107': '小宋镇',
  '410225108': '仪封镇',
  '410225109': '许河镇',
  '410225201': '三义寨乡',
  '410225202': '东坝头镇',
  '410225203': '谷营镇',
  '410225204': '谷营镇',
  '410225205': '小宋镇',
  '410225206': '孟寨乡',
  '410225207': '许河镇',
  '410225208': '葡萄架乡',
  '410225209': '闫楼乡',
  '410225210': '仪封镇',
  '410225401': '仪封园艺场',
  '410225402': '造纸林场',
  '410225403': '柳林林场',
  '410225408': '兰考林场',
}

export function getTownshipLabel(feature: Pick<TownshipFeature, 'code' | 'name'>): string | null {
  const name = OFFICIAL_TOWNSHIP_NAMES[feature.code] ?? feature.name.trim()
  return /(?:乡|镇|街道)$/.test(name) ? name : null
}

export function getTownshipRingArea(ring: TownshipRing): number {
  if (ring.length < 3) return 0
  let doubleArea = 0
  for (let index = 0; index < ring.length; index += 1) {
    const [latitude, longitude] = ring[index]!
    const [nextLatitude, nextLongitude] = ring[(index + 1) % ring.length]!
    doubleArea += longitude * nextLatitude - nextLongitude * latitude
  }
  return Math.abs(doubleArea / 2)
}

export interface TownshipRingPart<TFeature extends Pick<TownshipFeature, 'code' | 'name' | 'rings'>> {
  feature: TFeature
  ring: TownshipRing
  area: number
}

/**
 * Flattens township features into their polygon parts ordered by area ascending.
 * Detached parts (enclaves) are usually smaller than the main body. Leaflet
 * paints later layers on top, so parts are ordered by area descending: the main
 * body is drawn first and small enclaves last, keeping them above the
 * surrounding township and fully interactive.
 */
export function orderTownshipRingParts<TFeature extends Pick<TownshipFeature, 'code' | 'name' | 'rings'>>(
  features: TFeature[],
): TownshipRingPart<TFeature>[] {
  return features
    .flatMap((feature) =>
      feature.rings.map((ring) => ({
        feature,
        ring,
        area: getTownshipRingArea(ring),
      })),
    )
    .sort((first, second) => second.area - first.area)
}

/** Converts a township feature into a Leaflet MultiPolygon latlng structure. */
export function toLeafletMultiPolygon(feature: Pick<TownshipFeature, 'rings'>): TownshipRing[][] {
  return feature.rings.map((ring) => [ring])
}

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function fieldLabels(recordset: IServerRecordset) {
  const fields = Array.isArray(recordset.fields) ? recordset.fields : []
  const captions = Array.isArray(recordset.fieldCaptions)
    ? recordset.fieldCaptions
    : []
  const count = Math.max(fields.length, captions.length)

  return Array.from({ length: count }, (_, index) =>
    [fields[index], captions[index]]
      .map(stringValue)
      .filter(Boolean)
      .join('|')
      .toLowerCase(),
  )
}

function findFieldIndex(labels: string[], matchers: RegExp[]) {
  return labels.findIndex((label) =>
    matchers.some((matcher) => matcher.test(label)),
  )
}

function looksLikeAdministrativeCode(value: unknown) {
  return /^\d{6,12}$/.test(stringValue(value))
}

function looksLikeReadableName(value: unknown) {
  const text = stringValue(value)
  return (
    text.length >= 2 &&
    text.length <= 16 &&
    /\p{Script=Han}/u.test(text) &&
    !/[�\uFFFD]/u.test(text)
  )
}

function resolveCodeIndex(recordset: IServerRecordset, values: unknown[]) {
  const labels = fieldLabels(recordset)
  const matchedIndex = findFieldIndex(labels, [
    /^adcode$/,
    /(^|\|)(code|xzqdm|xzqhdm)($|\|)/,
    /行政.*(编码|代码)/,
  ])
  if (matchedIndex >= 0) return matchedIndex

  return values.findIndex(looksLikeAdministrativeCode)
}

function resolveNameIndex(
  recordset: IServerRecordset,
  values: unknown[],
  codeIndex: number,
) {
  const labels = fieldLabels(recordset)
  const matchedIndex = findFieldIndex(labels, [
    /(^|\|)name($|\|)/,
    /(行政区|乡镇|街道|名称|xzqmc)/,
  ])
  if (matchedIndex >= 0) return matchedIndex

  return values.findIndex(
    (value, index) => index !== codeIndex && looksLikeReadableName(value),
  )
}

function resolveTownshipIdentity(recordset: IServerRecordset, feature: IServerFeature) {
  const values = feature.fieldValues ?? []
  const codeIndex = resolveCodeIndex(recordset, values)
  const code = stringValue(values[codeIndex])
  const nameIndex = resolveNameIndex(recordset, values, codeIndex)
  const rawName = stringValue(values[nameIndex])
  const fallbackName = OFFICIAL_TOWNSHIP_NAMES[code] ?? ''

  return {
    code,
    name: fallbackName || (looksLikeReadableName(rawName) ? rawName : ''),
  }
}

function isPointOnSegment(point: TownshipPoint, start: TownshipPoint, end: TownshipPoint) {
  const [lat, lng] = point
  const [startLat, startLng] = start
  const [endLat, endLng] = end
  const cross = (lng - startLng) * (endLat - startLat) - (lat - startLat) * (endLng - startLng)
  if (Math.abs(cross) > 1e-10) return false

  return (
    lng >= Math.min(startLng, endLng) - 1e-10 &&
    lng <= Math.max(startLng, endLng) + 1e-10 &&
    lat >= Math.min(startLat, endLat) - 1e-10 &&
    lat <= Math.max(startLat, endLat) + 1e-10
  )
}

function isPointInRing(point: TownshipPoint, ring: TownshipRing) {
  if (ring.length < 3) return false

  const [lat, lng] = point
  let inside = false
  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index++) {
    const current = ring[index]!
    const previous = ring[previousIndex]!
    if (isPointOnSegment(point, current, previous)) return true

    const [currentLat, currentLng] = current
    const [previousLat, previousLng] = previous
    const intersects =
      currentLat > lat !== previousLat > lat &&
      lng < ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) + currentLng

    if (intersects) inside = !inside
  }

  return inside
}

export function isPointInsideTownship(point: TownshipPoint, feature: TownshipFeature) {
  return feature.rings.some((ring) => isPointInRing(point, ring))
}

function ringCentroid(ring: TownshipRing): TownshipPoint | null {
  let area = 0
  let latTotal = 0
  let lngTotal = 0

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index++) {
    const [lat, lng] = ring[index]!
    const [previousLat, previousLng] = ring[previousIndex]!
    const factor = previousLng * lat - lng * previousLat
    area += factor
    lngTotal += (previousLng + lng) * factor
    latTotal += (previousLat + lat) * factor
  }

  if (Math.abs(area) < 1e-10) return null
  return [latTotal / (area * 3), lngTotal / (area * 3)]
}

export function townshipRepresentativePoint(feature: TownshipFeature): TownshipPoint {
  let primaryRing: TownshipRing | null = null
  let largestArea = -1
  for (const ring of feature.rings) {
    const ringArea = getTownshipRingArea(ring)
    if (ringArea > largestArea) {
      largestArea = ringArea
      primaryRing = ring
    }
  }
  const primaryFeature = primaryRing ? { ...feature, rings: [primaryRing] } : feature
  const points = primaryFeature.rings.flat()
  if (points.length === 0) return [0, 0]

  const bounds = points.reduce(
    (current, [lat, lng]) => ({
      minLat: Math.min(current.minLat, lat),
      maxLat: Math.max(current.maxLat, lat),
      minLng: Math.min(current.minLng, lng),
      maxLng: Math.max(current.maxLng, lng),
    }),
    {
      minLat: Number.POSITIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
      minLng: Number.POSITIVE_INFINITY,
      maxLng: Number.NEGATIVE_INFINITY,
    },
  )
  const center: TownshipPoint = [
    (bounds.minLat + bounds.maxLat) / 2,
    (bounds.minLng + bounds.maxLng) / 2,
  ]
  if (isPointInsideTownship(center, primaryFeature)) return center

  const candidates = primaryFeature.rings
    .map(ringCentroid)
    .filter((point): point is TownshipPoint => point != null && isPointInsideTownship(point, primaryFeature))

  const gridSize = 18
  for (let latIndex = 1; latIndex < gridSize; latIndex += 1) {
    for (let lngIndex = 1; lngIndex < gridSize; lngIndex += 1) {
      const candidate: TownshipPoint = [
        bounds.minLat + ((bounds.maxLat - bounds.minLat) * latIndex) / gridSize,
        bounds.minLng + ((bounds.maxLng - bounds.minLng) * lngIndex) / gridSize,
      ]
      if (isPointInsideTownship(candidate, primaryFeature)) candidates.push(candidate)
    }
  }

  return (
    candidates.sort(
      (first, second) =>
        Math.hypot(first[0] - center[0], first[1] - center[1]) -
        Math.hypot(second[0] - center[0], second[1] - center[1]),
    )[0] ?? points[0]!
  )
}

export function parseTownshipFeatures(value: unknown): TownshipFeature[] {
  if (!value || typeof value !== 'object') return []

  const recordset = (value as IServerQueryResult).recordsets?.[0]
  const features = recordset?.features ?? []
  return features.flatMap((feature) => {
    const { code, name } = resolveTownshipIdentity(recordset ?? {}, feature)
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
    return [{ code, name, rings }]
  })
}

export function resolveTownshipMapServiceUrl(serviceUrl: string): string {
  const normalizedUrl = serviceUrl.replace(/\/+$/, '')
  const serviceRootMatch = normalizedUrl.match(/\/services\/([^/]+)\/rest$/i)
  if (!serviceRootMatch) return normalizedUrl

  const mapName = serviceRootMatch[1]
  return `${normalizedUrl}/maps/${mapName}`
}

export function resolveCountyMapServiceUrl(serviceUrl: string): string {
  const normalizedUrl = serviceUrl.replace(/\/+$/, '')
  const serviceMatch = normalizedUrl.match(/^(.*\/services\/)[^/]+\/rest(?:\/maps\/[^/]+)?$/i)
  if (!serviceMatch) return ''

  return `${serviceMatch[1]}${COUNTY_SERVICE_NAME}/rest/maps/${COUNTY_SERVICE_NAME}`
}

async function loadRegionFeatures(mapServiceUrl: string, datasetName: string, featureLabel: string) {
  const response = await fetch(`${mapServiceUrl}/queryResults.json?returnContent=true`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queryMode: 'SqlQuery',
      queryParameters: {
        queryParams: [{ name: datasetName, attributeFilter: '1=1' }],
        startRecord: 0,
        expectCount: 100,
        queryOption: 'ATTRIBUTEANDGEOMETRY',
      },
    }),
  })

  if (!response.ok) throw new Error(`iServer ${featureLabel}查询失败（HTTP ${response.status}）`)

  const features = parseTownshipFeatures(await response.json())
  if (features.length === 0) throw new Error(`iServer 未返回有效${featureLabel}`)
  return features
}

export async function loadTownshipFeatures(serviceUrl: string): Promise<TownshipFeature[]> {
  const mapServiceUrl = resolveTownshipMapServiceUrl(serviceUrl)
  const datasetName = decodeURIComponent(mapServiceUrl.slice(mapServiceUrl.lastIndexOf('/') + 1)).toLowerCase()
  return loadRegionFeatures(mapServiceUrl, datasetName, '乡镇要素')
}

export async function loadCountyFeatures(townshipServiceUrl: string): Promise<TownshipFeature[]> {
  const mapServiceUrl = resolveCountyMapServiceUrl(townshipServiceUrl)
  if (!mapServiceUrl) throw new Error('无法从乡镇服务地址解析兰考县县界服务')
  return loadRegionFeatures(mapServiceUrl, COUNTY_SERVICE_NAME, '县界要素')
}
