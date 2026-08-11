export interface GovernanceSceneContext {
  issueId: string
  longitude: number
  latitude: number
  town: string
  village: string
  subtype: string
  issueType: string
  description: string
  urgency: string
  status: string
}

function firstString(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

export function parseGovernanceSceneContext(
  issueIdValue: unknown,
  query: Record<string, unknown>,
): GovernanceSceneContext | null {
  const issueId = firstString(issueIdValue).trim()
  const longitude = Number(firstString(query.longitude))
  const latitude = Number(firstString(query.latitude))

  if (
    !issueId ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  )
    return null

  return {
    issueId,
    longitude,
    latitude,
    town: firstString(query.town),
    village: firstString(query.village),
    subtype: firstString(query.subtype),
    issueType: firstString(query.issueType),
    description: firstString(query.description),
    urgency: firstString(query.urgency),
    status: firstString(query.status),
  }
}

export function inferGovernanceScenario(
  context: Pick<GovernanceSceneContext, 'issueType' | 'subtype'>,
) {
  const text = `${context.issueType} ${context.subtype}`
  if (/生态|河|岸线|垃圾|焚烧/.test(text)) return 'ecology' as const
  if (/农业|农田|灌|机井|大棚/.test(text)) return 'irrigation' as const
  if (/公共|人居|公厕|健身|候车|路灯/.test(text)) return 'public-space' as const
  return 'waterlogging' as const
}
