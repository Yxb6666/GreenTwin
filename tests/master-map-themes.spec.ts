import { describe, expect, it } from 'vitest'
import type { GovernanceIssue } from '@/features/governance/data'
import type { TownshipFeature } from '@/gis/leaflet/townshipFeatures'
import {
  landUseSource,
  masterMapThemeLegends,
  resolveTownshipThemeMetric,
} from '@/features/master/mapThemes'

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
  it('为人口密度专题生成分级设色指标', () => {
    const metric = resolveTownshipThemeMetric('population', yifengFeature, 0)

    expect(metric.label).toMatch(/人\/km²$/)
    expect(masterMapThemeLegends.population.map((item) => item.color)).toContain(metric.color)
  })

  it('为 POI 专题生成聚合点详情', () => {
    const metric = resolveTownshipThemeMetric('poi', yifengFeature, 0)

    expect(metric.value).toBeGreaterThan(0)
    expect(metric.radius).toBeGreaterThan(0)
    expect(metric.details).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^公共服务 /),
        expect.stringMatching(/^产业节点 /),
        expect.stringMatching(/^文旅资源 /),
      ]),
    )
    expect(metric.breakdown?.map(({ label }) => label)).toEqual([
      '公共服务',
      '产业节点',
      '文旅资源',
    ])
    expect(metric.breakdown?.reduce((sum, item) => sum + item.value, 0)).toBe(metric.value)
  })

  it('为土地利用专题使用主导用地分类颜色', () => {
    const metric = resolveTownshipThemeMetric('landuse', yifengFeature, 0)

    expect(landUseSource.map((item) => item.color)).toContain(metric.color)
    expect(metric.meta).toContain('主导类型')
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
})
