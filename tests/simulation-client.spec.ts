import { describe, expect, it, vi } from 'vitest'
import {
  createSimulationJob,
  waitForSimulationJob,
  type SimulationJob,
} from '@/features/twin/simulation'

const parameters = {
  scenario: '道路积水治理',
  plan: '方案 A',
  ditchWidth: 0.5,
  ditchDepth: 0.7,
  outletCount: 4,
  roadRaiseHeight: 0.25,
}

const placement = {
  longitude: 114.964285,
  latitude: 34.9511,
  height: 0,
  heading: 0,
  label: '堌阳镇范围参数化测试场景',
  accuracy: 'township-demo' as const,
}

describe('Blender 模拟任务客户端', () => {
  it('提交参数并轮询到模型完成', async () => {
    const queued: SimulationJob = {
      id: 'job-1',
      status: 'queued',
      progress: 8,
      message: '排队中',
      placement,
      parameters,
    }
    const completed: SimulationJob = {
      ...queued,
      status: 'completed',
      progress: 100,
      message: '已完成',
      modelUrl: '/api/simulation/models/job-1.glb',
    }
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(queued), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(completed), { status: 200 }))

    const initial = await createSimulationJob('/api', parameters, fetchImpl)
    const result = await waitForSimulationJob('/api', initial, {
      intervalMs: 0,
      fetchImpl,
    })

    expect(result.modelUrl).toBe('/api/simulation/models/job-1.glb')
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/simulation/jobs')
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('/api/simulation/jobs/job-1')
  })

  it('把用户在地图选择的落点随任务提交', async () => {
    const userPlacement = {
      longitude: 114.970123,
      latitude: 34.951123,
      height: 12.35,
      heading: 30,
      label: '徐场村路口',
      accuracy: 'user-picked' as const,
    }
    const queued: SimulationJob = {
      id: 'job-2',
      status: 'queued',
      progress: 8,
      message: '排队中',
      placement: userPlacement,
      parameters,
    }
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ...queued, placement: userPlacement }),
          { status: 202 },
        ),
      )

    await createSimulationJob(
      '/api',
      { ...parameters, placement: userPlacement },
      fetchImpl,
    )
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))

    expect(body.placement).toEqual(userPlacement)
  })
})
