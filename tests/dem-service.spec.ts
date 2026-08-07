import { describe, expect, it } from 'vitest'
import { buildDemSamplePoints, parseDemItem, summarizeElevations } from '@/features/master/demService'

describe('DEM 影像服务数据', () => {
  it('解析 STAC 影像条目的真实栅格元数据', () => {
    expect(
      parseDemItem({
        bbox: [114.6868, 34.7443, 115.2615, 35.0262],
        collection: 'Lankao-DEM',
        assets: { thumbnail: { href: 'data:image/webp;base64,test' } },
        properties: {
          crs: 'EPSG:4326',
          smfilename: 'Lankao_Dem.tif',
          width: '2069',
          height: '1015',
          smhighps: '2.77777778E-4',
        },
      }),
    ).toMatchObject({
      collectionId: 'Lankao-DEM',
      crs: 'EPSG:4326',
      fileName: 'Lankao_Dem.tif',
      width: 2069,
      height: 1015,
      pixelSizeDegrees: 0.000277777778,
    })
  })

  it('过滤 NoData 哨兵值并计算真实高程抽样摘要', () => {
    expect(summarizeElevations([62, 68, -3.4028234663852886e38, 77, null])).toEqual({
      averageElevationM: 69,
      minimumElevationM: 62,
      maximumElevationM: 77,
      validSampleCount: 3,
    })
  })

  it('在影像范围内部生成 7×5 个抽样点', () => {
    const points = buildDemSamplePoints([114.68, 34.74, 115.26, 35.03])
    expect(points).toHaveLength(35)
    expect(points.every(([x, y]) => x > 114.68 && x < 115.26 && y > 34.74 && y < 35.03)).toBe(true)
  })
})
