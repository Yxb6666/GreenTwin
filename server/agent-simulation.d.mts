import type { IncomingMessage, ServerResponse } from 'node:http'

export interface AgentSimulationServiceOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  blenderExecutable?: string
  outputDirectory?: string
  scriptPath?: string
  timeoutMs?: number
  scriptTimeoutMs?: number
}

export function validateAgentRequest(
  value: unknown,
): Record<string, unknown>
export function extractAgentCode(content: string): string
export function validateGeneratedCode(code: string): {
  length: number
  primitiveCalls: number
}
export function generateAgentScript(
  prompt: string,
  building: Record<string, unknown>,
  options?: Record<string, unknown>,
  timeoutMs?: number,
): Promise<string>
export function createAgentSimulationService(
  options?: AgentSimulationServiceOptions,
): Record<string, unknown>
export function createAgentSimulationMiddleware(
  options?: AgentSimulationServiceOptions,
): (
  request: IncomingMessage,
  response: ServerResponse,
  pathname?: string,
) => Promise<void>
