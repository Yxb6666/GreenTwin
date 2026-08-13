import L from 'leaflet'

export interface ReprojectedImageTileLayerOptions extends L.GridLayerOptions {
  serviceUrl: string
  collectionId: string
  renderingRule: Record<string, unknown>
}

interface GeographicSourcePixel {
  tileY: number
  pixelY: number
}

const SOURCE_TILE_SIZE = 256

export function webMercatorRowToGeographicSource(
  tileY: number,
  pixelY: number,
  zoom: number,
  outputTileSize = SOURCE_TILE_SIZE,
): GeographicSourcePixel {
  const tilesAtZoom = 2 ** zoom
  const normalizedMercatorY = (tileY + pixelY / outputTileSize) / tilesAtZoom
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - 2 * normalizedMercatorY))) * 180) / Math.PI
  const geographicPixelY = ((90 - latitude) / 360) * tilesAtZoom * SOURCE_TILE_SIZE

  return {
    tileY: Math.floor(geographicPixelY / SOURCE_TILE_SIZE),
    pixelY: geographicPixelY % SOURCE_TILE_SIZE,
  }
}

export function buildGeographicImageTileUrl(
  options: Pick<ReprojectedImageTileLayerOptions, 'serviceUrl' | 'collectionId' | 'renderingRule'>,
  zoom: number,
  tileX: number,
  tileY: number,
) {
  const collectionUrl = `${options.serviceUrl.replace(/\/+$/, '')}/collections/${encodeURIComponent(options.collectionId)}`
  const query = new URLSearchParams({
    transparent: 'true',
    cacheEnabled: 'false',
    renderingRule: JSON.stringify(options.renderingRule),
    z: String(zoom),
    x: String(tileX),
    y: String(tileY),
  })
  return `${collectionUrl}/tile.png?${query.toString()}`
}

export class ReprojectedImageTileLayer extends L.GridLayer {
  private readonly imageOptions: ReprojectedImageTileLayerOptions

  constructor(options: ReprojectedImageTileLayerOptions) {
    super(options)
    this.imageOptions = options
  }

  createTile(coords: L.Coords, done: L.DoneCallback) {
    const canvas = document.createElement('canvas')
    const tileSize = this.getTileSize()
    canvas.width = tileSize.x
    canvas.height = tileSize.y
    canvas.className = 'leaflet-tile'

    void this.renderTile(canvas, coords)
      .then(() => done(undefined, canvas))
      .catch((cause: unknown) => {
        done(cause instanceof Error ? cause : new Error('土地利用栅格瓦片重投影失败'), canvas)
      })

    return canvas
  }

  private async renderTile(canvas: HTMLCanvasElement, coords: L.Coords) {
    const outputTileSize = canvas.height
    const rowMappings = Array.from({ length: outputTileSize }, (_, row) =>
      webMercatorRowToGeographicSource(coords.y, row + 0.5, coords.z, outputTileSize),
    )
    const sourceTileRows = [...new Set(rowMappings.map(({ tileY }) => tileY))]
    const tilesAtZoom = 2 ** coords.z
    const sourceTileX = ((coords.x % tilesAtZoom) + tilesAtZoom) % tilesAtZoom
    const sourceImages = new Map<number, ImageBitmap>()

    await Promise.all(
      sourceTileRows.map(async (sourceTileY) => {
        const response = await fetch(
          buildGeographicImageTileUrl(this.imageOptions, coords.z, sourceTileX, sourceTileY),
          { cache: 'no-store', mode: 'cors' },
        )
        if (!response.ok) throw new Error(`土地利用影像瓦片请求失败（HTTP ${response.status}）`)
        sourceImages.set(sourceTileY, await createImageBitmap(await response.blob()))
      }),
    )

    try {
      const context = canvas.getContext('2d')
      if (!context) throw new Error('浏览器不支持土地利用栅格 Canvas 渲染')
      context.imageSmoothingEnabled = false

      rowMappings.forEach(({ tileY, pixelY }, outputRow) => {
        const image = sourceImages.get(tileY)
        if (!image) return
        const sourceRow = Math.min(SOURCE_TILE_SIZE - 1, Math.max(0, Math.floor(pixelY)))
        context.drawImage(
          image,
          0,
          sourceRow,
          SOURCE_TILE_SIZE,
          1,
          0,
          outputRow,
          canvas.width,
          1,
        )
      })
    } finally {
      sourceImages.forEach((image) => image.close())
    }
  }
}
