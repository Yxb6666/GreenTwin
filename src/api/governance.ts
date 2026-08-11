export interface GovernanceIssueImage {
  url: string
}

export type GovernanceIssueStatus = '待审核' | '已派单' | '处理中' | '已办结'

export interface CreateGovernanceIssueRequest {
  userId: string
  type: string
  subtype: string
  description: string
  images: GovernanceIssueImage[]
  town: string
  village: string
  longitude: number
  latitude: number
  contact: string
  phone: string
  time: string
}

export interface GovernanceIssue extends CreateGovernanceIssueRequest {
  id: string
  status: GovernanceIssueStatus
}

export interface GovernanceGeoJsonFeature {
  type: 'Feature'
  id?: string
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: Record<string, unknown>
}

export interface GovernanceFeatureCollection {
  type: 'FeatureCollection'
  name?: string
  crs?: unknown
  metadata?: Record<string, unknown>
  features: GovernanceGeoJsonFeature[]
}

interface CreateGovernanceIssueResponse {
  success: true
  id: string
}

interface GetGovernanceIssueResponse {
  success: true
  issue: GovernanceIssue
}

export interface GovernanceIssueSummary {
  total: number
  processing: number
  completed: number
}

export interface GovernanceUserIssuesResponse {
  success: true
  userId: string
  summary: GovernanceIssueSummary
  issues: GovernanceIssue[]
}

function endpoint(apiBaseUrl: string, suffix = '') {
  return `${apiBaseUrl.replace(/\/$/, '')}/governance/issues${suffix}`
}

function isFeatureCollection(value: unknown): value is GovernanceFeatureCollection {
  if (!value || typeof value !== 'object') return false
  const collection = value as Partial<GovernanceFeatureCollection>
  return collection.type === 'FeatureCollection' && Array.isArray(collection.features)
}

function isIssue(value: unknown): value is GovernanceIssue {
  if (!value || typeof value !== 'object') return false
  const issue = value as Partial<GovernanceIssue>
  return Boolean(
    issue.id &&
      issue.type &&
      issue.subtype &&
      issue.town &&
      issue.village &&
      typeof issue.longitude === 'number' &&
      typeof issue.latitude === 'number' &&
      issue.status,
  )
}

function isUserIssuesResponse(value: unknown): value is GovernanceUserIssuesResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<GovernanceUserIssuesResponse>
  const summary = response.summary as Partial<GovernanceIssueSummary> | undefined
  return Boolean(
    response.success === true &&
      typeof response.userId === 'string' &&
      summary &&
      typeof summary.total === 'number' &&
      typeof summary.processing === 'number' &&
      typeof summary.completed === 'number' &&
      Array.isArray(response.issues) &&
      response.issues.every(isIssue),
  )
}

async function requestJson(
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        result &&
        typeof result === 'object' &&
        'message' in result &&
        typeof result.message === 'string'
          ? result.message
          : `请求失败（HTTP ${response.status}）`
      throw new Error(message)
    }
    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error('请求超时，请稍后重试')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function listGovernanceIssues(
  apiBaseUrl: string,
  timeoutMs: number,
) {
  const result = await requestJson(endpoint(apiBaseUrl), timeoutMs)
  if (!isFeatureCollection(result)) throw new Error('问题列表数据格式不正确')
  return result
}

export async function createGovernanceIssue(
  apiBaseUrl: string,
  timeoutMs: number,
  payload: CreateGovernanceIssueRequest,
) {
  const result = await requestJson(endpoint(apiBaseUrl), timeoutMs, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (
    !result ||
    typeof result !== 'object' ||
    !('success' in result) ||
    result.success !== true ||
    !('id' in result) ||
    typeof result.id !== 'string'
  )
    throw new Error('提交接口返回格式不正确')
  return result as CreateGovernanceIssueResponse
}

export async function getGovernanceIssue(
  apiBaseUrl: string,
  timeoutMs: number,
  id: string,
) {
  const result = await requestJson(
    endpoint(apiBaseUrl, `/${encodeURIComponent(id)}`),
    timeoutMs,
  )
  if (
    !result ||
    typeof result !== 'object' ||
    !('success' in result) ||
    result.success !== true ||
    !('issue' in result) ||
    !isIssue(result.issue)
  )
    throw new Error('问题详情数据格式不正确')
  return (result as GetGovernanceIssueResponse).issue
}

export async function listGovernanceIssuesByUser(
  apiBaseUrl: string,
  timeoutMs: number,
  userId: string,
) {
  const result = await requestJson(
    endpoint(apiBaseUrl, `/user/${encodeURIComponent(userId)}`),
    timeoutMs,
  )
  if (!isUserIssuesResponse(result)) throw new Error('用户问题列表数据格式不正确')
  return result
}
