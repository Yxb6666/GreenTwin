import { describe, expect, it } from 'vitest'
import { validateSimulationRequest } from '../server/simulation.mjs'

describe('Blender 模拟任务服务', () => {
  it('约束建模参数以避免异常场景和资源滥用', () => {
    expect(
      validateSimulationRequest({
        scenario: '道路积水治理',
        plan: '方案 A',
        ditchWidth: 20,
        ditchDepth: -1,
        outletCount: 99,
        roadRaiseHeight: 3,
      }),
    ).toEqual({
      scenario: '道路积水治理',
      plan: '方案 A',
      ditchWidth: 1.5,
      ditchDepth: 0.3,
      outletCount: 12,
      roadRaiseHeight: 1.2,
    })
  })

  it('拒绝非对象请求', () => {
    expect(() => validateSimulationRequest(null)).toThrow('请求参数必须是对象')
  })
})
