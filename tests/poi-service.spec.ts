import { describe, expect, it } from 'vitest'
import type { TownshipFeature } from '@/gis/leaflet/townshipFeatures'
import {
  filterPoiRecordsByTownship,
  loadPoiRecords,
  parsePoiRecords,
  summarizePoiByTownship,
} from '@/features/master/poiService'

const samplePoiQueryResult = {
  recordsets: [
    {
      features: [
        {
          ID: 1,
          fieldValues: [
            '测试医院',
            '鍖荤枟淇濆仴',
            '医院',
            '114.9',
            '34.9',
            '',
            '',
            '114.9',
            '34.9',
            '兰考县',
          ],
          geometry: { center: { x: 114.9, y: 34.9 } },
        },
        {
          ID: 2,
          fieldValues: [
            '测试企业',
            '鍏徃浼佷笟',
            '公司',
            '114.91',
            '34.91',
            '',
            '',
            '114.91',
            '34.91',
            '兰考县',
          ],
          geometry: { center: { x: 114.91, y: 34.91 } },
        },
        {
          ID: 3,
          fieldValues: [
            '测试景点',
            '鏃呮父鏅偣',
            '景点',
            '114.92',
            '34.92',
            '',
            '',
            '114.92',
            '34.92',
            '兰考县',
          ],
          geometry: { center: { x: 114.92, y: 34.92 } },
        },
      ],
    },
  ],
}

const township: TownshipFeature = {
  code: '410225001',
  name: '测试镇',
  rings: [
    [
      [34.8, 114.8],
      [35, 114.8],
      [35, 115],
      [34.8, 115],
      [34.8, 114.8],
    ],
  ],
}

describe('真实 POI 服务', () => {
  it('按稳定字段位置解析 iServer POI 点位并归类', () => {
    const records = parsePoiRecords(samplePoiQueryResult)

    expect(records).toHaveLength(3)
    expect(records.map((record) => record.bucket)).toEqual([
      'publicService',
      'industry',
      'cultureTourism',
    ])
    expect(records[0]).toMatchObject({
      latitude: 34.9,
      longitude: 114.9,
    })
  })

  it('按乡镇边界汇总真实 POI 三类数量', () => {
    const summary = summarizePoiByTownship(parsePoiRecords(samplePoiQueryResult), [
      township,
    ]).get(township.code)

    expect(summary).toEqual({
      publicService: 1,
      industry: 1,
      cultureTourism: 1,
      total: 3,
    })
  })

  it('按乡镇边界筛选需要绘制的真实 POI 点位', () => {
    const records = parsePoiRecords({
      recordsets: [
        {
          features: [
            ...samplePoiQueryResult.recordsets[0]!.features,
            {
              ID: 4,
              fieldValues: ['外部点位', '生活服务', '服务', '116', '36', '', '', '116', '36', '兰考县'],
              geometry: { center: { x: 116, y: 36 } },
            },
          ],
        },
      ],
    })

    const visibleRecords = filterPoiRecordsByTownship(records, township)

    expect(visibleRecords.map((record) => record.name)).toEqual(['测试医院', '测试企业', '测试景点'])
  })

  it('支持从 iServer rest 根目录解析地图资源后查询点位', async () => {
    const calls: Array<{ url: string; body?: unknown }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      calls.push({
        url,
        body:
          typeof init?.body === 'string'
            ? JSON.parse(init.body)
            : undefined,
      })

      if (url.endsWith('/maps.json')) {
        return {
          ok: true,
          json: async () => [
            {
              name: 'Lankao_POI_2025',
              path: 'http://example.test/rest/maps/Lankao_POI_2025',
            },
          ],
        } as Response
      }

      return {
        ok: true,
        json: async () => samplePoiQueryResult,
      } as Response
    }

    const records = await loadPoiRecords('http://example.test/rest', fetchImpl)

    expect(records).toHaveLength(3)
    expect(calls[0]?.url).toBe('http://example.test/rest/maps.json')
    expect(calls[1]?.url).toBe(
      'http://example.test/rest/maps/Lankao_POI_2025/queryResults.json?returnContent=true',
    )
    expect(calls[1]?.body).toMatchObject({
      queryParameters: {
        queryParams: [{ name: 'Lankao_POI_2025' }],
        expectCount: 30000,
        queryOption: 'ATTRIBUTEANDGEOMETRY',
      },
    })
  })
})
