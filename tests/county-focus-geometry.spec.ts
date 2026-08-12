import { describe, expect, it } from 'vitest'
import {
  buildCountyBoundaryRings,
  buildCountyInverseMaskRings,
  filterCountyBoundaryArtifacts,
  filterTownshipBoundaryArtifacts,
  getCountyOuterBoundaryRings,
  mergeTownshipFeatures,
} from '@/gis/leaflet/countyFocusGeometry'

describe('county focus geometry', () => {
  it('消除相邻乡镇共享边并拼成闭合县界', () => {
    const boundary = buildCountyBoundaryRings([
      { rings: [[[0, 0], [1, 0], [1, 1], [0, 1]]] },
      { rings: [[[0, 1], [1, 1], [1, 2], [0, 2]]] },
    ])

    expect(boundary).toHaveLength(1)
    expect(boundary[0]?.at(0)).toEqual(boundary[0]?.at(-1))
    expect(boundary[0]).toHaveLength(7)
  })

  it('保留不相连的多部件县界', () => {
    const boundary = buildCountyBoundaryRings([
      { rings: [[[0, 0], [1, 0], [1, 1], [0, 1]]] },
      { rings: [[[3, 3], [4, 3], [4, 4], [3, 4]]] },
    ])

    expect(boundary).toHaveLength(2)
    expect(boundary.every((ring) => ring.at(0)?.every((value, index) => value === ring.at(-1)?.[index]))).toBe(true)
  })

  it('将历史同名要素归并为一个 MultiPolygon 行政区', () => {
    const merged = mergeTownshipFeatures([
      { code: '410225106', name: '东坝头镇', rings: [[[0, 0], [1, 0], [1, 1], [0, 1]]] },
      { code: '410225202', name: '东坝头乡', rings: [[[0, 1], [1, 1], [1, 2], [0, 2]]] },
      { code: '410225999', name: '东坝头镇', rings: [[[3, 3], [4, 3], [4, 4], [3, 4]]] },
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ code: '410225106', name: '东坝头镇' })
    expect(merged[0]?.rings).toHaveLength(2)
    expect(merged[0]?.rings[0]).toHaveLength(7)
  })

  it('剔除相对县域面积可忽略的量化残环', () => {
    const countyRing = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]] as Array<[number, number]>
    const artifactRing = [[2, 2], [2.0001, 2], [2.0001, 2.0001], [2, 2.0001], [2, 2]] as Array<
      [number, number]
    >

    expect(filterCountyBoundaryArtifacts([countyRing, artifactRing])).toEqual([countyRing])
  })

  it('县界仅保留最外层轮廓并支持不相连的真实部件', () => {
    const countyRing = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]] as Array<[number, number]>
    const innerRing = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]] as Array<[number, number]>
    const detachedRing = [[20, 20], [22, 20], [22, 22], [20, 22], [20, 20]] as Array<[number, number]>

    expect(getCountyOuterBoundaryRings([countyRing, innerRing, detachedRing])).toEqual([
      countyRing,
      detachedRing,
    ])
  })

  it('只移除零面积退化环，保留任何面积大于零的真实部件', () => {
    const mainRing = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]] as Array<[number, number]>
    const visiblePart = [[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]] as Array<[number, number]>
    const tinyValidPart = [[2, 2], [2.0001, 2], [2.0001, 2.0001], [2, 2.0001], [2, 2]] as Array<[number, number]>
    const degenerateRing = [[1, 1], [1.0001, 1], [1.0002, 1], [1, 1]] as Array<[number, number]>

    expect(filterTownshipBoundaryArtifacts([mainRing, visiblePart, tinyValidPart, degenerateRing])).toEqual([
      mainRing,
      visiblePart,
      tinyValidPart,
    ])
  })

  it('合并历史要素时保留面积很小但有效的独立飞地', () => {
    const merged = mergeTownshipFeatures([
      {
        code: '410225201',
        name: '三义寨乡',
        rings: [
          [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
          [[20, 20], [20.0001, 20], [20.0001, 20.0001], [20, 20.0001], [20, 20]],
        ],
      },
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]?.rings).toHaveLength(2)
  })

  it('按县域范围扩展反向遮罩外环并保留县界孔洞', () => {
    const countyRing = [[0, 0], [2, 0], [2, 4], [0, 4], [0, 0]] as Array<[number, number]>
    const mask = buildCountyInverseMaskRings([countyRing], 1)

    expect(mask).toHaveLength(2)
    expect(mask[0]).toEqual([[-2, -4], [4, -4], [4, 8], [-2, 8], [-2, -4]])
    expect(mask[1]).toBe(countyRing)
  })

  it('忽略无有效县界的遮罩请求', () => {
    expect(buildCountyInverseMaskRings([])).toEqual([])
  })
})
