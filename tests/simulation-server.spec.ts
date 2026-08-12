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
        prompt: '请帮我在地图处建造一个古风样式的建筑',
      }),
    ).toEqual({
      scenario: '道路积水治理',
      plan: '方案 A',
      ditchWidth: 1.5,
      ditchDepth: 0.3,
      outletCount: 12,
      roadRaiseHeight: 1.2,
      prompt: '请帮我在地图处建造一个古风样式的建筑',
      buildingStyle: 'traditional-chinese',
    })
  })

  it('拒绝非对象请求', () => {
    expect(() => validateSimulationRequest(null)).toThrow('请求参数必须是对象')
  })

  it('接受并规范化用户自定义落点', () => {
    expect(
      validateSimulationRequest({
        scenario: '道路积水治理',
        placement: {
          longitude: 114.97012345,
          latitude: 34.95112345,
          height: 12.345,
          heading: 30.567,
          label: ' 徐场村路口 ',
        },
      }),
    ).toMatchObject({
      placement: {
        longitude: 114.970123,
        latitude: 34.951123,
        height: 12.35,
        heading: 30.57,
        label: '徐场村路口',
        accuracy: 'user-picked',
      },
    })
  })

  it('拒绝越界或非法落点', () => {
    expect(() =>
      validateSimulationRequest({
        placement: { longitude: 200, latitude: 34.95 },
      }),
    ).toThrow('落点经度无效')
    expect(() =>
      validateSimulationRequest({
        placement: { longitude: 114.96, latitude: 95 },
      }),
    ).toThrow('落点纬度无效')
    expect(() =>
      validateSimulationRequest({
        placement: { longitude: 114.96, latitude: 34.95, height: '很高' },
      }),
    ).toThrow('落点高度无效')
  })
})
