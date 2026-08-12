import { describe, expect, it, vi } from 'vitest'
import {
  generateDecisionAnswer,
  validateDecisionAssistantRequest,
} from '../server/decision-assistant.mjs'

function createPayload() {
  return {
    question: '当前方案是否值得实施？',
    history: [],
    context: {
      module: '三生模拟',
      scopeLabel: '道路积水治理 · 方案 A',
      updatedAt: '2026-08-11T00:00:00Z',
      data: {
        composite: 82.3,
        cost: '48 万元',
        nested: { risk: '低' },
        invalid: Number.NaN,
      },
    },
  }
}

describe('通用 AI 决策助手服务', () => {
  it('校验请求并清理非有限数值', () => {
    const result = validateDecisionAssistantRequest(createPayload()) as {
      context: { data: Record<string, unknown> }
    }
    expect(result.context.data).toMatchObject({
      composite: 82.3,
      cost: '48 万元',
    })
    expect(result.context.data.invalid).toBeNull()
  })

  it('仅依据页面数据生成结构化研判', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'deepseek-v4-flash',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answer: '方案综合得分较高，可进入现场核验。',
                  evidence: ['综合得分 82.3，风险为低。'],
                  suggestions: ['核验 48 万元成本口径。'],
                  disclaimer: '尚未提供现场核验结果。',
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await generateDecisionAnswer(createPayload(), {
      apiKey: 'test-key',
      fetchImpl,
    })
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))

    expect(body.messages.at(-1).content).toContain('道路积水治理 · 方案 A')
    expect(result).toMatchObject({
      answer: '方案综合得分较高，可进入现场核验。',
      scopeLabel: '道路积水治理 · 方案 A',
    })
  })

  it('先用 Claude Vision 识图，再将视觉证据交给 DeepSeek', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  summary: '图片显示一处道路积水。',
                  observations: ['路面存在连续水面'],
                  uncertainties: ['无法从图片确认积水深度'],
                  recommendedFocus: ['结合排水口位置研判'],
                }),
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: 'deepseek-v4-flash',
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: '图片可作为道路积水的辅助证据。',
                    evidence: ['路面存在连续水面。'],
                    suggestions: ['现场测量积水深度。'],
                    disclaimer: '图片无法确定精确深度。',
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

    const result = (await generateDecisionAnswer(
      {
        ...createPayload(),
        image: {
          name: 'evidence.png',
          mediaType: 'image/png',
          data: Buffer.from('test-image').toString('base64'),
        },
      },
      {
        apiKey: 'deepseek-test-key',
        anthropicApiKey: 'claude-test-key',
        fetchImpl,
      },
    )) as { meta: { visionModel?: string } }
    const visionBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    const deepSeekBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://api.anthropic.com/v1/messages',
    )
    expect(visionBody.messages[0].content[0].type).toBe('image')
    expect(deepSeekBody.messages.at(-1).content).toContain('路面存在连续水面')
    expect(result.meta.visionModel).toBe('claude-sonnet-4-20250514')
  })
})
