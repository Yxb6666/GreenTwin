export interface SimulationParameters {
  scenario: string
  plan: string
  ditchWidth: number
  ditchDepth: number
  outletCount: number
  roadRaiseHeight: number
  prompt?: string
  buildingStyle?: 'traditional-chinese' | 'modern' | 'rural'
  building?: Record<string, unknown>
  placement?: SimulationPlacement
}

export interface SimulationPlacement {
  longitude: number
  latitude: number
  height: number
  heading: number
  label: string
  accuracy: 'township-demo' | 'user-picked'
}

export interface SimulationJob {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress: number
  message: string
  modelUrl?: string
  stageUrls?: string[]
  placement: SimulationPlacement
  parameters: SimulationParameters
}

function endpoint(apiBaseUrl: string, path: string) {
  return `${apiBaseUrl.replace(/\/$/, '')}/simulation${path}`
}

async function readJob(response: Response) {
  const result = (await response.json()) as SimulationJob | { message?: string }
  if (!response.ok) {
    throw new Error('message' in result && result.message ? result.message : '模拟任务请求失败')
  }
  return result as SimulationJob
}

export async function createSimulationJob(
  apiBaseUrl: string,
  parameters: SimulationParameters,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(endpoint(apiBaseUrl, '/jobs'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parameters),
  })
  return readJob(response)
}

export async function getSimulationJob(
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

export async function waitForSimulationJob(
  apiBaseUrl: string,
  initialJob: SimulationJob,
  options: {
    timeoutMs?: number
    intervalMs?: number
    fetchImpl?: typeof fetch
    onProgress?: (job: SimulationJob) => void
  } = {},
) {
  const timeoutMs = options.timeoutMs ?? 120000
  const intervalMs = options.intervalMs ?? 600
  const startedAt = Date.now()
  let job = initialJob
  options.onProgress?.(job)

  while (job.status === 'queued' || job.status === 'running') {
    if (Date.now() - startedAt >= timeoutMs) throw new Error('Blender 场景构建超时')
    await new Promise((resolve) => globalThis.setTimeout(resolve, intervalMs))
    job = await getSimulationJob(apiBaseUrl, job.id, options.fetchImpl)
    options.onProgress?.(job)
  }

  if (job.status === 'failed') throw new Error(job.message)
  if (!job.modelUrl) throw new Error('Blender 已完成任务，但没有返回模型地址')
  return job
}
