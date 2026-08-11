import { describe, expect, it } from 'vitest'
import { buildCountyBoundaryRings, buildCountyInverseMaskRings } from '@/gis/leaflet/countyFocusGeometry'

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
