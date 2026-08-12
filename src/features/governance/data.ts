export const issueStatuses = ['待审核', '已派单', '处理中', '已办结'] as const
export const urgencyLevels = ['高', '中', '低'] as const

export type IssueStatus = (typeof issueStatuses)[number]
export type Urgency = (typeof urgencyLevels)[number]

export interface GovernanceIssue {
  id: string
  type: string
  subtype: string
  description: string
  contact: string
  phone: string
  townCode: string
  town: string
  villageCode: string
  village: string
  address: string
  time: string
  urgency: Urgency
  status: IssueStatus
  channel: string
  dataClass: string
  longitude: number
  latitude: number
}

interface GeoJsonPointFeature {
  type?: unknown
  geometry?: { type?: unknown; coordinates?: unknown }
  properties?: Record<string, unknown>
}

interface GeoJsonFeatureCollection {
  type?: unknown
  features?: unknown
}

export interface QueryBounds {
  south: number
  west: number
  north: number
  east: number
}

function isIssueStatus(value: unknown): value is IssueStatus {
  return issueStatuses.includes(value as IssueStatus)
}

function isUrgency(value: unknown): value is Urgency {
  return urgencyLevels.includes(value as Urgency)
}

function stringProperty(properties: Record<string, unknown>, key: string) {
  const value = properties[key]
  return typeof value === 'string' ? value : ''
}

export function parseGovernanceIssues(value: unknown): GovernanceIssue[] {
  if (!value || typeof value !== 'object') return []
  const collection = value as GeoJsonFeatureCollection
  if (
    collection.type !== 'FeatureCollection' ||
    !Array.isArray(collection.features)
  )
    return []

  return collection.features.flatMap((rawFeature) => {
    if (!rawFeature || typeof rawFeature !== 'object') return []
    const feature = rawFeature as GeoJsonPointFeature
    const coordinates = feature.geometry?.coordinates
    const properties = feature.properties
    if (
      feature.type !== 'Feature' ||
      feature.geometry?.type !== 'Point' ||
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      typeof coordinates[0] !== 'number' ||
      !Number.isFinite(coordinates[0]) ||
      typeof coordinates[1] !== 'number' ||
      !Number.isFinite(coordinates[1]) ||
      !properties ||
      !isIssueStatus(properties.status) ||
      !isUrgency(properties.urgency)
    )
      return []

    const issue: GovernanceIssue = {
      id: stringProperty(properties, 'id'),
      type: stringProperty(properties, 'type'),
      subtype: stringProperty(properties, 'subtype'),
      description: stringProperty(properties, 'description'),
      contact: stringProperty(properties, 'contact'),
      phone: stringProperty(properties, 'phone'),
      townCode: stringProperty(properties, 'townCode'),
      town: stringProperty(properties, 'town'),
      villageCode: stringProperty(properties, 'villageCode'),
      village: stringProperty(properties, 'village'),
      address: stringProperty(properties, 'address'),
      time: stringProperty(properties, 'time'),
      urgency: properties.urgency,
      status: properties.status,
      channel: stringProperty(properties, 'channel'),
      dataClass: stringProperty(properties, 'dataClass'),
      longitude: coordinates[0],
      latitude: coordinates[1],
    }

    return issue.id && issue.type && issue.town ? [issue] : []
  })
}

export async function loadGovernanceIssues(
  dataUrl: string,
): Promise<GovernanceIssue[]> {
  const response = await fetch(dataUrl, { cache: 'no-store' })
  if (!response.ok)
    throw new Error(`治理问题要素数据加载失败（HTTP ${response.status}）`)
  const issues = parseGovernanceIssues(await response.json())
  if (issues.length === 0) throw new Error('治理问题要素数据为空或格式不正确')
  return issues
}

export function queryIssuesByBounds(
  issues: GovernanceIssue[],
  bounds: QueryBounds,
) {
  return issues.filter(
    (issue) =>
      issue.latitude >= bounds.south &&
      issue.latitude <= bounds.north &&
      issue.longitude >= bounds.west &&
      issue.longitude <= bounds.east,
  )
}

export function distanceInMeters(
  origin: [number, number],
  target: [number, number],
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadius = 6_371_008.8
  const latitudeDelta = toRadians(target[0] - origin[0])
  const longitudeDelta = toRadians(target[1] - origin[1])
  const originLatitude = toRadians(origin[0])
  const targetLatitude = toRadians(target[0])
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(targetLatitude) *
      Math.sin(longitudeDelta / 2) ** 2
  return (
    earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  )
}

export function queryIssuesByRadius(
  issues: GovernanceIssue[],
  center: [number, number],
  radiusMeters: number,
) {
  return issues.filter(
    (issue) =>
      distanceInMeters(center, [issue.latitude, issue.longitude]) <=
      radiusMeters,
  )
}
