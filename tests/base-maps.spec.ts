import { describe, expect, it } from 'vitest'
import { BASE_MAP_OPTIONS, buildArcGisTileUrl, getBaseMapOption } from '@/gis/leaflet/baseMaps'

describe('ArcGIS 底图配置', () => {
  it('提供四种指定的 ArcGIS 底图', () => {
    expect(BASE_MAP_OPTIONS.map((option) => option.key)).toEqual([
      'light-gray',
      'dark-gray',
      'outdoor',
      'standard',
    ])
    expect(getBaseMapOption('standard')?.tileUrl).toContain('/World_Imagery/MapServer/tile/{z}/{y}/{x}')
  })

  it('使用 ArcGIS 要求的层级、行、列顺序并编码令牌', () => {
    expect(buildArcGisTileUrl('arcgis/light-gray', 'token + value')).toBe(
      'https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/light-gray/static/tile/{z}/{y}/{x}?token=token%20%2B%20value',
    )
  })
})
