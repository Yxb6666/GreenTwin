export type DecisionAssistantValue = string | number | boolean | null
export type DecisionAssistantData = Record<
  string,
  | DecisionAssistantValue
  | DecisionAssistantValue[]
  | Record<string, DecisionAssistantValue>
>

export interface DecisionAssistantContext {
  module: string
  scopeLabel: string
  updatedAt: string
  data: DecisionAssistantData
}

export interface DecisionAssistantResponse {
  answer: string
  evidence: string[]
  suggestions: string[]
  disclaimer: string
  scopeLabel: string
  meta: {
    model: string
    generatedAt: string
  }
}

export interface DecisionAssistantRequest {
  question: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  context: DecisionAssistantContext
}

function isDecisionAssistantResponse(
  value: unknown,
): value is DecisionAssistantResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<DecisionAssistantResponse>
  return Boolean(
    typeof response.answer === 'string' &&
      Array.isArray(response.evidence) &&
      Array.isArray(response.suggestions) &&
      typeof response.disclaimer === 'string' &&
      typeof response.scopeLabel === 'string' &&
      response.meta &&
      typeof response.meta.model === 'string',
  )
}

export async function requestDecisionAssistant(
  endpoint: string,
  timeoutMs: number,
  payload: DecisionAssistantRequest,
): Promise<DecisionAssistantResponse> {
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
    if (!isDecisionAssistantResponse(result))
      throw new Error('AI 返回的数据结构不正确')
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
