import { describe, expect, it } from 'vitest'
import type { GovernanceIssue } from '@/features/governance/data'
import {
  buildGovernanceHeatPoints,
  GOVERNANCE_HEAT_PANE_Z_INDEX,
  governanceHeatWeight,
} from '@/features/governance/heatmap'

function issue(overrides: Partial<GovernanceIssue> = {}): GovernanceIssue {
  return {
    id: 'GK-2026-001',
    type: '人居环境类',
    subtype: '岸线垃圾',
    description: '测试问题',
    townCode: '001',
    town: '三爪仑乡',
    villageCode: '001001',
    village: '天门村',
    address: '测试地址',
    longitude: 115.2,
    latitude: 28.9,
    urgency: '中',
    status: '待审核',
    channel: '群众上报',
    dataClass: '现场采集',
    time: '2026-08-13 12:00:00',
    contact: '测试员',
    phone: '13800000000',
    ...overrides,
  }
}

describe('governance heatmap', () => {
  it('renders above the governance point pane', () => {
    expect(GOVERNANCE_HEAT_PANE_Z_INDEX).toBeGreaterThan(440)
  })

  it('weights urgent unresolved issues more strongly', () => {
    expect(governanceHeatWeight(issue({ urgency: '高' }))).toBe(1)
    expect(governanceHeatWeight(issue({ urgency: '低' }))).toBe(0.52)
    expect(governanceHeatWeight(issue({ urgency: '高', status: '已办结' }))).toBe(0.72)
  })

  it('maps issue coordinates and calculated intensity into heat points', () => {
    expect(buildGovernanceHeatPoints([issue()])).toEqual([
      { latitude: 28.9, longitude: 115.2, intensity: 0.76 },
    ])
  })
})
