import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getTownshipLabel,
  loadCountyFeatures,
  isPointInsideTownship,
  loadTownshipFeatures,
  parseTownshipFeatures,
  resolveCountyMapServiceUrl,
  resolveTownshipMapServiceUrl,
  townshipRepresentativePoint,
  type TownshipFeature,
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

  it('从同一 iServer 解析并使用正式县界服务', async () => {
    expect(
      resolveCountyMapServiceUrl(
        'http://118.89.55.214:8090/iserver/services/Lankao_map_units/rest/maps/Lankao_map_units',
      ),
    ).toBe('http://118.89.55.214:8090/iserver/services/Lankao_County/rest/maps/Lankao_County')

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recordsets: [{ features: [feature('410225')] }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await loadCountyFeatures('http://118.89.55.214:8090/iserver/services/Lankao_map_units/rest')

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://118.89.55.214:8090/iserver/services/Lankao_County/rest/maps/Lankao_County/queryResults.json?returnContent=true',
    )
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(options.body)).queryParameters.queryParams).toEqual([
      { name: 'Lankao_County', attributeFilter: '1=1' },
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
        name: '堌阳镇',
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

  it('按字段名定位行政区编码和名称', () => {
    const result = parseTownshipFeatures({
      recordsets: [
        {
          fields: ['SMID', 'NAME', 'ADCODE'],
          fieldCaptions: ['标识', '名称', '行政区代码'],
          features: [
            {
              ...feature('410225108'),
              fieldValues: [7, '仪封镇', '410225108'],
            },
          ],
        },
      ],
    })

    expect(result[0]).toMatchObject({ code: '410225108', name: '仪封镇' })
  })

  it('服务名称字段乱码时使用官方编码名称兜底', () => {
    const result = parseTownshipFeatures({
      recordsets: [
        {
          fields: ['ADCODE', 'NAME'],
          features: [
            {
              ...feature('410225108'),
              fieldValues: ['410225108', '绱()篱闂�'],
            },
          ],
        },
      ],
    })

    expect(result[0]).toMatchObject({ code: '410225108', name: '仪封镇' })
  })

  it('服务名称字段是可疑汉字乱码时仍优先使用官方名称', () => {
    const result = parseTownshipFeatures({
      recordsets: [
        {
          fields: ['ADCODE', 'NAME'],
          features: [
            {
              ...feature('410225101'),
              fieldValues: ['410225101', '缂闃抽晣'],
            },
          ],
        },
      ],
    })

    expect(result[0]).toMatchObject({ code: '410225101', name: '堌阳镇' })
  })

  it('服务返回旧源编码时映射到当前行政区名称', () => {
    const result = parseTownshipFeatures({
      recordsets: [
        {
          fields: ['ADCODE', 'NAME'],
          features: [
            {
              ...feature('410225210'),
              fieldValues: ['410225210', '浠皝闀�'],
            },
            {
              ...feature('410225204'),
              fieldValues: ['410225204', '璋疯惀闀�'],
            },
          ],
        },
      ],
    })

    expect(result.map(({ code, name }) => ({ code, name }))).toEqual([
      { code: '410225210', name: '仪封镇' },
      { code: '410225204', name: '谷营镇' },
    ])
  })

  it('为不规则行政区生成落在面内的代表点', () => {
    const irregularFeature: TownshipFeature = {
      code: '410225002',
      name: '桐乡街道',
      rings: [
        [
          [0, 0],
          [0, 4],
          [1, 4],
          [1, 1],
          [4, 1],
          [4, 0],
          [0, 0],
        ],
      ],
    }
    const boundsCenter: [number, number] = [2, 2]
    const representativePoint = townshipRepresentativePoint(irregularFeature)

    expect(isPointInsideTownship(boundsCenter, irregularFeature)).toBe(false)
    expect(isPointInsideTownship(representativePoint, irregularFeature)).toBe(true)
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
