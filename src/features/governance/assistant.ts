import type { GovernanceIssue, QueryBounds } from './data'

export interface GovernanceAssistantContext {
  module: '乡村治理'
  scopeLabel: string
  hasSpatialQuery: boolean
  selectedIssueId: string
  dataUpdatedAt: string
  userRole: string
  map: {
    bounds: QueryBounds
    zoom: number
    visibleLayers: string[]
  }
  filters: {
    keyword: string
    type: string
    town: string
    urgency: string
    status: string
  }
}

export type GovernanceAssistantIssue = Pick<
  GovernanceIssue,
  | 'id'
  | 'type'
  | 'subtype'
  | 'description'
  | 'town'
  | 'village'
  | 'address'
  | 'time'
  | 'urgency'
  | 'status'
  | 'longitude'
  | 'latitude'
>

export type GovernanceAssistantAction =
  | { type: 'HIGHLIGHT_ISSUES'; issueIds: string[] }
  | { type: 'LOCATE_ISSUE'; issueId: string }
  | { type: 'OPEN_ISSUE'; issueId: string }
  | { type: 'OPEN_CHART'; chart: 'type' | 'status' | 'town' }

export interface GovernanceAssistantResponse {
  answer: string
  evidence: string[]
  actions: GovernanceAssistantAction[]
  scopeLabel: string
  referencedIssueIds: string[]
  disclaimer: string
  context: {
    selectedIssueId: string | null
    dataUpdatedAt: string
  }
  meta: {
    model: string
    generatedAt: string
    analysisType: string
    scope: string
    usedToolCall: boolean
  }
}

export interface GovernanceAssistantRequest {
  question: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  context: GovernanceAssistantContext
  issues: GovernanceAssistantIssue[]
  scopeIssueIds: string[]
  viewportIssueIds: string[]
}

function isAssistantAction(value: unknown): value is GovernanceAssistantAction {
  if (!value || typeof value !== 'object') return false
  const action = value as Partial<GovernanceAssistantAction>
  if (action.type === 'HIGHLIGHT_ISSUES') return Array.isArray(action.issueIds)
  if (action.type === 'LOCATE_ISSUE' || action.type === 'OPEN_ISSUE') {
    return typeof action.issueId === 'string'
  }
  return (
    action.type === 'OPEN_CHART' &&
    (action.chart === 'type' ||
      action.chart === 'status' ||
      action.chart === 'town')
  )
}

function isAssistantResponse(value: unknown): value is GovernanceAssistantResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<GovernanceAssistantResponse>
  return Boolean(
    typeof response.answer === 'string' &&
      Array.isArray(response.evidence) &&
      Array.isArray(response.actions) &&
      response.actions.every(isAssistantAction) &&
      typeof response.scopeLabel === 'string' &&
      typeof response.disclaimer === 'string' &&
      response.meta &&
      typeof response.meta.model === 'string',
  )
}

export async function requestGovernanceAssistant(
  endpoint: string,
  timeoutMs: number,
  payload: GovernanceAssistantRequest,
): Promise<GovernanceAssistantResponse> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        result &&
        typeof result === 'object' &&
        'message' in result &&
        typeof result.message === 'string'
          ? result.message
          : `AI 请求失败（HTTP ${response.status}）`
      throw new Error(message)
    }
    if (!isAssistantResponse(result)) throw new Error('AI 返回的数据结构不正确')
    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI 分析超时，请稍后重试')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
