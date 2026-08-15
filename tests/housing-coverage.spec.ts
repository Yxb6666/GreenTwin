import { describe, expect, it } from 'vitest'
import { calculateHousingCoverage } from '@/features/twin/housingCoverage'
import type { ParsedLayerFeature } from '@/features/twin/iserverLayers'

const buildings: ParsedLayerFeature[] = [
  {
    kind: 'polygon',
    height: 3,
    points: [
      { longitude: 0.001, latitude: 0.001 },
      { longitude: 0.0011, latitude: 0.001 },
      { longitude: 0.0011, latitude: 0.0011 },
      { longitude: 0.001, latitude: 0.0011 },
    ],
  },
  {
    kind: 'polygon',
    height: 6,
    points: [
      { longitude: 0.008, latitude: 0.008 },
      { longitude: 0.0081, latitude: 0.008 },
      { longitude: 0.0081, latitude: 0.0081 },
      { longitude: 0.008, latitude: 0.0081 },
    ],
  },
  {
    kind: 'polygon',
    height: 3,
    points: [
      { longitude: 0.02, latitude: 0.02 },
      { longitude: 0.0201, latitude: 0.02 },
      { longitude: 0.0201, latitude: 0.0201 },
    ],
  },
]

describe('等时圈住房覆盖统计', () => {
  it('按建筑中心点生成累计圈层统计', () => {
    const result = calculateHousingCoverage(
      [
        {
          type: 'Feature',
          properties: { contour: 10 },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [0.01, 0],
                [0.01, 0.01],
                [0, 0.01],
                [0, 0],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { contour: 5 },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [0.005, 0],
                [0.005, 0.005],
                [0, 0.005],
                [0, 0],
              ],
            ],
          },
        },
      ],
      buildings,
    )

    expect(result.bands.map((band) => band.minute)).toEqual([5, 10])
    expect(result.bands.map((band) => band.buildings)).toEqual([1, 2])
    expect(result.totalBuildings).toBe(2)
    expect(result.totalHomes).toBeGreaterThan(result.bands[0]!.homes)
    expect(result.totalResidents).toBe(Math.round(result.totalHomes * 2.7))
  })

  it('识别多面与空数据', () => {
    const result = calculateHousingCoverage(
      [
        {
          type: 'Feature',
          properties: { contour: 15 },
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [0, 0],
                  [0.005, 0],
                  [0.005, 0.005],
                  [0, 0.005],
                  [0, 0],
                ],
              ],
            ],
          },
        },
      ],
      [],
    )

    expect(result.totalHomes).toBe(0)
    expect(result.bands[0]).toMatchObject({ buildings: 0, coverageRate: 0 })
  })
})
