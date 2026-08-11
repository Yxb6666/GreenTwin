import { readFileSync } from 'node:fs'

const API_PREFIX = '/api/governance/issues'
const MAX_BODY_BYTES = 256 * 1024
const STATUS_VALUES = ['待审核', '已派单', '处理中', '已办结']
const CATEGORY_SUBTYPES = {
  安全风险类: ['电线低垂', '危房隐患', '消防通道堵塞'],
  产业发展类: ['冷库噪声', '园区占道堆料'],
  公共服务类: ['广播设备故障', '候车亭破损', '健身器材损坏'],
  基础设施类: ['道路破损', '供水压力不足', '路灯损坏', '排水涵管堵塞'],
  空间管控类: ['沟渠填埋', '疑似违建', '宅基地越界'],
  农业生产类: ['大棚排水不畅', '灌渠渗漏', '机井故障'],
  人居环境类: ['畜禽粪污', '公厕保洁', '垃圾堆放', '污水外溢'],
  生态保护类: ['岸线垃圾', '河道漂浮物', '露天焚烧'],
}

export class GovernanceMockError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'GovernanceMockError'
    this.statusCode = statusCode
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new GovernanceMockError(`${label} 格式不正确`)
  return value
}

function requireText(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new GovernanceMockError(`${label}不能为空且不能超过 ${maximum} 字`)
  return value.trim()
}

function requireCoordinate(value, label, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
    throw new GovernanceMockError(`${label}超出有效范围`)
  return value
}

export function validateGovernanceIssueRequest(value) {
  const input = requireObject(value, '请求参数')
  const userId = requireText(input.userId, '用户编号', 24)
  if (!/^[\p{L}\p{N}_-]+$/u.test(userId))
    throw new GovernanceMockError('用户编号格式不正确')
  const type = requireText(input.type, '问题类型', 30)
  const subtype = requireText(input.subtype, '问题子类型', 30)
  if (!CATEGORY_SUBTYPES[type]?.includes(subtype))
    throw new GovernanceMockError('问题类型与子类型不匹配')
  if (!Array.isArray(input.images) || input.images.length < 1 || input.images.length > 5)
    throw new GovernanceMockError('现场照片数量应为 1 至 5 张')
  const images = input.images.map((rawImage, index) => {
    const image = requireObject(rawImage, `现场照片 ${index + 1}`)
    return { url: requireText(image.url, `现场照片 ${index + 1} 地址`, 500) }
  })
  const time = requireText(input.time, '上报时间', 40)
  if (!Number.isFinite(Date.parse(time))) throw new GovernanceMockError('上报时间格式不正确')
  const phone = requireText(input.phone, '联系电话', 30).replace(/[\s-]/g, '')
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new GovernanceMockError('联系电话格式不正确')

  return {
    userId,
    type,
    subtype,
    description: requireText(input.description, '问题描述', 200),
    images,
    town: requireText(input.town, '所属乡镇', 40),
    village: requireText(input.village, '所属村庄', 40),
    longitude: requireCoordinate(input.longitude, '经度', -180, 180),
    latitude: requireCoordinate(input.latitude, '纬度', -90, 90),
    contact: requireText(input.contact, '联系人', 40),
    phone,
    time: new Date(time).toISOString(),
  }
}

function featureToIssue(feature) {
  const properties = feature.properties ?? {}
  const coordinates = feature.geometry?.coordinates ?? []
  return {
    userId: String(properties.userId ?? ''),
    id: String(properties.id ?? feature.id ?? ''),
    type: String(properties.type ?? ''),
    subtype: String(properties.subtype ?? ''),
    description: String(properties.description ?? ''),
    images: [],
    town: String(properties.town ?? ''),
    village: String(properties.village ?? ''),
    longitude: Number(coordinates[0]),
    latitude: Number(coordinates[1]),
    contact: String(properties.contact ?? ''),
    phone: String(properties.phone ?? ''),
    time: String(properties.time ?? ''),
    status: STATUS_VALUES.includes(properties.status) ? properties.status : '待审核',
  }
}

function issueToFeature(issue) {
  return {
    type: 'Feature',
    id: issue.id,
    geometry: {
      type: 'Point',
      coordinates: [issue.longitude, issue.latitude],
    },
    properties: {
      id: issue.id,
      userId: issue.userId,
      type: issue.type,
      subtype: issue.subtype,
      description: issue.description,
      contact: issue.contact,
      phone: issue.phone,
      townCode: '',
      town: issue.town,
      villageCode: '',
      village: issue.village,
      address: '',
      time: issue.time,
      urgency: '中',
      status: issue.status,
      channel: '移动端上报',
      dataClass: 'Mock上报',
    },
  }
}

function nextIdState(features) {
  let year = String(new Date().getFullYear())
  let sequence = 0
  features.forEach((feature) => {
    const id = String(feature.properties?.id ?? feature.id ?? '')
    const match = /^GK-(\d{4})-(\d+)$/.exec(id)
    if (!match) return
    const candidate = Number(match[2])
    if (candidate >= sequence) {
      year = match[1]
      sequence = candidate
    }
  })
  return { year, sequence }
}

export function createGovernanceIssuesService({ dataPath, collection } = {}) {
  const baseCollection = structuredClone(
    collection ?? JSON.parse(readFileSync(dataPath, 'utf8')),
  )
  if (baseCollection.type !== 'FeatureCollection' || !Array.isArray(baseCollection.features))
    throw new Error('治理问题基础数据必须是 FeatureCollection')

  const baseIssues = new Map(
    baseCollection.features.map((feature) => {
      const issue = featureToIssue(feature)
      return [issue.id, issue]
    }),
  )
  const runtimeIssues = new Map()
  const idState = nextIdState(baseCollection.features)

  function create(value) {
    const input = validateGovernanceIssueRequest(value)
    idState.sequence += 1
    const id = `GK-${idState.year}-${String(idState.sequence).padStart(3, '0')}`
    const issue = { ...input, id, status: '待审核' }
    runtimeIssues.set(id, issue)
    return structuredClone(issue)
  }

  function get(id) {
    const issue = runtimeIssues.get(id) ?? baseIssues.get(id)
    if (!issue) throw new GovernanceMockError('未找到该问题记录', 404)
    return structuredClone(issue)
  }

  function list() {
    const runtimeFeatures = [...runtimeIssues.values()].map(issueToFeature)
    const features = [...structuredClone(baseCollection.features), ...runtimeFeatures].sort(
      (left, right) =>
        Date.parse(String(right.properties?.time ?? '')) -
        Date.parse(String(left.properties?.time ?? '')),
    )
    return {
      ...structuredClone(baseCollection),
      metadata: {
        ...(baseCollection.metadata ?? {}),
        featureCount: features.length,
        runtimeFeatureCount: runtimeFeatures.length,
      },
      features,
    }
  }

  function listByUser(userIdValue) {
    const userId = requireText(userIdValue, '用户编号', 24)
    if (!/^[\p{L}\p{N}_-]+$/u.test(userId))
      throw new GovernanceMockError('用户编号格式不正确')
    const issues = [...runtimeIssues.values()]
      .filter((issue) => issue.userId === userId)
      .sort((left, right) => Date.parse(right.time) - Date.parse(left.time))
      .map((issue) => structuredClone(issue))
    const completed = issues.filter((issue) => issue.status === '已办结').length
    return {
      success: true,
      userId,
      summary: {
        total: issues.length,
        processing: issues.length - completed,
        completed,
      },
      issues,
    }
  }

  return { create, get, list, listByUser }
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new GovernanceMockError('请求内容过大', 413)
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new GovernanceMockError('请求体必须是有效 JSON')
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

export function createGovernanceIssuesMiddleware(options) {
  const service = createGovernanceIssuesService(options)
  return async (request, response, next) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname
    if (pathname !== API_PREFIX && !pathname.startsWith(`${API_PREFIX}/`)) {
      next?.()
      return
    }

    const suffix = pathname.slice(API_PREFIX.length).replace(/^\/+|\/+$/g, '')
    try {
      if (request.method === 'GET' && suffix.startsWith('user/')) {
        const userId = suffix.slice('user/'.length)
        if (!userId || userId.includes('/'))
          throw new GovernanceMockError('用户编号格式不正确')
        sendJson(response, 200, service.listByUser(decodeURIComponent(userId)))
        return
      }
      if (request.method === 'GET' && !suffix) {
        sendJson(response, 200, service.list())
        return
      }
      if (request.method === 'GET' && suffix && !suffix.includes('/')) {
        sendJson(response, 200, { success: true, issue: service.get(decodeURIComponent(suffix)) })
        return
      }
      if (request.method === 'POST' && !suffix) {
        const issue = service.create(await readJsonBody(request))
        sendJson(response, 201, { success: true, id: issue.id })
        return
      }
      throw new GovernanceMockError('请求方法不受支持', 405)
    } catch (error) {
      const statusCode = error instanceof GovernanceMockError ? error.statusCode : 500
      const message =
        error instanceof GovernanceMockError ? error.message : 'Mock 服务处理失败'
      sendJson(response, statusCode, { success: false, message })
    }
  }
}
