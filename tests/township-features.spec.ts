import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getTownshipLabel,
  loadTownshipFeatures,
  parseTownshipFeatures,
  resolveTownshipMapServiceUrl,
} from '@/gis/leaflet/townshipFeatures'

function feature(code: string, parts = [4]) {
  return {
    fieldValues: [code, '测试乡镇'],
    geometry: {
      parts,
      points: [
        { x: 114.8, y: 34.8 },
        { x: 114.9, y: 34.8 },
        { x: 114.9, y: 34.9 },
        { x: 114.8, y: 34.8 },
      ],
    },
  }
}

describe('行政区划要素解析', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('将 iServer 服务根地址解析为同名地图资源', () => {
    expect(
      resolveTownshipMapServiceUrl('http://118.89.55.214:8090/iserver/services/Lankao_map_units/rest/'),
    ).toBe('http://118.89.55.214:8090/iserver/services/Lankao_map_units/rest/maps/Lankao_map_units')
  })

  it('使用解析后的地图地址和小写数据集名查询行政区划要素', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recordsets: [{ features: [feature('410225101')] }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await loadTownshipFeatures('http://118.89.55.214:8090/iserver/services/Lankao_map_units/rest')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://118.89.55.214:8090/iserver/services/Lankao_map_units/rest/maps/Lankao_map_units/queryResults.json?returnContent=true',
    )
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(options.body)).queryParameters.queryParams).toEqual([
      { name: 'lankao_map_units', attributeFilter: '1=1' },
    ])
  })

  it('保留服务返回的乡镇和类似乡级单位', () => {
    const result = parseTownshipFeatures({
      recordsets: [{ features: [feature('410225101'), feature('410225402')] }],
    })

    expect(result.map(({ code }) => code)).toEqual(['410225101', '410225402'])
  })

  it('将 iServer 坐标转换为 Leaflet 纬经度坐标', () => {
    const result = parseTownshipFeatures({
      recordsets: [{ features: [feature('410225101')] }],
    })

    expect(result).toEqual([
      {
        code: '410225101',
        name: '测试乡镇',
        rings: [
          [
            [34.8, 114.8],
            [34.8, 114.9],
            [34.9, 114.9],
            [34.8, 114.8],
          ],
        ],
      },
    ])
  })

  it('丢弃点数与分段信息不一致的损坏几何', () => {
    expect(parseTownshipFeatures({ recordsets: [{ features: [feature('410225101', [5])] }] })).toEqual([])
  })

  it('按区划代码生成正确的乡镇街道标注并排除非行政图面单元', () => {
    expect(getTownshipLabel({ code: '410225001', name: '鍏伴槼琛楅亾' })).toBe('兰阳街道')
    expect(getTownshipLabel({ code: '410225108', name: '浠皝闀�' })).toBe('仪封镇')
    expect(getTownshipLabel({ code: '410225201', name: '涓変箟瀵ㄤ埂' })).toBe('三义寨乡')
    expect(getTownshipLabel({ code: '410225402', name: '造纸林场' })).toBeNull()
  })
})
