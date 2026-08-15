export interface SimulationPlot {
  key: string
  label: string
  description: string
  applicationLabel: string
  applicationSummary: string
  applicationScenarios: Array<{
    icon: string
    label: string
    description: string
  }>
  applicationTags: string[]
  center: { longitude: number; latitude: number }
  ring: Array<[longitude: number, latitude: number]>
}

export function createPlotRectangle(
  longitude: number,
  latitude: number,
  widthMeters: number,
  heightMeters: number,
  headingDegrees: number,
): Array<[longitude: number, latitude: number]> {
  const latitudeScale = 111_320
  const longitudeScale = latitudeScale * Math.cos((latitude * Math.PI) / 180)
  const halfWidth = widthMeters / 2
  const halfHeight = heightMeters / 2
  const angle = (headingDegrees * Math.PI) / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const offsets: Array<[number, number]> = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ]
  const corners = offsets.map(([x, y]) => {
    const east = x * cosine - y * sine
    const north = x * sine + y * cosine
    return [
      longitude + east / longitudeScale,
      latitude + north / latitudeScale,
    ] as [number, number]
  })
  return [...corners, corners[0]!]
}

export const SIMULATION_PLOTS: readonly SimulationPlot[] = [
  {
    key: 'xuchang-renewal',
    label: '徐场村更新地块',
    description: '村庄公共空间与生活服务设施更新',
    applicationLabel: '生活服务与公共空间更新',
    applicationSummary:
      '适合验证村庄公共服务补短板、闲置空间再利用和居民日常活动场景。',
    applicationScenarios: [
      {
        icon: '服',
        label: '便民服务设施',
        description: '配置综合服务站、养老助餐与便民零售等生活服务。',
      },
      {
        icon: '邻',
        label: '邻里共享空间',
        description: '模拟口袋公园、儿童活动与村民议事空间的组合布局。',
      },
      {
        icon: '新',
        label: '闲置地块更新',
        description: '比选低效用地盘活、建筑植入与慢行环境改善方案。',
      },
    ],
    applicationTags: ['生活空间', '公共服务', '存量更新'],
    center: { longitude: 114.9685, latitude: 34.95 },
    ring: createPlotRectangle(114.9685, 34.95, 118, 76, 8),
  },
  {
    key: 'guyang-industry',
    label: '堌阳东侧产业地块',
    description: '生产空间整理与乡村产业设施提升',
    applicationLabel: '乡村产业与生产设施提升',
    applicationSummary:
      '适合推演农产品加工、仓储物流和产业配套设施的空间组织与建设影响。',
    applicationScenarios: [
      {
        icon: '产',
        label: '农产品加工',
        description: '模拟加工车间、分拣包装与生产辅助空间布局。',
      },
      {
        icon: '储',
        label: '仓储物流组织',
        description: '验证仓储容量、车辆流线与装卸节点的配置关系。',
      },
      {
        icon: '配',
        label: '产业配套完善',
        description: '比选管理、展示、电商与就业服务等复合功能。',
      },
    ],
    applicationTags: ['生产空间', '产业振兴', '设施提升'],
    center: { longitude: 114.982, latitude: 34.954 },
    ring: createPlotRectangle(114.982, 34.954, 142, 88, -14),
  },
  {
    key: 'canal-ecology',
    label: '北部河渠生态地块',
    description: '滨水缓冲带与生态修复示范空间',
    applicationLabel: '河渠生态修复与滨水利用',
    applicationSummary:
      '适合评估河渠缓冲、雨洪调蓄和低干扰滨水活动对生态空间的改善效果。',
    applicationScenarios: [
      {
        icon: '水',
        label: '雨洪调蓄',
        description: '模拟生态沟渠、下凹绿地与调蓄空间的组合策略。',
      },
      {
        icon: '岸',
        label: '滨岸带修复',
        description: '验证岸线缓冲、乡土植被恢复与水体保护范围。',
      },
      {
        icon: '游',
        label: '低干扰游憩',
        description: '比选生态步道、观景节点和自然教育设施布局。',
      },
    ],
    applicationTags: ['生态空间', '河渠修复', '韧性提升'],
    center: { longitude: 114.948, latitude: 34.962 },
    ring: createPlotRectangle(114.948, 34.962, 156, 68, 24),
  },
]
