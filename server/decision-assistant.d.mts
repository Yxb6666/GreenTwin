export class DecisionAssistantError extends Error {
  statusCode: number
  publicMessage: string
}

export function validateDecisionAssistantRequest(
  value: unknown,
): Record<string, unknown>
export function generateDecisionAnswer(
  value: unknown,
  options?: Record<string, unknown>,
): Promise<Record<string, unknown>>
export function createDecisionAssistantMiddleware(
  options?: Record<string, unknown>,
): (request: unknown, response: unknown) => Promise<void>
