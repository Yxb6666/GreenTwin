import type { IncomingMessage, ServerResponse } from 'node:http'

export interface GovernanceIssuesService {
  create(value: unknown): Record<string, unknown>
  get(id: string): Record<string, unknown>
  list(): Record<string, unknown>
  listByUser(userId: string): Record<string, unknown>
}

export interface GovernanceIssuesOptions {
  dataPath?: string
  collection?: Record<string, unknown>
}

export class GovernanceMockError extends Error {
  statusCode: number
}

export function validateGovernanceIssueRequest(
  value: unknown,
): Record<string, unknown>
export function createGovernanceIssuesService(
  options?: GovernanceIssuesOptions,
): GovernanceIssuesService
export function createGovernanceIssuesMiddleware(
  options?: GovernanceIssuesOptions,
): (
  request: IncomingMessage,
  response: ServerResponse,
  next?: () => void,
) => Promise<void>
