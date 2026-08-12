import { describe, expect, it, vi } from 'vitest'
import {
  createAgentJob,
  waitForAgentJob,
  type AgentJob,
} from '@/features/twin/agentSimulation'

const placement = {
  longitude: 114.970123,
  latitude: 34.951123,
  height: 12.35,
  heading: 30,
  label: '徐场村路口',
  accuracy: 'user-picked' as const,
}

const prompt = '建一座三层八角攒尖顶楼阁，带柱廊、斗拱和灯笼'

describe('3D Agent 客户端', () => {
  it('提交提示词并轮询到模型完成', async () => {
    const queued: AgentJob = {
      id: 'agent-1',
      status: 'queued',
      progress: 5,
      message: '排队中',
      placement,
      parameters: { prompt, building: { buildingType: 'tower' } },
    }
    const completed: AgentJob = {
      ...queued,
      status: 'completed',
      progress: 100,
      message: '已完成',
      modelUrl: '/api/agent-simulation/models/agent-1.glb',
      stageUrls: [
        '/api/agent-simulation/models/agent-1-stage-1.glb',
        '/api/agent-simulation/models/agent-1-stage-2.glb',
        '/api/agent-simulation/models/agent-1-stage-3.glb',
        '/api/agent-simulation/models/agent-1-stage-4.glb',
      ],
    }
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(queued), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(completed), { status: 200 }),
      )

    const initial = await createAgentJob(
      '/api',
      { prompt, placement },
      fetchImpl,
    )
    const result = await waitForAgentJob('/api', initial, {
      intervalMs: 0,
      fetchImpl,
    })
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))

    expect(body).toMatchObject({ prompt, placement })
    expect(result.modelUrl).toBe(
      '/api/agent-simulation/models/agent-1.glb',
    )
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      '/api/agent-simulation/jobs',
    )
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      '/api/agent-simulation/jobs/agent-1',
    )
  })
})
