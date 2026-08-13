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

  it('场景覆盖物使用 Cesium 原生颜色材质避免回退为白色', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain('Color.fromCssColorString')
    expect(source).toContain("cesiumColor('#12e1d3')")
    expect(source).toContain("cesiumColor('#f0b85c')")
  })

  it('排水沟与抬升路面使用带立面的三维示意几何', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain('corridor: {')
    expect(source).toContain('wall: {')
    expect(source).toContain('roadVisualScale = 8')
    expect(source).toContain('ditchVisualScale = 5')
  })
})
