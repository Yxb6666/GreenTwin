import type { SimulationPlacement } from './simulation'

export interface AgentJob {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress: number
  message: string
  modelUrl?: string
  stageUrls?: string[]
  placement: SimulationPlacement
  parameters: {
    prompt: string
    building: Record<string, unknown>
  }
}

function endpoint(apiBaseUrl: string, path: string) {
  return `${apiBaseUrl.replace(/\/$/, '')}/agent-simulation${path}`
}

async function readJob(response: Response) {
  const result = (await response.json()) as AgentJob | { message?: string }
  if (!response.ok) {
    throw new Error(
      'message' in result && result.message
        ? result.message
        : '3D Agent 任务请求失败',
    )
  }
  return result as AgentJob
}

export async function createAgentJob(
  apiBaseUrl: string,
  payload: {
    prompt: string
    placement: SimulationPlacement
    buildingStyle?: string
  },
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(endpoint(apiBaseUrl, '/jobs'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return readJob(response)
}

export async function getAgentJob(
  apiBaseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(
    endpoint(apiBaseUrl, `/jobs/${encodeURIComponent(id)}`),
    { cache: 'no-store' },
  )
  return readJob(response)
}

export async function waitForAgentJob(
  apiBaseUrl: string,
  initialJob: AgentJob,
  options: {
    timeoutMs?: number
    intervalMs?: number
    fetchImpl?: typeof fetch
    onProgress?: (job: AgentJob) => void
  } = {},
) {
  const timeoutMs = options.timeoutMs ?? 180000
  const intervalMs = options.intervalMs ?? 800
  const startedAt = Date.now()
  let job = initialJob
  options.onProgress?.(job)

  while (job.status === 'queued' || job.status === 'running') {
    if (Date.now() - startedAt >= timeoutMs)
      throw new Error('3D Agent 建模超时')
    await new Promise((resolve) => globalThis.setTimeout(resolve, intervalMs))
    job = await getAgentJob(apiBaseUrl, job.id, options.fetchImpl)
    options.onProgress?.(job)
  }

  if (job.status === 'failed') throw new Error(job.message)
  if (!job.modelUrl) throw new Error('3D Agent 已完成任务，但没有返回模型地址')
  return job
}
