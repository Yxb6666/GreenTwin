import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GovernanceMockError,
  createGovernanceIssuesService,
  validateGovernanceIssueRequest,
} from '../server/governance-issues.mjs'

const dataPath = resolve(
  process.cwd(),
  'public/data/governance/governance-issues.geojson',
)

function createPayload() {
  return {
    userId: 'Easy',
    type: '生态保护类',
    subtype: '岸线垃圾',
    description: '葡萄架村河岸存在生活垃圾，需要巡查清理。',
    images: [
      { url: 'mock://governance/images/one/photo-1.jpg' },
      { url: 'mock://governance/images/two/photo-2.jpg' },
    ],
    town: '三义寨乡',
    village: '葡萄架村',
    longitude: 114.749274,
    latitude: 34.856417,
    contact: '张三',
    phone: '13810001096',
    time: '2026-08-10T14:35:21+08:00',
  }
}

describe('治理问题开发期 Mock 服务', () => {
  it('只读加载现有 116 条记录并支持按编号查询', () => {
    const service = createGovernanceIssuesService({ dataPath })
    const collection = service.list() as {
      features: unknown[]
      metadata: { featureCount: number; runtimeFeatureCount: number }
    }
    expect(collection.features).toHaveLength(116)
    expect(collection.metadata).toMatchObject({
      featureCount: 116,
      runtimeFeatureCount: 0,
    })
    expect(service.get('GK-2026-001')).toMatchObject({
      id: 'GK-2026-001',
      images: [],
    })
  })

  it('从原数据最大编号继续递增，并把新增记录置于集合顶部', () => {
    const original = readFileSync(dataPath, 'utf8')
    const service = createGovernanceIssuesService({ dataPath })
    const first = service.create(createPayload())
    const second = service.create({
      ...createPayload(),
      subtype: '河道漂浮物',
      time: '2026-08-10T15:35:21+08:00',
    })
    expect(first).toMatchObject({ id: 'GK-2026-117', status: '待审核' })
    expect(second).toMatchObject({ id: 'GK-2026-118' })

    const collection = service.list() as {
      features: Array<{
        id: string
        geometry: { coordinates: number[] }
        properties: Record<string, unknown>
      }>
      metadata: { featureCount: number; runtimeFeatureCount: number }
    }
    expect(collection.features).toHaveLength(118)
    expect(collection.metadata).toMatchObject({
      featureCount: 118,
      runtimeFeatureCount: 2,
    })
    expect(collection.features[0]).toMatchObject({
      id: 'GK-2026-118',
      geometry: { coordinates: [114.749274, 34.856417] },
      properties: {
        userId: 'Easy',
        status: '待审核',
        urgency: '中',
        channel: '移动端上报',
        dataClass: 'Mock上报',
      },
    })
    expect(collection.features[0]?.properties).not.toHaveProperty('images')
    expect(readFileSync(dataPath, 'utf8')).toBe(original)
  })

  it('按用户隔离运行期记录并同步统计', () => {
    const service = createGovernanceIssuesService({ dataPath })
    expect(service.listByUser('Easy')).toMatchObject({
      success: true,
      userId: 'Easy',
      summary: { total: 0, processing: 0, completed: 0 },
      issues: [],
    })
    service.create(createPayload())
    service.create({ ...createPayload(), userId: 'VillageUser' })
    expect(service.listByUser('Easy')).toMatchObject({
      summary: { total: 1, processing: 1, completed: 0 },
      issues: [{ userId: 'Easy', id: 'GK-2026-117' }],
    })
    expect(service.listByUser('VillageUser')).toMatchObject({
      summary: { total: 1 },
      issues: [{ userId: 'VillageUser', id: 'GK-2026-118' }],
    })
    expect(service.listByUser('Unknown').summary).toMatchObject({ total: 0 })
    expect(() => service.listByUser('bad/user')).toThrow('用户编号格式不正确')
  })

  it('拒绝分类不匹配、无照片及非法坐标', () => {
    expect(() =>
      validateGovernanceIssueRequest({
        ...createPayload(),
        subtype: '路灯损坏',
      }),
    ).toThrow('问题类型与子类型不匹配')
    expect(() =>
      validateGovernanceIssueRequest({ ...createPayload(), images: [] }),
    ).toThrow('现场照片数量应为 1 至 5 张')
    expect(() =>
      validateGovernanceIssueRequest({ ...createPayload(), longitude: 200 }),
    ).toThrow('经度超出有效范围')
  })

  it('未知编号返回 404 语义错误', () => {
    const service = createGovernanceIssuesService({ dataPath })
    try {
      service.get('GK-2026-999')
      throw new Error('预期查询失败')
    } catch (error) {
      expect(error).toBeInstanceOf(GovernanceMockError)
      expect((error as GovernanceMockError).statusCode).toBe(404)
    }
  })
})
