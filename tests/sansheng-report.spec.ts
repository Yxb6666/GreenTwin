import { describe, expect, it } from 'vitest'
import { scoreTown, towns } from '@/features/sansheng/model'
import {
  buildSanshengReportRequest,
  type ReportMeta,
  type SanshengReport,
} from '@/features/sansheng/report'
import {
  createReportDocxBlob,
  createReportDocxFileName,
} from '@/features/sansheng/reportDocx'

const report: SanshengReport = {
  title: '仪封镇三生空间综合评价报告',
  executiveSummary: '仪封镇综合表现稳健。',
  overallAssessment: '综合指数高于县域均值。',
  dimensionAnalysis: [
    {
      dimension: '生态空间',
      score: 70,
      assessment: '生态基础较好。',
      evidence: ['生态用地指标表现稳定。'],
    },
    {
      dimension: '生活空间',
      score: 72,
      assessment: '公共服务仍可提升。',
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
  weaknesses: ['公共服务设施仍有提升空间。'],
  recommendations: [
    {
      priority: '高',
      action: '补齐公共服务短板',
      basis: '生活空间得分相对较低。',
      expectedOutcome: '改善服务可达性。',
      timeframe: '近期（1年内）',
    },
  ],
  risks: ['指标数据需要持续更新。'],
  conclusion: '建议分期推进治理行动。',
}

describe('DeepSeek 三生空间报告前端数据', () => {
  it('构建 15 项指标并使用归一化后的权重', () => {
    const town = towns.find((item) => item.id === '410225108')!
    const scores = scoreTown(town, { ecology: 34, life: 33, production: 33 })
    const payload = buildSanshengReportRequest(
      town,
      scores,
      { ecology: 34, life: 33, production: 33 },
      69.7,
      3,
      20,
    )

    expect(payload.townName).toBe('仪封镇')
    expect(payload.indicators).toHaveLength(15)
    expect(
      payload.weights.ecology +
        payload.weights.life +
        payload.weights.production,
    ).toBeCloseTo(100, 1)
    expect(
      payload.indicators.find((item) => item.name === '平均坡度'),
    ).toMatchObject({ direction: 'negative', rawValue: 4.4752 })
  })

  it('将结构化报告打包为 Word 文档', async () => {
    const meta: ReportMeta = {
      model: 'deepseek-v4-flash',
      generatedAt: '2026-08-03T10:00:00.000Z',
      usage: null,
    }
    const blob = await createReportDocxBlob(report, meta)

    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    expect(blob.size).toBeGreaterThan(3000)
    expect(createReportDocxFileName('仪封镇')).toBe(
      '仪封镇-三生空间详细报告.docx',
    )
  })
})
