import { describe, expect, it, vi } from 'vitest'
import { requestGovernanceAssistant } from '@/features/governance/assistant'

describe('乡村治理 AI 助手前端请求', () => {
  it('提交结构化页面上下文并解析回答', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: '当前范围应优先处理两项问题。',
          evidence: ['高紧急问题2项'],
          actions: [{ type: 'HIGHLIGHT_ISSUES', issueIds: ['GK-001'] }],
          scopeLabel: '当前地图视野',
          referencedIssueIds: ['GK-001'],
          disclaimer: '仅供辅助研判。',
          context: { selectedIssueId: null, dataUpdatedAt: '2026-08-11' },
          meta: {
            model: 'deepseek-v4-flash',
            generatedAt: '2026-08-11T00:00:00Z',
            analysisType: 'priority',
            scope: 'viewport',
            usedToolCall: true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await requestGovernanceAssistant('/api/assistant/governance', 1000, {
      question: '这里最紧急的问题是什么？',
      history: [],
      context: {
        module: '乡村治理',
        scopeLabel: '全县要素',
        hasSpatialQuery: false,
        selectedIssueId: '',
        dataUpdatedAt: '2026-08-11',
        userRole: '平台登录用户',
        map: {
          bounds: { west: 114.7, south: 34.7, east: 114.9, north: 34.9 },
          zoom: 11,
          visibleLayers: ['治理问题'],
        },
        filters: { keyword: '', type: 'all', town: 'all', urgency: 'all', status: 'all' },
      },
      issues: [],
      scopeIssueIds: [],
      viewportIssueIds: [],
    })

    expect(result.actions[0]).toEqual({ type: 'HIGHLIGHT_ISSUES', issueIds: ['GK-001'] })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assistant/governance',
      expect.objectContaining({ method: 'POST' }),
    )
    fetchMock.mockRestore()
  })
})
