import { describe, expect, it, vi } from 'vitest'
import {
  analyzeGovernanceIssues,
  generateGovernanceAnswer,
  validateGovernanceAssistantRequest,
} from '../server/governance-assistant.mjs'

function createPayload() {
  return {
    question: '当前最紧急的两个治理问题是什么？',
    history: [],
    context: {
      module: '乡村治理',
      scopeLabel: '矩形框选范围',
      hasSpatialQuery: true,
      selectedIssueId: 'GK-002',
      dataUpdatedAt: '2026-08-10T12:00:00+08:00',
      userRole: '平台登录用户（AI只读研判）',
      map: {
        bounds: { west: 114.7, south: 34.7, east: 114.9, north: 34.9 },
        zoom: 11,
        visibleLayers: ['乡镇边界', '治理问题'],
      },
      filters: { keyword: '', type: 'all', town: 'all', urgency: 'all', status: 'all' },
    },
    issues: [
      {
        id: 'GK-001',
        type: '安全风险类',
        subtype: '道路塌陷',
        description: '村道出现塌陷',
        contact: '不应发送的姓名',
        phone: '13800000000',
        town: '仪封镇',
        village: '代庄村',
        address: '村道东段',
        time: '2026-07-01T08:00:00+08:00',
        urgency: '高',
        status: '待审核',
        longitude: 114.8,
        latitude: 34.8,
      },
      {
        id: 'GK-002',
        type: '基础设施类',
        subtype: '排水堵塞',
        description: '雨水口堵塞',
        town: '仪封镇',
        village: '代庄村',
        address: '村委会附近',
        time: '2026-08-09T08:00:00+08:00',
        urgency: '中',
        status: '处理中',
        longitude: 114.805,
        latitude: 34.803,
      },
      {
        id: 'GK-003',
        type: '人居环境类',
        subtype: '垃圾堆放',
        description: '路边垃圾已清运',
        town: '兰阳街道',
        village: '城中社区',
        address: '主路西侧',
        time: '2026-06-01T08:00:00+08:00',
        urgency: '高',
        status: '已办结',
        longitude: 114.9,
        latitude: 34.9,
      },
    ],
    scopeIssueIds: ['GK-001', 'GK-002'],
    viewportIssueIds: ['GK-002'],
  }
}

describe('乡村治理 AI 决策服务', () => {
  it('校验并移除姓名、电话等非必要字段', () => {
    const input = validateGovernanceAssistantRequest(createPayload())
    expect(input.issues[0]).not.toHaveProperty('contact')
    expect(input.issues[0]).not.toHaveProperty('phone')
  })

  it('使用透明规则排名且排除已办结问题', () => {
    const result = analyzeGovernanceIssues(createPayload(), {
      analysisType: 'priority',
      scope: 'all',
      limit: 3,
      now: new Date('2026-08-11T00:00:00Z'),
    })
    expect(result.scoringMethod).toContain('紧急程度45%')
    expect(result.priority.map((issue: { id: string }) => issue.id)).toEqual([
      'GK-001',
      'GK-002',
    ])
  })

  it('调用治理分析工具后生成可联动的结构化回答', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: 'deepseek-v4-flash',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      id: 'call-1',
                      type: 'function',
                      function: {
                        name: 'analyze_governance_issues',
                        arguments: JSON.stringify({
                          analysisType: 'priority',
                          scope: 'current',
                          limit: 2,
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: 'deepseek-v4-flash',
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: '建议优先处理道路塌陷和排水堵塞。',
                    evidence: ['道路塌陷为高紧急且等待时间较长。'],
                    actions: [
                      { type: 'HIGHLIGHT_ISSUES', issueIds: ['GK-001', 'FAKE-1'] },
                      { type: 'LOCATE_ISSUE', issueId: 'GK-001' },
                    ],
                    disclaimer: '当前为场景模拟数据。',
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

    const result = await generateGovernanceAnswer(createPayload(), {
      apiKey: 'test-key',
      fetchImpl,
    })
    const firstBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    const secondBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))

    expect(firstBody.tools[0].function.name).toBe('analyze_governance_issues')
    expect(secondBody.messages.some((message: { role: string }) => message.role === 'tool')).toBe(true)
    expect(result.actions[0]).toEqual({ type: 'HIGHLIGHT_ISSUES', issueIds: ['GK-001'] })
    expect(result.meta).toMatchObject({ usedToolCall: true, analysisType: 'priority' })
  })
})
