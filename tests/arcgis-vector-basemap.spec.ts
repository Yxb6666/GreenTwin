import { describe, expect, it } from 'vitest'
import {
  createWorldStreetsMetadata,
  resolveWorldStreetsResource,
  rewriteWorldStreetsStyle,
} from '../server/arcgis-vector-basemap.mjs'

describe('ArcGIS 世界街道图矢量瓦片适配', () => {
  it('向 SuperMap 提供 Web Mercator 元数据', () => {
    const metadata = createWorldStreetsMetadata()

    expect(metadata.prjCoordSys).toEqual({
      coordUnit: 'METER',
      epsgCode: 3857,
    })
    expect(metadata.viewer).toEqual({ width: 512, height: 512 })
  })

  it('将 SuperMap 的列行顺序转换为 ArcGIS 的层行列顺序', () => {
    expect(
      resolveWorldStreetsResource(
        '/api/arcgis/world-streets/tiles/12/3371/1582.mvt',
      ),
    ).toEqual({
      kind: 'binary',
      upstream:
        'https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/12/1582/3371.pbf',
    })
  })

  it('将字体和精灵资源保持在同源代理下', () => {
    const style = rewriteWorldStreetsStyle({ version: 8, layers: [] })

    expect(style.glyphs).toBe(
      '/api/arcgis/world-streets/fonts/{fontstack}/{range}.pbf',
    )
    expect(style.sprite).toBe('/api/arcgis/world-streets/sprites/sprite')
  })
})
