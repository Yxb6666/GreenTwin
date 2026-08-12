import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  createReadStream,
  mkdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, resolve } from 'node:path'

const projectRoot = resolve(process.cwd())
const defaultOutputDirectory = resolve(projectRoot, 'tmp', 'simulation-models')
const defaultScriptPath = resolve(
  projectRoot,
  'scripts',
  'blender',
  'generate_simulation_scene.py',
)
const windowsBlenderPath = 'C:\\Tools\\blender-4.5.12-windows-x64\\blender.exe'

function clamp(value, minimum, maximum, fallback) {
  const number = Number(value)
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : fallback
}

function validatePlacement(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('落点参数必须是对象')
  }
  const longitude = Number(value.longitude)
  const latitude = Number(value.latitude)
  const height = Number(value.height ?? 0)
  const heading = Number(value.heading ?? 0)
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('落点经度无效')
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('落点纬度无效')
  }
  if (!Number.isFinite(height) || height < -1000 || height > 10000) {
    throw new Error('落点高度无效')
  }
  if (!Number.isFinite(heading)) {
    throw new Error('落点朝向无效')
  }
  return {
    longitude: Number(longitude.toFixed(6)),
    latitude: Number(latitude.toFixed(6)),
    height: Number(height.toFixed(2)),
    heading: Number(heading.toFixed(2)),
    label:
      typeof value.label === 'string' && value.label.trim()
        ? value.label.trim().slice(0, 80)
        : '地图自定义落点',
    accuracy: 'user-picked',
  }
}

export function validateSimulationRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('请求参数必须是对象')
  }
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim().slice(0, 240) : ''
  const requestedStyle = typeof payload.buildingStyle === 'string' ? payload.buildingStyle : ''
  const buildingStyle = ['traditional-chinese', 'modern', 'rural'].includes(requestedStyle)
    ? requestedStyle
    : /古风|中式|传统|四合院|亭/.test(prompt)
      ? 'traditional-chinese'
      : 'rural'
  const result = {
    scenario: typeof payload.scenario === 'string' ? payload.scenario.slice(0, 40) : '道路积水治理',
    plan: typeof payload.plan === 'string' ? payload.plan.slice(0, 40) : '方案 A',
    ditchWidth: clamp(payload.ditchWidth, 0.3, 1.5, 0.5),
    ditchDepth: clamp(payload.ditchDepth, 0.3, 2, 0.7),
    outletCount: Math.round(clamp(payload.outletCount, 1, 12, 4)),
    roadRaiseHeight: clamp(payload.roadRaiseHeight, 0, 1.2, 0.25),
    prompt,
    buildingStyle,
  }
  if (payload.placement != null) result.placement = validatePlacement(payload.placement)
  return result
}

function findBlenderExecutable(configuredPath) {
  if (configuredPath) return configuredPath
  if (process.env.BLENDER_EXECUTABLE) return process.env.BLENDER_EXECUTABLE
  if (process.platform === 'win32' && existsSync(windowsBlenderPath)) {
    return windowsBlenderPath
  }
  return 'blender'
}

function publicJob(job, basePath) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    modelUrl:
      job.status === 'completed'
        ? `${basePath}/models/${encodeURIComponent(job.id)}.glb`
        : undefined,
    stageUrls:
      job.status === 'completed'
        ? [1, 2, 3, 4].map(
            (stage) => `${basePath}/models/${encodeURIComponent(job.id)}-stage-${stage}.glb`,
          )
        : undefined,
    placement: job.placement,
    parameters: job.parameters,
  }
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(value))
}

async function readJsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 64 * 1024) throw new Error('请求内容过大')
  }
  return body ? JSON.parse(body) : {}
}

export function createSimulationService(options = {}) {
  const jobs = new Map()
  const queue = []
  const outputDirectory = options.outputDirectory || defaultOutputDirectory
  const scriptPath = options.scriptPath || defaultScriptPath
  const blenderExecutable = findBlenderExecutable(options.blenderExecutable)
  const spawnImpl = options.spawnImpl || spawn
  let active = false
  mkdirSync(outputDirectory, { recursive: true })

  async function runNext() {
    if (active || queue.length === 0) return
    active = true
    const job = queue.shift()
    job.status = 'running'
    job.progress = 20
    job.message = 'Blender 正在生成道路、排水沟与积水面模型'
    const configPath = resolve(outputDirectory, `${job.id}.json`)
    const outputPath = resolve(outputDirectory, `${job.id}.glb`)
    writeFileSync(configPath, JSON.stringify(job.parameters), 'utf8')

    const child = spawnImpl(
      blenderExecutable,
      ['--background', '--python', scriptPath, '--', configPath, outputPath],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let diagnostic = ''
    let settled = false
    const timeout = setTimeout(() => child.kill(), options.timeoutMs || 120000)
    child.stdout?.on('data', (chunk) => {
      diagnostic = `${diagnostic}${chunk}`.slice(-4000)
      job.progress = Math.max(job.progress, 65)
    })
    child.stderr?.on('data', (chunk) => {
      diagnostic = `${diagnostic}${chunk}`.slice(-4000)
    })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      job.status = 'failed'
      job.message = `无法启动 Blender：${error.message}`
      active = false
      void runNext()
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (job.status !== 'failed') {
        if (code === 0 && existsSync(outputPath) && statSync(outputPath).size > 0) {
          job.status = 'completed'
          job.progress = 100
          job.message = 'Blender 模型已生成，可以加载到三维地图'
          job.completedAt = new Date().toISOString()
        } else {
          job.status = 'failed'
          job.message = `Blender 生成失败${diagnostic ? `：${diagnostic.slice(-500)}` : ''}`
        }
      }
      active = false
      void runNext()
    })
  }

  function createJob(payload) {
    const parameters = validateSimulationRequest(payload)
    const id = randomUUID()
    const placement = parameters.placement ?? {
      longitude: 114.964285,
      latitude: 34.9511,
      height: 0,
      heading: 0,
      label: '堌阳镇范围参数化测试场景',
      accuracy: 'township-demo',
    }
    const job = {
      id,
      status: 'queued',
      progress: 8,
      message: '任务已进入本机 Blender 单任务队列',
      createdAt: new Date().toISOString(),
      completedAt: undefined,
      parameters,
      placement,
    }
    jobs.set(id, job)
    queue.push(job)
    void runNext()
    return job
  }

  return {
    createJob,
    getJob(id) {
      return jobs.get(id)
    },
    getModelPath(id, stage) {
      const job = jobs.get(id)
      if (!job || job.status !== 'completed') return undefined
      const filePath = resolve(
        outputDirectory,
        stage ? `${basename(id)}-stage-${stage}.glb` : `${basename(id)}.glb`,
      )
      return existsSync(filePath) ? filePath : undefined
    },
  }
}

export function createSimulationMiddleware(options = {}) {
  const service = options.service || createSimulationService(options)
  const basePath = options.basePath || '/api/simulation'

  return async function simulationMiddleware(request, response, pathname = request.url || '/') {
    const relativePath = pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || '/'
      : pathname
    try {
      if (request.method === 'POST' && relativePath === '/jobs') {
        const job = service.createJob(await readJsonBody(request))
        sendJson(response, 202, publicJob(job, basePath))
        return
      }

      const jobMatch = relativePath.match(/^\/jobs\/([a-f0-9-]+)$/i)
      if (request.method === 'GET' && jobMatch) {
        const job = service.getJob(jobMatch[1])
        if (!job) sendJson(response, 404, { message: '未找到模拟任务' })
        else sendJson(response, 200, publicJob(job, basePath))
        return
      }

      const modelMatch = relativePath.match(/^\/models\/([a-f0-9-]+)(-stage-([1-4]))?\.glb$/i)
      if ((request.method === 'GET' || request.method === 'HEAD') && modelMatch) {
        const filePath = service.getModelPath(modelMatch[1], modelMatch[3])
        if (!filePath) {
          sendJson(response, 404, { message: '模型尚未生成' })
          return
        }
        response.writeHead(200, {
          'Content-Type': 'model/gltf-binary',
          'Content-Length': statSync(filePath).size,
          'Cache-Control': 'no-store',
        })
        if (request.method === 'HEAD') response.end()
        else createReadStream(filePath).pipe(response)
        return
      }

      sendJson(response, 404, { message: '未找到模拟服务接口' })
    } catch (error) {
      sendJson(response, 400, {
        message: error instanceof Error ? error.message : '模拟任务请求失败',
      })
    }
  }
}
