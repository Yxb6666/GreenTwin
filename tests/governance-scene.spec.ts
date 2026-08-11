import { describe, expect, it } from 'vitest'
import {
  inferGovernanceScenario,
  parseGovernanceSceneContext,
} from '@/features/governance/sceneContext'

describe('治理要素三维场景上下文', () => {
  it('解析二维地图传入的要素和空间坐标', () => {
    expect(
      parseGovernanceSceneContext('GK-2026-001', {
        longitude: '114.749274',
        latitude: '34.856417',
        town: '三义寨乡',
        village: '夹河滩村',
        subtype: '岸线垃圾',
        issueType: '生态保护类',
        description: '河岸存在生活垃圾堆放',
        urgency: '中',
        status: '待审核',
      }),
    ).toEqual({
      issueId: 'GK-2026-001',
      longitude: 114.749274,
      latitude: 34.856417,
      town: '三义寨乡',
      village: '夹河滩村',
      subtype: '岸线垃圾',
      issueType: '生态保护类',
      description: '河岸存在生活垃圾堆放',
      urgency: '中',
      status: '待审核',
    })
  })

  it('依据治理问题语义选择合适的三维场景模板', () => {
    expect(
      inferGovernanceScenario({ issueType: '生态保护类', subtype: '岸线垃圾' }),
    ).toBe('ecology')
    expect(
      inferGovernanceScenario({ issueType: '农业生产类', subtype: '机井故障' }),
    ).toBe('irrigation')
  })

  it('拒绝缺少要素编号或越界坐标的场景入口', () => {
    expect(
      parseGovernanceSceneContext('', {
        longitude: '114.8',
        latitude: '34.8',
      }),
    ).toBeNull()
    expect(
      parseGovernanceSceneContext('GK-2026-001', {
        longitude: '214.8',
        latitude: '34.8',
      }),
    ).toBeNull()
  })
})
