import {
  dimensionMeta,
  normalizeTownIndicator,
  normalizeWeights,
  type DimensionKey,
  type Direction,
  type Town,
} from './model'

export interface TownScores {
  ecology: number
  life: number
  production: number
  composite: number
}

export interface SanshengReportRequest {
  townName: string
  rank: number
  townCount: number
  countyAverage: number
  scores: TownScores
  weights: Record<DimensionKey, number>
  indicators: Array<{
    dimension: DimensionKey
    name: string
    rawValue: number
    normalizedScore: number
    unit: string
    direction: Direction
  }>
}

export interface SanshengReport {
  title: string
  executiveSummary: string
  overallAssessment: string
  dimensionAnalysis: Array<{
    dimension: string
    score: number
    assessment: string
    evidence: string[]
  }>
  strengths: string[]
  weaknesses: string[]
  recommendations: Array<{
    priority: '高' | '中' | '低'
    action: string
    basis: string
    expectedOutcome: string
    timeframe: string
  }>
  risks: string[]
  conclusion: string
}

export interface ReportMeta {
  model: string
  generatedAt: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  } | null
}

export interface SanshengReportResponse {
  report: SanshengReport
  meta: ReportMeta
}

const dimensionKeys: DimensionKey[] = ['ecology', 'life', 'production']

export function buildSanshengReportRequest(
  town: Town,
  scores: TownScores,
  weights: Record<DimensionKey, number>,
  countyAverage: number,
  rank: number,
  townCount: number,
): SanshengReportRequest {
  const normalizedWeights = normalizeWeights(weights)
  return {
    townName: town.name,
    rank,
    townCount,
    countyAverage,
    scores,
    weights: Object.fromEntries(
      dimensionKeys.map((key) => [
        key,
        Number((normalizedWeights[key] * 100).toFixed(1)),
      ]),
    ) as Record<DimensionKey, number>,
    indicators: dimensionKeys.flatMap((dimension) =>
      dimensionMeta[dimension].indicators.flatMap((indicator) => {
        const rawValue = town[dimension][indicator.key]
        const normalizedScore = normalizeTownIndicator(
          town,
          dimension,
          indicator,
        )
        if (rawValue == null || normalizedScore == null) return []
        return {
          dimension,
          name: indicator.name,
          rawValue,
          normalizedScore,
          unit: indicator.unit,
          direction: indicator.direction,
        }
      }),
    ),
  }
}

function isReportResponse(value: unknown): value is SanshengReportResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<SanshengReportResponse>
  return Boolean(
    response.report &&
      typeof response.report.title === 'string' &&
      typeof response.report.executiveSummary === 'string' &&
      Array.isArray(response.report.dimensionAnalysis) &&
      Array.isArray(response.report.recommendations) &&
      response.meta &&
      typeof response.meta.model === 'string' &&
      typeof response.meta.generatedAt === 'string',
  )
}

export async function requestSanshengReport(
  apiBaseUrl: string,
  timeoutMs: number,
  payload: SanshengReportRequest,
): Promise<SanshengReportResponse> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/reports/sansheng`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        result &&
        typeof result === 'object' &&
        'message' in result &&
        typeof result.message === 'string'
          ? result.message
          : `报告请求失败（HTTP ${response.status}）`
      throw new Error(message)
    }
    if (!isReportResponse(result)) throw new Error('服务端返回的报告结构不正确')
    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('报告生成超时，请稍后重试')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export function formatReportAsText(report: SanshengReport, meta: ReportMeta) {
  const lines = [
    report.title,
    `生成时间：${new Date(meta.generatedAt).toLocaleString('zh-CN', { hour12: false })}`,
    `生成模型：${meta.model}`,
    '',
    '一、执行摘要',
    report.executiveSummary,
    '',
    '二、总体评价',
    report.overallAssessment,
    '',
    '三、分维度分析',
  ]

  report.dimensionAnalysis.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.dimension}（${item.score}分）`,
      item.assessment,
    )
    item.evidence.forEach((evidence) => lines.push(`   - ${evidence}`))
  })

  lines.push('', '四、主要优势')
  report.strengths.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
  lines.push('', '五、关键短板')
  report.weaknesses.forEach((item, index) =>
    lines.push(`${index + 1}. ${item}`),
  )
  lines.push('', '六、行动建议')
  report.recommendations.forEach((item, index) => {
    lines.push(
      `${index + 1}. [${item.priority}优先级] ${item.action}`,
      `   数据依据：${item.basis}`,
      `   预期成效：${item.expectedOutcome}`,
      `   实施时序：${item.timeframe}`,
    )
  })
  lines.push('', '七、风险与限制')
  report.risks.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
  lines.push(
    '',
    '八、结论',
    report.conclusion,
    '',
    '说明：本报告由 AI 基于当前页面指标生成，仅供辅助研判。',
  )
  return lines.join('\n')
}
