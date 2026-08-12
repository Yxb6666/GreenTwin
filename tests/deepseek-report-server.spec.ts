import { describe, expect, it, vi } from 'vitest'
import { buildSanshengReportRequest } from '@/features/sansheng/report'
import { scoreTown, towns } from '@/features/sansheng/model'
import {
  generateDeepseekReport,
  validateReportRequest,
} from '../server/deepseek-report.mjs'

function createPayload() {
  const town = towns.find((item) => item.id === '410225108')!
  return buildSanshengReportRequest(
    town,
    scoreTown(town, { ecology: 34, life: 33, production: 33 }),
    { ecology: 34, life: 33, production: 33 },
    69.7,
    3,
    20,
  )
}

const generatedReport = {
  title: '仪封镇三生空间综合评价报告',
  executiveSummary: '综合表现稳定，生产空间具有相对优势。',
  overallAssessment: '综合指数高于县域均值，排名处于前列。',
  dimensionAnalysis: [
    {
      dimension: '生态空间',
      score: 70,
      assessment: '生态基础较好。',
      evidence: ['生态用地占比较高。'],
    },
    {
      dimension: '生活空间',
      score: 72,
      assessment: '生活服务总体平稳。',
      evidence: ['道路通达性较好。'],
    },
    {
      dimension: '生产空间',
      score: 79,
      assessment: '生产空间优势明显。',
      evidence: ['耕地资源基础较强。'],
    },
  ],
  strengths: ['生产空间得分领先。'],
  weaknesses: ['生活服务仍有提升空间。'],
  recommendations: [
    {
      priority: '高',
      action: '补齐公共服务短板',
      basis: '生活空间相对偏弱。',
      expectedOutcome: '提升服务可达性。',
      timeframe: '近期（1年内）',
    },
    {
      priority: '中',
      action: '保持生态空间连续性',
      basis: '生态基础总体稳定。',
      expectedOutcome: '增强生态韧性。',
      timeframe: '中期（1—3年）',
    },
    {
      priority: '低',
      action: '优化产业节点布局',
      basis: '生产空间已有优势。',
      expectedOutcome: '巩固产业协同。',
      timeframe: '长期（3年以上）',
    },
  ],
  risks: ['现有指标需要持续更新。'],
  conclusion: '建议按优先级分期实施。',
}

describe('DeepSeek 报告服务', () => {
  it('拒绝超出范围的综合得分', () => {
    const payload = createPayload()
    expect(() =>
      validateReportRequest({
        ...payload,
        scores: { ...payload.scores, composite: 120 },
      }),
    ).toThrow()
  })

  it('默认调用 deepseek-v4-flash 并解析结构化报告', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            model: 'deepseek-v4-flash',
            choices: [
              { message: { content: JSON.stringify(generatedReport) } },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 300,
              total_tokens: 400,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )

    const result = await generateDeepseekReport(createPayload(), {
      apiKey: 'test-key',
      fetchImpl,
    })
    const [url, init] = fetchImpl.mock.calls[0]!
    const requestBody = JSON.parse(String(init?.body))

    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-key' })
    expect(requestBody.model).toBe('deepseek-v4-flash')
    expect(requestBody.response_format).toEqual({ type: 'json_object' })
    expect(result.report).toMatchObject({ title: generatedReport.title })
    expect(result.meta).toMatchObject({
      model: 'deepseek-v4-flash',
      usage: { totalTokens: 400 },
    })
  })
})
