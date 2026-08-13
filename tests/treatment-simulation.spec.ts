import { describe, expect, it } from 'vitest'
import {
  applyTreatmentScoreRules,
  offsetTreatmentLine,
  selectTreatmentRoad,
} from '@/features/twin/treatmentSimulation'

describe('三生模拟治理措施规则', () => {
  it('叠加排水沟与路面抬升的固定正向指标', () => {
    expect(
      applyTreatmentScoreRules([76, 88, 83], [61, 58, 73], ['ditch', 'road']),
    ).toEqual({
      scores: [88, 100, 87],
      composite: 91.7,
      deltas: ['+27', '+42', '+14'],
    })
  })

  it('指标最高限制为100分', () => {
    expect(
      applyTreatmentScoreRules([98, 99, 100], [60, 60, 60], ['ditch']).scores,
    ).toEqual([100, 100, 100])
  })

  it('排水沟宽度和深度越大，启用后的规则指标越高', () => {
    const low = applyTreatmentScoreRules(
      [76, 88, 83],
      [61, 58, 73],
      ['ditch'],
      { ditchWidth: 0.3, ditchDepth: 0.4, roadRaiseHeight: 0.25 },
    )
    const high = applyTreatmentScoreRules(
      [76, 88, 83],
      [61, 58, 73],
      ['ditch'],
      { ditchWidth: 1.2, ditchDepth: 1.5, roadRaiseHeight: 0.25 },
    )

    expect(high.composite).toBeGreaterThan(low.composite)
    expect(high.scores[0]).toBeGreaterThan(low.scores[0]!)
    expect(high.scores[2]).toBeGreaterThan(low.scores[2]!)
  })

  it('道路抬升高度越大，启用后的规则指标越高', () => {
    const low = applyTreatmentScoreRules([76, 88, 83], [61, 58, 73], ['road'], {
      ditchWidth: 0.5,
      ditchDepth: 0.7,
      roadRaiseHeight: 0.1,
    })
    const high = applyTreatmentScoreRules(
      [76, 88, 83],
      [61, 58, 73],
      ['road'],
      { ditchWidth: 0.5, ditchDepth: 0.7, roadRaiseHeight: 0.6 },
    )

    expect(high.composite).toBeGreaterThan(low.composite)
    expect(high.scores[0]).toBeGreaterThan(low.scores[0]!)
  })

  it('排水口必须完成地图布点后才产生指标增益', () => {
    const withoutPoint = applyTreatmentScoreRules(
      [76, 88, 83],
      [61, 58, 73],
      ['outlet'],
      {
        ditchWidth: 0.5,
        ditchDepth: 0.7,
        roadRaiseHeight: 0.25,
        outletCount: 0,
        outletDiameter: 500,
      },
    )
    const withPoints = applyTreatmentScoreRules(
      [76, 88, 83],
      [61, 58, 73],
      ['outlet'],
      {
        ditchWidth: 0.5,
        ditchDepth: 0.7,
        roadRaiseHeight: 0.25,
        outletCount: 4,
        outletDiameter: 500,
      },
    )

    expect(withoutPoint.scores).toEqual([76, 88, 83])
    expect(withPoints.scores).toEqual([79, 95, 84])
  })

  it('临时泵站数量和单站排水能力共同驱动指标', () => {
    const low = applyTreatmentScoreRules([76, 80, 83], [61, 58, 73], ['pump'], {
      ditchWidth: 0.5,
      ditchDepth: 0.7,
      roadRaiseHeight: 0.25,
      pumpCount: 1,
      pumpCapacity: 500,
    })
    const high = applyTreatmentScoreRules(
      [76, 80, 83],
      [61, 58, 73],
      ['pump'],
      {
        ditchWidth: 0.5,
        ditchDepth: 0.7,
        roadRaiseHeight: 0.25,
        pumpCount: 3,
        pumpCapacity: 2000,
      },
    )

    expect(high.composite).toBeGreaterThan(low.composite)
    expect(high.scores[1]).toBeGreaterThan(low.scores[1]!)
  })

  it('选择离模拟中心最近的道路局部线段', () => {
    const selected = selectTreatmentRoad(
      [
        {
          kind: 'line',
          points: [
            { longitude: 114.7, latitude: 34.7 },
            { longitude: 114.8, latitude: 34.8 },
          ],
        },
        {
          kind: 'line',
          points: Array.from({ length: 30 }, (_, index) => ({
            longitude: 114.94 + index * 0.002,
            latitude: 34.95,
          })),
        },
      ],
      { longitude: 114.964, latitude: 34.951 },
      10,
    )

    expect(selected?.points).toHaveLength(10)
    expect(
      selected?.points.some(
        (point) => Math.abs(point.longitude - 114.964) < 0.001,
      ),
    ).toBe(true)
  })

  it('为排水沟生成道路侧向偏移线', () => {
    const source = [
      { longitude: 114.96, latitude: 34.95 },
      { longitude: 114.97, latitude: 34.95 },
    ]
    const offset = offsetTreatmentLine(source, 5)

    expect(offset[0]?.longitude).toBeCloseTo(source[0]!.longitude, 6)
    expect(offset[0]?.latitude).toBeGreaterThan(source[0]!.latitude)
  })
})
