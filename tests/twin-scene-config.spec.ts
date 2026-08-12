import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const runtimeConfigPath = resolve(
  process.cwd(),
  'public/config/runtime-config.json',
)
const twinViewPath = resolve(process.cwd(), 'src/features/twin/TwinView.vue')

describe('三生模拟场景配置', () => {
  it('不加载公共示例三维模型', async () => {
    const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8'))

    expect(config.supermap.realspace).toEqual({
      whiteModel: '',
      oblique: '',
      lidar: '',
    })
  })

  it('使用堌阳镇范围定位且不自动飞向外部模型', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain('longitude: 114.964285')
    expect(source).toContain('latitude: 34.9511')
    expect(source).not.toContain('addS3MTilesLayerByScp')
    expect(source).not.toContain('viewer.flyTo')
  })

  it('三生模拟场景使用 ArcGIS 导航底图而不是街道图栅格代理', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain(
      "buildArcGisTileUrl('arcgis/navigation', config.arcgis.accessToken)",
    )
    expect(source).not.toContain('/api/arcgis/world-streets/raster/')
  })
})
