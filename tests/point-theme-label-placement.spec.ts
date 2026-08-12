import { describe, expect, it } from 'vitest'
import { getPointThemeLabelPlacement } from '@/features/master/pointThemeLabelPlacement'

const countyBounds: [[number, number], [number, number]] = [
  [0, 0],
  [10, 10],
]

describe('点专题行政区标签避让', () => {
  it('普通区域将名称放在聚合圆上方并按半径动态留白', () => {
    expect(getPointThemeLabelPlacement([5, 5], countyBounds, 18)).toEqual({
      direction: 'top',
      offset: [0, -34],
      clusterTooltipDirection: 'right',
    })
  })

  it('县域顶部区域将标签向下放置以避免跑出边界', () => {
    expect(getPointThemeLabelPlacement([9, 5], countyBounds, 12)).toMatchObject(
      {
        direction: 'bottom',
        offset: [0, 32],
      },
    )
  })

  it('县域左右边缘分别向内侧放置标签', () => {
    expect(
      getPointThemeLabelPlacement([5, 1], countyBounds, 10).direction,
    ).toBe('right')
    expect(
      getPointThemeLabelPlacement([5, 9], countyBounds, 10).direction,
    ).toBe('left')
  })

  it('允许为极少数相邻点位密集的行政区指定方向', () => {
    expect(
      getPointThemeLabelPlacement([5, 5], countyBounds, 10, 'right'),
    ).toMatchObject({
      direction: 'right',
      offset: [32, 0],
      clusterTooltipDirection: 'left',
    })
  })
})
