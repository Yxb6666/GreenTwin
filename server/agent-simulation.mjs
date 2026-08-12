import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  createReadStream,
  mkdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { parseBuildingPrompt } from './simulation-prompt.mjs'

const projectRoot = resolve(process.cwd())
const defaultOutputDirectory = resolve(projectRoot, 'tmp', 'agent-models')
const defaultScriptPath = resolve(
  projectRoot,
  'scripts',
  'blender',
  'agent_runner.py',
)
const windowsBlenderPath = 'C:\\Tools\\blender-4.5.12-windows-x64\\blender.exe'
const MAX_CODE_LENGTH = 20000
const MAX_PRIMITIVE_CALLS = 500
const DEFAULT_AGENT_MODEL = 'deepseek-v4-flash'

const FORBIDDEN_CODE_PATTERNS = [
  /\bimport\s+(os|sys|subprocess|shutil|socket|urllib|requests|pathlib|json|base64|ctypes|platform|glob|tempfile|zipfile|tarfile)\b/,
  /\bfrom\s+(os|sys|subprocess|shutil|socket|urllib|requests|pathlib|json|base64|ctypes|platform|glob|tempfile|zipfile|tarfile)\b/,
  /__import__|__builtins__|__globals__/,
  /\beval\s*\(|\bexec\s*\(|\bcompile\s*\(/,
  /\bopen\s*\(|\bPopen\s*\(|\bsystem\s*\(|\bexecfile/,
  /\bos\.|\bsys\.|\bsubprocess|\bshutil\.|\bsocket\b|\bPath\s*\(|\benviron\b|\bgetenv\b|\.read_text|\.write_text|\.unlink|\.rmdir|\.rename/,
]

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
    if (body.length > 128 * 1024) throw new Error('请求内容过大')
  }
  return body ? JSON.parse(body) : {}
}

function validatePlacement(value) {
  if (value == null) return null
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
  if (!Number.isFinite(heading)) throw new Error('落点朝向无效')
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

export function validateAgentRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('请求参数必须是对象')
  }
  const prompt =
    typeof payload.prompt === 'string' ? payload.prompt.trim() : ''
  if (!prompt || prompt.length < 4 || prompt.length > 600) {
    throw new Error('提示词长度必须在 4-600 字之间')
  }
  const requestedStyle =
    typeof payload.buildingStyle === 'string' ? payload.buildingStyle : ''
  const building = parseBuildingPrompt(prompt, requestedStyle)
  const placement = validatePlacement(payload.placement)
  return {
    prompt,
    building,
    placement: placement ?? {
      longitude: 114.964285,
      latitude: 34.9511,
      height: 0,
      heading: 0,
      label: '堌阳镇范围参数化测试场景',
      accuracy: 'township-demo',
    },
  }
}

export function extractAgentCode(content) {
  const normalized = String(content || '')
    .trim()
    .replace(/^```(?:json|python)?\s*/i, '')
    .replace(/\s*```$/, '')
  let value
  try {
    value = JSON.parse(normalized)
  } catch {
    throw new Error('DeepSeek 未返回合法 JSON')
  }
  const code = value?.code
  if (typeof code !== 'string' || !code.trim()) {
    throw new Error('DeepSeek 未返回可执行的 Blender 代码')
  }
  return code.trim()
}

export function validateGeneratedCode(code) {
  const source = String(code || '')
  if (!source.includes('def build_custom')) {
    throw new Error('生成的代码缺少 build_custom 函数')
  }
  if (source.length > MAX_CODE_LENGTH) {
    throw new Error('生成的代码过长，已拒绝执行')
  }
  for (const pattern of FORBIDDEN_CODE_PATTERNS) {
    if (pattern.test(source)) {
      throw new Error('生成的代码包含不允许的系统访问操作')
    }
  }
  const primitiveCalls = (
    source.match(
      /add_box|add_beveled_box|add_cylinder|add_beam_between|add_roof_mesh|primitive_(cube|cylinder|uv_sphere|cone)_add/g,
    ) || []
  ).length
  if (primitiveCalls > MAX_PRIMITIVE_CALLS) {
    throw new Error('生成的模型过于复杂，已限制执行')
  }
  return { length: source.length, primitiveCalls }
}

export async function generateAgentScript(
  prompt,
  building,
  options,
  timeoutMs,
) {
  const apiKey =
    options.apiKey || process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('服务端未配置 DEEPSEEK_API_KEY，3D Agent 无法生成脚本')
  }
  const baseUrl = (
    options.baseUrl ||
    process.env.DEEPSEEK_API_BASE_URL ||
    'https://api.deepseek.com'
  ).replace(/\/$/, '')
  const model =
    options.model || process.env.DEEPSEEK_MODEL || DEFAULT_AGENT_MODEL
  const fetchImpl = options.fetchImpl || fetch
  const system = [
    '你是 GreenTwin 的 Blender 程序化建模 Agent。',
    '根据用户提示词生成 Python 函数 build_custom(config)，只调用提供的辅助函数与 bpy/math/mathutils。',
    '辅助函数：material(name,color,metallic,roughness)、add_box(name,location,dimensions,material,build_stage)、add_beveled_box(...)、add_cylinder(...)、add_beam_between(...)、add_roof_mesh(...)。',
    '规则：不导入任何模块、不读写文件、不执行系统命令、不访问网络；坐标单位为米，建筑底平面中心放在 (0,0,0) 附近；每个几何体必须设置 build_stage（1-4，从地基到装饰）；控制对象数量在 200 个以内。',
    '必须只输出 JSON：{"code":"<build_custom 函数完整源码>"}，不使用 Markdown 代码围栏。',
  ].join('\n')
  let response
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `用户提示词：${prompt}\n\n解析后的建造参数（JSON）：${JSON.stringify(building)}\n\n请生成 build_custom(config) 的完整源码。`,
          },
        ],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        temperature: 0.2,
        max_tokens: 4000,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error('DeepSeek 生成脚本超时，请重试')
    }
    throw new Error(`无法连接 DeepSeek：${error instanceof Error ? error.message : '未知错误'}`)
  }
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'DeepSeek API Key 无效，请检查服务端配置'
        : `DeepSeek 上游错误 ${response.status}`,
    )
  }
  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('DeepSeek 未返回内容')
  }
  return extractAgentCode(content)
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
            (stage) =>
              `${basePath}/models/${encodeURIComponent(job.id)}-stage-${stage}.glb`,
          )
        : undefined,
    placement: job.placement,
    parameters: {
      prompt: job.parameters.prompt,
      building: job.parameters.building,
    },
  }
}

export function createAgentSimulationService(options = {}) {
  const jobs = new Map()
  const queue = []
  const outputDirectory = options.outputDirectory || defaultOutputDirectory
  const scriptPath = options.scriptPath || defaultScriptPath
  const blenderExecutable = findBlenderExecutable(options.blenderExecutable)
  const spawnImpl = options.spawnImpl || spawn
  const timeoutMs = options.timeoutMs || 180000
  const scriptTimeoutMs = options.scriptTimeoutMs || 60000
  let active = false
  mkdirSync(outputDirectory, { recursive: true })

  async function runNext() {
    if (active || queue.length === 0) return
    active = true
    const job = queue.shift()
    job.status = 'running'
    job.progress = 12
    job.message = 'DeepSeek 正在生成 Blender 脚本'
    try {
      const code = await generateAgentScript(
        job.parameters.prompt,
        job.parameters.building,
        options,
        scriptTimeoutMs,
      )
      validateGeneratedCode(code)
      const codePath = resolve(outputDirectory, `${job.id}.py`)
      const configPath = resolve(outputDirectory, `${job.id}.json`)
      const outputPath = resolve(outputDirectory, `${job.id}.glb`)
      writeFileSync(codePath, code, 'utf8')
      writeFileSync(
        configPath,
        JSON.stringify({
          prompt: job.parameters.prompt,
          building: job.parameters.building,
        }),
        'utf8',
      )
      job.progress = 30
      job.message = '脚本已生成并通过安全校验，正在启动 Blender 渲染'

      const child = spawnImpl(
        blenderExecutable,
        ['--background', '--python', scriptPath, '--', codePath, configPath, outputPath],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      let diagnostic = ''
      const killTimer = setTimeout(() => child.kill(), timeoutMs)
      child.stdout?.on('data', (chunk) => {
        diagnostic = `${diagnostic}${chunk}`.slice(-4000)
        job.progress = Math.max(job.progress, 45)
      })
      child.stderr?.on('data', (chunk) => {
        diagnostic = `${diagnostic}${chunk}`.slice(-4000)
      })
      await new Promise((resolveClose, rejectClose) => {
        child.once('error', rejectClose)
        child.once('close', (code) => resolveClose(code))
      }).catch((error) => {
        clearTimeout(killTimer)
        throw new Error(`无法启动 Blender：${error.message}`)
      })
      clearTimeout(killTimer)
      if (
        existsSync(outputPath) &&
        statSync(outputPath).size > 0
      ) {
        job.status = 'completed'
        job.progress = 100
        job.message = '3D Agent 已生成模型，可以加载到三维地图'
        job.completedAt = new Date().toISOString()
      } else {
        throw new Error(
          `Blender 生成失败${diagnostic ? `：${diagnostic.slice(-500)}` : ''}`,
        )
      }
    } catch (error) {
      job.status = 'failed'
      job.message =
        error instanceof Error ? error.message : '3D Agent 生成失败'
    } finally {
      active = false
      void runNext()
    }
  }

  function createAgentJob(payload) {
    const parameters = validateAgentRequest(payload)
    const id = randomUUID()
    const job = {
      id,
      status: 'queued',
      progress: 5,
      message: '3D Agent 任务已进入队列',
      createdAt: new Date().toISOString(),
      completedAt: undefined,
      parameters,
      placement: parameters.placement,
    }
    jobs.set(id, job)
    queue.push(job)
    void runNext()
    return job
  }

  return {
    createAgentJob,
    getAgentJob(id) {
      return jobs.get(id)
    },
    getModelPath(id, stage) {
      const job = jobs.get(id)
      if (!job || job.status !== 'completed') return undefined
      const filePath = resolve(
        outputDirectory,
        stage ? `${id}-stage-${stage}.glb` : `${id}.glb`,
      )
      return existsSync(filePath) ? filePath : undefined
    },
  }
}

export function createAgentSimulationMiddleware(options = {}) {
  const service = options.service || createAgentSimulationService(options)
  const basePath = options.basePath || '/api/agent-simulation'

  return async function agentSimulationMiddleware(
    request,
    response,
    pathname = request.url || '/',
  ) {
    const relativePath = pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || '/'
      : pathname
    try {
      if (request.method === 'POST' && relativePath === '/jobs') {
        const job = service.createAgentJob(await readJsonBody(request))
        sendJson(response, 202, publicJob(job, basePath))
        return
      }

      const jobMatch = relativePath.match(/^\/jobs\/([a-f0-9-]+)$/i)
      if (request.method === 'GET' && jobMatch) {
        const job = service.getAgentJob(jobMatch[1])
        if (!job) sendJson(response, 404, { message: '未找到 3D Agent 任务' })
        else sendJson(response, 200, publicJob(job, basePath))
        return
      }

      const modelMatch = relativePath.match(
        /^\/models\/([a-f0-9-]+)(-stage-([1-4]))?\.glb$/i,
      )
      if (
        (request.method === 'GET' || request.method === 'HEAD') &&
        modelMatch
      ) {
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

      sendJson(response, 404, { message: '未找到 3D Agent 服务接口' })
    } catch (error) {
      sendJson(response, 400, {
        message: error instanceof Error ? error.message : '3D Agent 请求失败',
      })
    }
  }
}
