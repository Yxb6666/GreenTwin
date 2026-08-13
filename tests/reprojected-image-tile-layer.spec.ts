import { describe, expect, it } from 'vitest'
import {
  buildGeographicImageTileUrl,
  webMercatorRowToGeographicSource,
} from '@/gis/leaflet/reprojectedImageTileLayer'

describe('土地利用影像瓦片重投影', () => {
  it('将兰考县 Web Mercator 行号映射到 EPSG4326 影像行号', () => {
    const source = webMercatorRowToGeographicSource(405, 128, 10)

    expect(source.tileY).toBe(156)
    expect(source.pixelY).toBeGreaterThanOrEqual(0)
    expect(source.pixelY).toBeLessThan(256)
  })

  it('构造包含分类色表的影像瓦片请求', () => {
    const url = new URL(
      buildGeographicImageTileUrl(
        {
          serviceUrl: 'http://example.com/restjsr/',
          collectionId: 'Lankao-Land',
          renderingRule: {
            displayMode: 'STRETCHED',
            colorTable: ['1: 250,227,156,255'],
          },
        },
        10,
        838,
        157,
      ),
    )

    expect(url.pathname).toBe('/restjsr/collections/Lankao-Land/tile.png')
    expect(url.searchParams.get('z')).toBe('10')
    expect(url.searchParams.get('x')).toBe('838')
    expect(url.searchParams.get('y')).toBe('157')
    expect(JSON.parse(url.searchParams.get('renderingRule') ?? '{}')).toMatchObject({
      colorTable: ['1: 250,227,156,255'],
    })
  })
})
