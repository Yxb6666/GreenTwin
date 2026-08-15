import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const runtimeConfigPath = resolve(
  process.cwd(),
  'public/config/runtime-config.json',
)
const twinViewPath = resolve(process.cwd(), 'src/features/twin/TwinView.vue')
const plotPreviewPath = resolve(
  process.cwd(),
  'src/features/twin/TwinPlotPreview.vue',
)

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

  it('清理徐场村和产业地块内的建筑白膜', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain("['xuchang-renewal', 'guyang-industry']")
    expect(source).toContain(
      'excludePolygonFeaturesFromRings(rawBuildingFeatures, clearedPlotRings)',
    )
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

  it('右上角使用与主场景联动的地块三维预览', async () => {
    const [source, previewSource] = await Promise.all([
      readFile(twinViewPath, 'utf8'),
      readFile(plotPreviewPath, 'utf8'),
    ])

    expect(source).toContain('TwinPlotPreview')
    expect(source).toContain(':scene-canvas="sceneSourceCanvas"')
    expect(source.indexOf('<TwinPlotPreview')).toBeLessThan(
      source.indexOf('<AiBuilderAssistant'),
    )
    expect(source).toContain(
      'grid-template-rows: minmax(250px, 0.65fr) minmax(390px, 1.35fr)',
    )
    expect(source).toContain(
      'grid-template-rows: minmax(225px, 0.65fr) minmax(360px, 1.35fr)',
    )
    expect(source).not.toContain('title="方案决策"')
    expect(previewSource).toContain('三维场景')
    expect(source).toContain('renderSimulationPlots()')
    expect(source).toContain('selectAdjacentPlot')
    expect(source).toContain('plotApplicationOpen.value = true')
    expect(source).toContain('<PlotApplicationDialog')
    expect(source).toContain('selectSimulationPlot(plotIndex, false)')
    expect(source).toContain(':position="plotApplicationPosition"')
    expect(previewSource).not.toContain('overview-preview')
    expect(previewSource).not.toContain("from 'leaflet'")
    expect(source).not.toContain(':plot-ring="currentPlot.ring"')
    expect(previewSource).toContain('context.drawImage(source')
    expect(previewSource).toContain('source.captureStream(8)')
    expect(previewSource).toContain('查看下一地块')
  })

  it('三生模拟场景加载水系、路网与 POI 数据图层', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain('fetchIServerFeatures')
    expect(source).toContain("mapName: 'Lankao_POI_2025'")
    expect(source).toContain("mapName: 'Lankao_Road_Network'")
    expect(source).toContain("mapName: 'Lankao_Water'")
    expect(source).toContain("key: 'poiLayer'")
  })

  it('服务圈分析使用精简的单路径操作卡并即时标记选点', async () => {
    const source = await readFile(twinViewPath, 'utf8')

    expect(source).toContain('title="服务圈分析"')
    expect(source).toContain(
      '<PanelCard title="服务覆盖分析" meta="等时圈联动">',
    )
    expect(source).toContain('isochronePhase')
    expect(source).not.toContain('class="isochrone-overview"')
    expect(source).not.toContain('class="isochrone-status"')
    expect(source).toContain('在地图中选择服务点')
    expect(source).toContain('重新选择服务点')
    expect(source).toContain('clearParkServiceArea')
    expect(source).toContain('aria-label="清除服务点和分析结果"')
    expect(source).toContain('class="park-action-icon"')
    expect(source).toContain('M10 17s5-4.15 5-9')
    expect(source).toContain('M4.5 6.25h11')
    expect(source).not.toContain("parkPickMode ? '×' : '⌖'")
    expect(source).toContain('服务点与服务圈分析结果已清除')
    expect(source).toContain('renderParkSelectionMarker(point)')
    expect(source).toContain('trackParkModelScreenSize(origin)')
    expect(source).toContain('resolveFixedScreenModelScale(')
    expect(source).toContain("text: '服务圈中心 · 已选'")
    expect(source.indexOf('renderParkSelectionMarker(point)')).toBeLessThan(
      source.indexOf('await requestIsochrones'),
    )
    expect(source).toContain(':aria-pressed="isochroneProfile === option.value"')
    expect(source).toMatch(
      /\.minute-switch button \{[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/,
    )
    expect(source).not.toContain('放置公园模型')
  })
})
