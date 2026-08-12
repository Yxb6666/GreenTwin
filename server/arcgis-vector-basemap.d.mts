import type { IncomingMessage, ServerResponse } from 'node:http'

export interface WorldStreetsMetadata {
  bounds: {
    left: number
    bottom: number
    right: number
    top: number
  }
  prjCoordSys: {
    coordUnit: 'METER'
    epsgCode: 3857
  }
  viewer: {
    width: number
    height: number
  }
}

export type WorldStreetsResource =
  | { kind: 'metadata' }
  | { kind: 'style' | 'binary' | 'json'; upstream: string }

export function createWorldStreetsMetadata(): WorldStreetsMetadata

export function rewriteWorldStreetsStyle<T extends object>(
  style: T,
  routePrefix?: string,
): T & { glyphs: string; sprite: string }

export function resolveWorldStreetsResource(
  pathname: string,
): WorldStreetsResource | null

export function createArcGisVectorBasemapMiddleware(options?: {
  fetch?: typeof globalThis.fetch
}): (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
) => Promise<void>
