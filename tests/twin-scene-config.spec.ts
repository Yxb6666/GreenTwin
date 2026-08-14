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
    expect(source).toContain('longitude: simulationFocus.longitude - 0.00097')
    expect(source).toContain('latitude: simulationFocus.latitude - 0.00128')
    expect(source).toContain('height: 48')
    expect(source).toContain('heading: 32')
    expect(source).toContain('pitch: -16')
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

  it('三生模拟场景保留阴影分析并移除通视分析', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain('shadowAnalysisActive')
    expect(source).toContain('viewer.scene.shadowMap.enabled = active')
    expect(source).toContain('shadows: sdk.ShadowMode?.ENABLED')
    expect(source).toContain('@toggle-shadow="applyShadowAnalysis(!shadowAnalysisActive)"')
    expect(source).not.toContain('pickFromRay')
    expect(source).not.toContain('VisibilityAnalysis')
    expect(source).not.toContain('通视分析')
  })

  it('三生模拟页面不再显示顶部方案任务栏', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).not.toContain('simulation-workbar')
    expect(source).not.toContain('SIM-2026-001')
    expect(source).not.toContain('保存草案')
    expect(source).not.toContain('下发治理')
  })

  it('三生模拟场景加载水系、路网与 POI 数据图层', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain('fetchIServerFeatures')
    expect(source).toContain("mapName: 'Lankao_POI_2025'")
    expect(source).toContain("mapName: 'Lankao_Road_Network'")
    expect(source).toContain("mapName: 'Lankao_Water'")
    expect(source).toContain("key: 'poiLayer'")
  })

  it('公园服务圈使用状态驱动的单路径操作卡', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain('title="公园服务圈"')
    expect(source).toContain('isochronePhase')
    expect(source).toContain('生成公园可达服务圈')
    expect(source).toContain('在地图中选择公园位置')
    expect(source).toContain('取消地图选点')
    expect(source).toContain('clearParkServiceArea')
    expect(source).toContain('aria-label="清除公园和等时圈"')
    expect(source).toContain('公园模型与等时圈已清除')
    expect(source).toContain(':aria-pressed="isochroneProfile === option.value"')
    expect(source).not.toContain('放置公园模型')
  })
})
