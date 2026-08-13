import { describe, expect, it } from 'vitest'
import type { GovernanceIssue } from '@/features/governance/data'
import type { TownshipFeature } from '@/gis/leaflet/townshipFeatures'
import { landUseRasterClasses, masterMapThemeLegends, masterMapThemes, resolveTownshipThemeMetric, resolveTownshipThemeMetrics, toggleMasterMapTheme } from '@/features/master/mapThemes'
import { DEFAULT_DIMENSION_WEIGHTS, scoreTown, towns } from '@/features/sansheng/model'

const yifengFeature: TownshipFeature = {
  code: '410225101',
  name: '仪封镇',
  rings: [
    [
      [34.8, 114.8],
      [34.8, 114.9],
      [34.9, 114.9],
      [34.8, 114.8],
    ],
  ],
}

describe('主控专题地图指标', () => {
  it('仅提供 6 个平级专题，不把基础行政区划作为按钮', () => {
    expect(masterMapThemes.map(({ key }) => key)).toEqual(['population', 'gdp', 'poi', 'landuse', 'sansheng', 'governance'])
  })

  it('重复点击当前专题会回到基础行政区划', () => {
    expect(toggleMasterMapTheme(null, 'population')).toBe('population')
    expect(toggleMasterMapTheme('population', 'population')).toBeNull()
    expect(toggleMasterMapTheme('population', 'gdp')).toBe('gdp')
  })

  it('为人口密度专题生成分级设色指标', () => {
    const metric = resolveTownshipThemeMetric('population', yifengFeature, 0)

    expect(metric.label).toMatch(/人\/km²$/)
    expect(masterMapThemeLegends.population.map((item) => item.color)).toContain(metric.color)
  })

  it('为 POI 专题生成聚合点详情', () => {
    const metric = resolveTownshipThemeMetric(
      'poi',
      yifengFeature,
      0,
      [],
      new Map([
        [
          yifengFeature.code,
          {
            publicService: 12,
            industry: 28,
            cultureTourism: 6,
            total: 46,
          },
        ],
      ]),
    )

    expect(metric.value).toBe(46)
    expect(metric.radius).toBeGreaterThan(0)
    expect(metric.details).toEqual(expect.arrayContaining([expect.stringMatching(/^公共服务 /), expect.stringMatching(/^产业节点 /), expect.stringMatching(/^文旅资源 /)]))
    expect(metric.breakdown?.map(({ label }) => label)).toEqual(['公共服务', '产业节点', '文旅资源'])
    expect(metric.breakdown?.reduce((sum, item) => sum + item.value, 0)).toBe(metric.value)
    expect(metric.radius).toBeCloseTo(Math.min(21, Math.max(11, 8 + Math.sqrt(metric.value) * 1.1)))
  })

  it('POI 专题缺少真实汇总时不再使用模拟推算值', () => {
    const metric = resolveTownshipThemeMetric('poi', yifengFeature, 0)

    expect(metric).toMatchObject({
      value: 0,
      label: '暂无数据',
      color: '#B8C2BC',
      dataAvailable: false,
    })
  })

  it('土地利用专题不再生成乡镇主导类型模拟设色', () => {
    const metric = resolveTownshipThemeMetric('landuse', yifengFeature, 0)

    expect(metric).toMatchObject({ label: '真实栅格', color: 'transparent' })
    expect(metric.meta).toContain('Lankao-Land')
  })

  it('土地利用图例使用 CLCD 的 9 类编码与配色', () => {
    expect(landUseRasterClasses).toHaveLength(9)
    expect(masterMapThemeLegends.landuse).toEqual(
      landUseRasterClasses.map(({ name, color }) => ({ label: name, color })),
    )
    expect(landUseRasterClasses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, name: '农田', color: '#FAE39C' }),
        expect.objectContaining({ id: 5, name: '水域', color: '#1E69B4' }),
        expect.objectContaining({ id: 8, name: '不透水面', color: '#E24290' }),
      ]),
    )
  })

  it('按行政区名称聚合治理问题点位', () => {
    const issues: GovernanceIssue[] = [
      {
        id: 'GK-1',
        type: '基础设施类',
        subtype: '道路破损',
        description: '测试',
        contact: '张三',
        phone: '13800000000',
        townCode: '410225108',
        town: '仪封镇',
        villageCode: '410225108001',
        village: '东岗村',
        address: '东岗村测试点位',
        time: '2026-08-01T10:00:00+08:00',
        urgency: '高',
        status: '处理中',
        channel: '网格巡查',
        dataClass: '治理事件',
        longitude: 114.8,
        latitude: 34.8,
      },
      {
        id: 'GK-2',
        type: '人居环境类',
        subtype: '垃圾堆放',
        description: '测试',
        contact: '李四',
        phone: '13800000001',
        townCode: '410225108',
        town: '仪封镇',
        villageCode: '410225108001',
        village: '东岗村',
        address: '东岗村测试点位',
        time: '2026-08-01T10:00:00+08:00',
        urgency: '中',
        status: '已办结',
        channel: '群众上报',
        dataClass: '治理事件',
        longitude: 114.81,
        latitude: 34.81,
      },
    ]

    const metric = resolveTownshipThemeMetric('governance', yifengFeature, 0, issues)

    expect(metric.value).toBe(2)
    expect(metric.label).toBe('2 处')
    expect(metric.details).toEqual(['高紧急 1', '处置中 1'])
  })

  it('人口与三生主题按当前行政区实际值动态分位设色', () => {
    const features = towns.slice(0, 16).map(
      (town, index): TownshipFeature => ({
        code: `410225${String(index + 1).padStart(3, '0')}`,
        name: town.name,
        rings: yifengFeature.rings,
      }),
    )
    const population = resolveTownshipThemeMetrics('population', features)
    const sansheng = resolveTownshipThemeMetrics('sansheng', features)

    expect(new Set(population.map(({ color }) => color))).toEqual(new Set(masterMapThemeLegends.population.map(({ color }) => color)))
    expect(sansheng).toHaveLength(16)
    expect(sansheng.every(({ dataAvailable }) => dataAvailable)).toBe(true)
    sansheng.forEach((metric, index) => {
      expect(metric.value).toBe(scoreTown(towns[index]!, DEFAULT_DIMENSION_WEIGHTS).composite)
    })
    expect(new Set(sansheng.map(({ color }) => color))).toEqual(new Set(masterMapThemeLegends.sansheng.map(({ color }) => color)))
  })

  it('三生主题对未精确匹配的行政区显示中性缺失色且不造数', () => {
    const metric = resolveTownshipThemeMetrics('sansheng', [{ ...yifengFeature, name: '仪封' }])[0]!

    expect(metric).toMatchObject({
      value: 0,
      label: '暂无数据',
      color: '#B8C2BC',
      dataAvailable: false,
    })
  })

  it('治理问题为零时不生成聚合半径', () => {
    expect(resolveTownshipThemeMetric('governance', yifengFeature, 0).radius).toBeUndefined()
  })
})
