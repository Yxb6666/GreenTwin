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
    expect(
      SIMULATION_PLOTS.every(
        (plot) =>
          plot.applicationLabel.length > 0 &&
          plot.applicationSummary.length > 0 &&
          plot.applicationScenarios.length === 3 &&
          plot.applicationTags.length > 0,
      ),
    ).toBe(true)
  })

  it('地块中心保持至少 1 公里间距', () => {
    const distances = SIMULATION_PLOTS.flatMap((plot, index) =>
      SIMULATION_PLOTS.slice(index + 1).map((otherPlot) => {
        const latitudeScale = 111_320
        const longitudeScale =
          latitudeScale *
          Math.cos(((plot.center.latitude + otherPlot.center.latitude) * Math.PI) / 360)
        const east =
          (plot.center.longitude - otherPlot.center.longitude) * longitudeScale
        const north =
          (plot.center.latitude - otherPlot.center.latitude) * latitudeScale
        return Math.hypot(east, north)
      }),
    )

    expect(Math.min(...distances)).toBeGreaterThanOrEqual(1_000)
  })

  it('徐场村地块向西北移至目标空地并与道路平行', () => {
    const plot = SIMULATION_PLOTS.find((item) => item.key === 'xuchang-renewal')

    expect(plot?.center).toEqual({ longitude: 114.96765, latitude: 34.94985 })
    expect(Math.min(...plot!.ring.map(([longitude]) => longitude))).toBeGreaterThan(
      114.9669,
    )
    expect(Math.min(...plot!.ring.map(([, latitude]) => latitude))).toBeGreaterThan(
      34.9494,
    )
    expect(plot!.ring[0]![1]).toBeCloseTo(plot!.ring[1]![1], 8)
    expect(plot!.ring[1]![0]).toBeCloseTo(plot!.ring[2]![0], 8)
  })

  it('堌阳产业地块向西北移至目标空地并校正朝向', () => {
    const plot = SIMULATION_PLOTS.find((item) => item.key === 'guyang-industry')

    expect(plot?.center).toEqual({ longitude: 114.97813, latitude: 34.9571 })
    expect(Math.min(...plot!.ring.map(([longitude]) => longitude))).toBeGreaterThan(
      114.9772,
    )
    expect(Math.min(...plot!.ring.map(([, latitude]) => latitude))).toBeGreaterThan(
      34.9565,
    )

    const [startLongitude, startLatitude] = plot!.ring[0]!
    const [endLongitude, endLatitude] = plot!.ring[1]!
    const latitudeScale = 111_320
    const longitudeScale =
      latitudeScale * Math.cos((plot!.center.latitude * Math.PI) / 180)
    const heading =
      (Math.atan2(
        (endLatitude - startLatitude) * latitudeScale,
        (endLongitude - startLongitude) * longitudeScale,
      ) *
        180) /
      Math.PI

    expect(heading).toBeCloseTo(-12, 8)
  })

  it('矩形地块生成闭合且有效的经纬度环', () => {
    const ring = createPlotRectangle(114.965, 34.95, 120, 80, 12)

    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring.at(-1))
    expect(ring.every(([longitude]) => longitude > 114.96)).toBe(true)
    expect(ring.every(([, latitude]) => latitude > 34.94)).toBe(true)
  })
})
