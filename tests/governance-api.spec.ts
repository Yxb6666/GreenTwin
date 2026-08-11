import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGovernanceIssue,
  getGovernanceIssue,
  listGovernanceIssues,
  listGovernanceIssuesByUser,
} from '@/api/governance'

afterEach(() => vi.unstubAllGlobals())

describe('治理问题 API 客户端', () => {
  it('读取不带响应包裹的 FeatureCollection', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listGovernanceIssues('/api', 1000)).resolves.toMatchObject({
      type: 'FeatureCollection',
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/governance/issues')
  })

  it('按约定提交 JSON 并返回新问题编号', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ success: true, id: 'GK-2026-117' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const payload = {
      userId: 'Easy',
      type: '生态保护类',
      subtype: '岸线垃圾',
      description: '河岸存在生活垃圾。',
      images: [{ url: 'mock://governance/images/1/photo.jpg' }],
      town: '三义寨乡',
      village: '葡萄架村',
      longitude: 114.749274,
      latitude: 34.856417,
      contact: '张三',
      phone: '13810001096',
      time: '2026-08-10T14:35:21+08:00',
    }
    await expect(createGovernanceIssue('/api', 1000, payload)).resolves.toEqual({
      success: true,
      id: 'GK-2026-117',
    })
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual(payload)
  })

  it('读取用户问题列表与统计摘要', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          success: true,
          userId: 'Easy',
          summary: { total: 0, processing: 0, completed: 0 },
          issues: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(listGovernanceIssuesByUser('/api', 1000, 'Easy')).resolves.toMatchObject({
      userId: 'Easy',
      summary: { total: 0 },
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/governance/issues/user/Easy')
  })

  it('查询单条问题并传递服务端错误信息', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ success: false, message: '未找到该问题记录' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(getGovernanceIssue('/api', 1000, 'GK-2026-999')).rejects.toThrow(
      '未找到该问题记录',
    )
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/governance/issues/GK-2026-999',
    )
  })
})
