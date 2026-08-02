export type IssueStatus = '待审核' | '已派单' | '处理中' | '已办结'
export type Urgency = '高' | '中' | '低'

export interface GovernanceIssue {
  id: string
  type: string
  subtype: string
  description: string
  contact: string
  phone: string
  town: string
  village: string
  time: string
  urgency: Urgency
  status: IssueStatus
}

export const initialIssues: GovernanceIssue[] = [
  { id: 'GK-2026-001', type: '人居环境类', subtype: '垃圾堆放', description: '村口沟渠旁存在生活垃圾集中堆放。', contact: '王海', phone: '13800010001', town: '城关乡', village: '南街村', time: '2026-07-30T09:12:00+08:00', urgency: '中', status: '处理中' },
  { id: 'GK-2026-002', type: '基础设施类', subtype: '路灯损坏', description: '村主干道连续三盏路灯无法正常照明。', contact: '李敏', phone: '13800010002', town: '仪封镇', village: '东岗村', time: '2026-07-29T18:35:00+08:00', urgency: '中', status: '已派单' },
  { id: 'GK-2026-003', type: '空间管控类', subtype: '疑似违建', description: '耕地保护红线附近发现新增硬化斑块。', contact: '赵刚', phone: '13800010003', town: '东坝头镇', village: '沿河村', time: '2026-07-28T14:18:00+08:00', urgency: '高', status: '待审核' },
  { id: 'GK-2026-004', type: '安全风险类', subtype: '危房隐患', description: '老旧房屋墙体开裂，雨天渗漏严重。', contact: '高峰', phone: '13800010004', town: '许河乡', village: '中街村', time: '2026-07-27T10:26:00+08:00', urgency: '高', status: '处理中' },
  { id: 'GK-2026-005', type: '人居环境类', subtype: '河道漂浮物', description: '支渠水面有成片漂浮物，需要及时清理。', contact: '陈芳', phone: '13800010005', town: '红庙镇', village: '高庄村', time: '2026-07-25T08:40:00+08:00', urgency: '低', status: '已办结' },
  { id: 'GK-2026-006', type: '基础设施类', subtype: '道路破损', description: '生产道路出现沉陷，影响农机安全通行。', contact: '刘洋', phone: '13800010006', town: '谷营镇', village: '小宋村', time: '2026-07-23T16:05:00+08:00', urgency: '高', status: '已派单' },
  { id: 'GK-2026-007', type: '人居环境类', subtype: '污水外溢', description: '污水井堵塞后外溢至道路边缘。', contact: '孙悦', phone: '13800010007', town: '葡萄架乡', village: '贺村', time: '2026-07-20T11:45:00+08:00', urgency: '中', status: '处理中' },
  { id: 'GK-2026-008', type: '空间管控类', subtype: '占地异常', description: '建设边界外发现硬化场地，需核实审批手续。', contact: '马超', phone: '13800010008', town: '谷营镇', village: '小宋村', time: '2026-07-19T16:42:00+08:00', urgency: '高', status: '已派单' },
  { id: 'GK-2026-009', type: '空间管控类', subtype: '河道侵占', description: '河道边坡存在临时围挡和杂物堆压。', contact: '朱琳', phone: '13800010009', town: '东坝头镇', village: '沿河村', time: '2026-07-17T09:30:00+08:00', urgency: '中', status: '处理中' },
  { id: 'GK-2026-010', type: '安全风险类', subtype: '消防通道堵塞', description: '堆物占道导致消防车无法正常通行。', contact: '何静', phone: '13800010010', town: '红庙镇', village: '高庄村', time: '2026-07-15T18:10:00+08:00', urgency: '中', status: '已办结' },
]
