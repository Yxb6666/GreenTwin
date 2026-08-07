export interface DemSummary {
  collectionId: string
  crs: string
  fileName: string
  width: number
  height: number
  pixelSizeDegrees: number
  thumbnailUrl: string
  averageElevationM: number | null
  minimumElevationM: number | null
  maximumElevationM: number | null
  validSampleCount: number
}

interface DemItemMetadata {
  bbox: [number, number, number, number]
  collectionId: string
  crs: string
  fileName: string
  width: number
  height: number
  pixelSizeDegrees: number
  thumbnailUrl: string
}

const NO_DATA_THRESHOLD = -10_000

export const DEM_RENDERING_RULE: Record<string, unknown> = {
  displayMode: 'STRETCHED',
  displayBands: '0',
  interpolationMode: 'BILINEAR',
  stretchOption: { stretchType: 'NONE' },
  colorTable: [
    '45:31,76,68',
    '55:54,116,82',
    '65:113,158,91',
    '70:181,181,89',
    '75:211,151,70',
    '85:225,208,147',
  ],
  gridFuncOptions: [{ Altitude: 45, Azimuth: 315, ZFactor: 0.00001, girdFuncName: 'GFHillShade' }],
}

function finiteNumber(value: unknown): number | null {
  const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(numericValue) ? numericValue : null
}

export function parseDemItem(value: unknown): DemItemMetadata | null {
  if (!value || typeof value !== 'object') return null
  const item = value as {
    bbox?: unknown[]
    collection?: unknown
    assets?: { thumbnail?: { href?: unknown } }
    properties?: Record<string, unknown>
  }
  const bboxValues = item.bbox?.map(finiteNumber) ?? []
  if (bboxValues.length !== 4 || bboxValues.some((coordinate) => coordinate === null)) return null

  const properties = item.properties ?? {}
  const width = finiteNumber(properties.width)
  const height = finiteNumber(properties.height)
  const pixelSizeDegrees = finiteNumber(properties.smhighps)
  if (!width || !height || !pixelSizeDegrees) return null

  return {
    bbox: bboxValues as [number, number, number, number],
    collectionId: String(item.collection ?? ''),
    crs: String(properties.crs ?? ''),
    fileName: String(properties.smfilename ?? ''),
    width,
    height,
    pixelSizeDegrees,
    thumbnailUrl: typeof item.assets?.thumbnail?.href === 'string' ? item.assets.thumbnail.href : '',
  }
}

export function buildDemSamplePoints(
  [west, south, east, north]: [number, number, number, number],
  columns = 7,
  rows = 5,
) {
  const points: Array<[number, number]> = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const xRatio = columns === 1 ? 0.5 : 0.05 + (0.9 * column) / (columns - 1)
      const yRatio = rows === 1 ? 0.5 : 0.05 + (0.9 * row) / (rows - 1)
      points.push([west + (east - west) * xRatio, south + (north - south) * yRatio])
    }
  }
  return points
}

export function summarizeElevations(values: unknown[]) {
  const elevations = values
    .map(finiteNumber)
    .filter((value): value is number => value !== null && value > NO_DATA_THRESHOLD && value < 10_000)
  if (elevations.length === 0) {
    return { averageElevationM: null, minimumElevationM: null, maximumElevationM: null, validSampleCount: 0 }
  }

  return {
    averageElevationM: Math.round((elevations.reduce((sum, value) => sum + value, 0) / elevations.length) * 10) / 10,
    minimumElevationM: Math.min(...elevations),
    maximumElevationM: Math.max(...elevations),
    validSampleCount: elevations.length,
  }
}

export async function loadDemSummary(serviceUrl: string, collectionId: string, itemId: string): Promise<DemSummary> {
  const collectionUrl = `${serviceUrl.replace(/\/+$/, '')}/collections/${encodeURIComponent(collectionId)}`
  const itemResponse = await fetch(`${collectionUrl}/items/${encodeURIComponent(itemId)}.json`, { cache: 'no-store' })
  if (!itemResponse.ok) throw new Error(`DEM 元数据请求失败（HTTP ${itemResponse.status}）`)

  const metadata = parseDemItem(await itemResponse.json())
  if (!metadata) throw new Error('DEM 元数据格式无效')

  const samples = await Promise.all(
    buildDemSamplePoints(metadata.bbox).map(async ([x, y]) => {
      try {
        const response = await fetch(`${collectionUrl}/rasterValue.json?x=${x}&y=${y}`, { cache: 'no-store' })
        if (!response.ok) return null
        const value = (await response.json()) as { rasterValueInfo?: { bandValues?: unknown[] } }
        return value.rasterValueInfo?.bandValues?.[0] ?? null
      } catch {
        return null
      }
    }),
  )

  return { ...metadata, ...summarizeElevations(samples) }
}
