import type { SanshengScores } from './model'

export type SanshengMapMetric = keyof SanshengScores

export const SANSHENG_MAP_METRICS: Array<{
  key: SanshengMapMetric
  label: string
}> = [
  { key: 'composite', label: '综合' },
  { key: 'ecology', label: '生态' },
  { key: 'life', label: '生活' },
  { key: 'production', label: '生产' },
]

export const SANSHENG_SCORE_LEVELS = [
  { minimum: 80, range: '80–100', label: '优秀', color: '#178f76' },
  { minimum: 60, range: '60–79', label: '良好', color: '#43bd83' },
  { minimum: 40, range: '40–59', label: '中等', color: '#b4cc67' },
  { minimum: 20, range: '20–39', label: '较低', color: '#dfa953' },
  { minimum: 0, range: '0–19', label: '低', color: '#c96b55' },
] as const

export function resolveSanshengScoreLevel(score: number) {
  const safeScore = Number.isFinite(score) ? score : 0
  return (
    SANSHENG_SCORE_LEVELS.find((level) => safeScore >= level.minimum) ??
    SANSHENG_SCORE_LEVELS[SANSHENG_SCORE_LEVELS.length - 1]!
  )
}
