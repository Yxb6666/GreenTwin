import type { GovernanceIssueStatus } from '@/api/governance'

export function maskPhone(phone: string) {
  const normalized = phone.replace(/\D/g, '')
  return /^1\d{10}$/.test(normalized)
    ? `${normalized.slice(0, 3)}****${normalized.slice(-4)}`
    : '暂无上报信息'
}

export function formatIssueDate(value: string, includeTime = false) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime
      ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
      : {}),
  })
    .format(date)
    .replace(/\//g, '-')
}

export function statusClass(status: GovernanceIssueStatus) {
  if (status === '已办结') return 'is-completed'
  if (status === '处理中') return 'is-processing'
  return 'is-pending'
}
