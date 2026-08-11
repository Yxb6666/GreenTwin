import type { IncomingMessage, ServerResponse } from 'node:http'

export interface GovernanceAssistantOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class GovernanceAssistantError extends Error {
  statusCode: number
  publicMessage: string
}

export interface ValidatedGovernanceAssistantRequest extends Record<string, unknown> {
  issues: Array<Record<string, unknown>>
}

export interface GovernanceAnalysis extends Record<string, unknown> {
  scoringMethod: string
  priority: Array<{ id: string } & Record<string, unknown>>
}

export interface GovernanceAnswer extends Record<string, unknown> {
  actions: Array<Record<string, unknown>>
  meta: Record<string, unknown>
}

export function validateGovernanceAssistantRequest(
  value: unknown,
): ValidatedGovernanceAssistantRequest
export function analyzeGovernanceIssues(
  value: unknown,
  options?: Record<string, unknown>,
): GovernanceAnalysis
export function generateGovernanceAnswer(
  value: unknown,
  options?: GovernanceAssistantOptions,
): Promise<GovernanceAnswer>
export function createGovernanceAssistantMiddleware(
  options?: GovernanceAssistantOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void>
