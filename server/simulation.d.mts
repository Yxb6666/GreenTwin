import type { IncomingMessage, ServerResponse } from 'node:http'

export interface SimulationServiceOptions {
  blenderExecutable?: string
  outputDirectory?: string
  scriptPath?: string
  timeoutMs?: number
}

export function validateSimulationRequest(
  value: unknown,
): Record<string, string | number>
export function createSimulationService(
  options?: SimulationServiceOptions,
): Record<string, unknown>
export function createSimulationMiddleware(
  options?: SimulationServiceOptions,
): (
  request: IncomingMessage,
  response: ServerResponse,
  pathname?: string,
) => Promise<void>
