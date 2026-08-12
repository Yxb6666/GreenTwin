import { describe, expect, it, vi } from 'vitest'
import {
  buildWgs84BoundsFilter,
  fetchIServerFeatures,
  parseIServerFeatures,
} from '@/features/twin/iserverLayers'

describe('iServer 数据图层', () => {
  it('生成 WGS84 范围过滤条件', () => {
    expect(buildWgs84BoundsFilter(114.9, 34.9, 115.03, 35)).toBe(
      'WGS84_X > 114.9 AND WGS84_X < 115.03 AND WGS84_Y > 34.9 AND WGS84_Y < 35',
    )
  })

  it('解析点、线与面要素', () => {
    const features = parseIServerFeatures([
      {
        datasetName: 'POI',
        features: [
          {
            fieldNames: ['名称'],
            fieldValues: ['堌阳镇卫生院'],
            geometry: {
              type: 'POINT',
              points: [{ x: 114.964, y: 34.951 }],
              parts: [1],
            },
          },
        ],
      },
      {
        datasetName: 'Road',
        features: [
          {
            geometry: {
              type: 'LINE',
              points: [
                { x: 114.9, y: 34.9 },
                { x: 115, y: 34.9 },
                { x: 115, y: 35 },
              ],
              parts: [2, 1],
            },
          },
        ],
      },
      {
        datasetName: 'WaterPolygon',
        features: [
          {
            geometry: {
              type: 'REGION',
              points: [
                { x: 114.9, y: 34.9 },
                { x: 115, y: 34.9 },
                { x: 115, y: 35 },
                { x: 114.9, y: 35 },
              ],
              parts: [4],
            },
          },
        ],
      },
    ])

    expect(features[0]).toMatchObject({
      kind: 'point',
      name: '堌阳镇卫生院',
      points: [{ longitude: 114.964, latitude: 34.951 }],
    })
    expect(features[1]).toMatchObject({ kind: 'line' })
    expect(features[1]!.points).toHaveLength(2)
    expect(features[2]).toMatchObject({ kind: 'polygon' })
    expect(features[2]!.points).toHaveLength(4)
  })

  it('两步读取 iServer 查询结果并携带过滤条件', async () => {
    const location =
      'http://iserver/rest/maps/Lankao_POI_2025/queryResults/job-1.json'
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            succeed: true,
            newResourceLocation: location,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            recordsets: [
              {
                features: [
                  {
                    fieldNames: ['名称'],
                    fieldValues: ['徐场村'],
                    geometry: {
                      type: 'POINT',
                      points: [{ x: 114.964, y: 34.951 }],
                    },
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      )

    const result = await fetchIServerFeatures(
      {
        serviceUrl: 'http://iserver/services/Laokao_POI_2025/rest',
        mapName: 'Lankao_POI_2025',
        datasetName: 'Lankao_POI_2025',
      },
      {
        attributeFilter: buildWgs84BoundsFilter(114.9, 34.9, 115, 35),
        fetchImpl,
      },
    )

    expect(fetchImpl.mock.calls[0]?.[0]).toContain('/queryResults.json')
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    expect(body.queryParameters.queryParams[0]).toMatchObject({
      name: 'Lankao_POI_2025',
      attributeFilter:
        'WGS84_X > 114.9 AND WGS84_X < 115 AND WGS84_Y > 34.9 AND WGS84_Y < 35',
    })
    expect(fetchImpl.mock.calls[1]?.[0]).toContain('queryResults/job-1.json')
    expect(result[0]).toMatchObject({
      kind: 'point',
      name: '徐场村',
      points: [{ longitude: 114.964, latitude: 34.951 }],
    })
  })
})
