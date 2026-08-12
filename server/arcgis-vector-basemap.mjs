const SERVICE_URL =
  'https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer'
const RASTER_SERVICE_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer'

const ROUTE_PREFIX = '/api/arcgis/world-streets'

export function createWorldStreetsMetadata() {
  return {
    bounds: {
      left: -20037508.342789244,
      bottom: -20037508.342789244,
      right: 20037508.342789244,
      top: 20037508.342789244,
    },
    prjCoordSys: { coordUnit: 'METER', epsgCode: 3857 },
    viewer: { width: 512, height: 512 },
  }
}

export function rewriteWorldStreetsStyle(style, routePrefix = ROUTE_PREFIX) {
  return {
    ...style,
    glyphs: `${routePrefix}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${routePrefix}/sprites/sprite`,
  }
}

export function resolveWorldStreetsResource(pathname) {
  if (pathname === `${ROUTE_PREFIX}.json`) return { kind: 'metadata' }
  if (pathname === `${ROUTE_PREFIX}/style.json`) {
    return {
      kind: 'style',
      upstream: `${SERVICE_URL}/resources/styles/root.json`,
    }
  }

  const tile = pathname.match(
    new RegExp(`^${ROUTE_PREFIX}/tiles/(\\d+)/(\\d+)/(\\d+)\\.mvt$`),
  )
  if (tile) {
    const [, level, column, row] = tile
    return {
      kind: 'binary',
      upstream: `${SERVICE_URL}/tile/${level}/${row}/${column}.pbf`,
    }
  }

  const rasterTile = pathname.match(
    new RegExp(`^${ROUTE_PREFIX}/raster/(\\d+)/(\\d+)/(\\d+)\\.png$`),
  )
  if (rasterTile) {
    const [, level, column, row] = rasterTile
    return {
      kind: 'binary',
      upstream: `${RASTER_SERVICE_URL}/tile/${level}/${row}/${column}`,
    }
  }

  const sprite = pathname.match(
    new RegExp(`^${ROUTE_PREFIX}/sprites/(sprite(?:@2x)?\\.(?:json|png))$`),
  )
  if (sprite) {
    return {
      kind: sprite[1].endsWith('.json') ? 'json' : 'binary',
      upstream: `${SERVICE_URL}/resources/sprites/${sprite[1]}`,
    }
  }

  const font = pathname.match(
    new RegExp(`^${ROUTE_PREFIX}/fonts/([^/]+)/(\\d+-\\d+)\\.pbf$`),
  )
  if (font) {
    return {
      kind: 'binary',
      upstream: `${SERVICE_URL}/resources/fonts/${encodeURIComponent(decodeURIComponent(font[1]))}/${font[2]}.pbf`,
    }
  }

  return null
}

function sendJson(response, value) {
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  })
  response.end(JSON.stringify(value))
}

export function createArcGisVectorBasemapMiddleware(options = {}) {
  const request = options.fetch ?? globalThis.fetch

  return async function arcGisVectorBasemapMiddleware(
    incomingRequest,
    response,
    pathname,
  ) {
    if (incomingRequest.method !== 'GET' && incomingRequest.method !== 'HEAD') {
      response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Method Not Allowed')
      return
    }

    const resource = resolveWorldStreetsResource(pathname)
    if (!resource) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not Found')
      return
    }

    if (resource.kind === 'metadata') {
      sendJson(response, createWorldStreetsMetadata())
      return
    }

    try {
      const upstreamResponse = await request(resource.upstream)
      if (!upstreamResponse.ok) {
        response.writeHead(upstreamResponse.status, {
          'Content-Type': 'text/plain; charset=utf-8',
        })
        response.end(`ArcGIS request failed: HTTP ${upstreamResponse.status}`)
        return
      }

      if (resource.kind === 'style') {
        sendJson(
          response,
          rewriteWorldStreetsStyle(await upstreamResponse.json()),
        )
        return
      }

      const body = Buffer.from(await upstreamResponse.arrayBuffer())
      response.writeHead(200, {
        'Content-Type':
          upstreamResponse.headers.get('content-type') ||
          (resource.kind === 'json'
            ? 'application/json; charset=utf-8'
            : 'application/octet-stream'),
        'Cache-Control': 'public, max-age=86400',
      })
      if (incomingRequest.method === 'HEAD') response.end()
      else response.end(body)
    } catch (error) {
      response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(
        error instanceof Error
          ? error.message
          : 'ArcGIS basemap request failed',
      )
    }
  }
}
