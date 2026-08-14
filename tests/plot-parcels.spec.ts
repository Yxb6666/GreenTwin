import { describe, expect, it } from 'vitest'
import {
  createPlotRectangle,
  SIMULATION_PLOTS,
} from '@/features/twin/plotParcels'

describe('三生模拟规划地块', () => {
  it('提供三个可切换且名称唯一的示范地块', () => {
    expect(SIMULATION_PLOTS).toHaveLength(3)
    expect(new Set(SIMULATION_PLOTS.map((plot) => plot.key)).size).toBe(3)
    expect(new Set(SIMULATION_PLOTS.map((plot) => plot.label)).size).toBe(3)
  })

  it('矩形地块生成闭合且有效的经纬度环', () => {
    const ring = createPlotRectangle(114.965, 34.95, 120, 80, 12)

    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring.at(-1))
    expect(ring.every(([longitude]) => longitude > 114.96)).toBe(true)
    expect(ring.every(([, latitude]) => latitude > 34.94)).toBe(true)
  })
})
