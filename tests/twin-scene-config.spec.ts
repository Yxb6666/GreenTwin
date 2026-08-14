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

    expect(source).toContain('longitude: 114.965')
    expect(source).toContain('latitude: 34.95')
    expect(source).toContain('longitude: simulationFocus.longitude - 0.00076')
    expect(source).toContain('latitude: simulationFocus.latitude - 0.00404')
    expect(source).toContain('height: 650')
    expect(source).toContain('heading: 10')
    expect(source).toContain('pitch: -55')
    expect(source).toContain('simulationCamera.longitude')
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

  it('三生模拟场景内置悬浮工具条并支持截图导出', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain('SceneToolbox')
    expect(source).toContain('preserveDrawingBuffer: true')
    expect(source).toContain('@update-layer="updateSceneLayer"')
  })

  it('三生模拟场景加载水系、路网与 POI 数据图层', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain('fetchIServerFeatures')
    expect(source).toContain("mapName: 'Lankao_POI_2025'")
    expect(source).toContain("mapName: 'Lankao_Road_Network'")
    expect(source).toContain("mapName: 'Lankao_Water'")
    expect(source).toContain("key: 'poiLayer'")
  })
})
