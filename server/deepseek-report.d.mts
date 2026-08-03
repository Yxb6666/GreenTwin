import type { IncomingMessage, ServerResponse } from 'node:http'

export interface DeepseekReportOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class ReportServiceError extends Error {
  statusCode: number
  publicMessage: string
}

export function validateReportRequest(value: unknown): Record<string, unknown>
export function generateDeepseekReport(
  value: unknown,
  options?: DeepseekReportOptions,
): Promise<{ report: Record<string, unknown>; meta: Record<string, unknown> }>
export function createReportMiddleware(
  options?: DeepseekReportOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void>
