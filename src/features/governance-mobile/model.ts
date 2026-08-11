import type {
  CreateGovernanceIssueRequest,
  GovernanceFeatureCollection,
} from '@/api/governance'

export const governanceCategories = {
  安全风险类: ['电线低垂', '危房隐患', '消防通道堵塞'],
  产业发展类: ['冷库噪声', '园区占道堆料'],
  公共服务类: ['广播设备故障', '候车亭破损', '健身器材损坏'],
  基础设施类: ['道路破损', '供水压力不足', '路灯损坏', '排水涵管堵塞'],
  空间管控类: ['沟渠填埋', '疑似违建', '宅基地越界'],
  农业生产类: ['大棚排水不畅', '灌渠渗漏', '机井故障'],
  人居环境类: ['畜禽粪污', '公厕保洁', '垃圾堆放', '污水外溢'],
  生态保护类: ['岸线垃圾', '河道漂浮物', '露天焚烧'],
} as const

export type GovernanceCategory = keyof typeof governanceCategories

export const defaultGovernanceCategory: GovernanceCategory = '生态保护类'
export const defaultGovernanceSubtype = '岸线垃圾'
export const maxGovernancePhotos = 5
export const recommendedPhotoBytes = 5 * 1024 * 1024
export const fallbackLocation = {
  longitude: 114.749274,
  latitude: 34.856417,
} as const

export function getGovernanceSubtypes(type: GovernanceCategory): readonly string[] {
  return governanceCategories[type]
}

export function isGovernanceCategory(value: string): value is GovernanceCategory {
  return Object.prototype.hasOwnProperty.call(governanceCategories, value)
}

export function extractTownSuggestions(collection: GovernanceFeatureCollection) {
  return [
    ...new Set(
      collection.features
        .map((feature) => feature.properties.town)
        .filter((town): town is string => typeof town === 'string' && Boolean(town.trim()))
        .map((town) => town.trim()),
    ),
  ].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

export type GovernanceFormErrors = Partial<
  Record<
    | 'description'
    | 'images'
    | 'town'
    | 'village'
    | 'location'
    | 'contact'
    | 'phone',
    string
  >
>

export function validateGovernanceRequest(
  input: Omit<CreateGovernanceIssueRequest, 'time'>,
): GovernanceFormErrors {
  const errors: GovernanceFormErrors = {}
  if (!input.description.trim()) errors.description = '请填写问题描述'
  else if (input.description.trim().length > 200)
    errors.description = '问题描述不能超过 200 字'
  if (input.images.length < 1) errors.images = '请至少上传 1 张现场照片'
  else if (input.images.length > maxGovernancePhotos)
    errors.images = `现场照片最多上传 ${maxGovernancePhotos} 张`
  if (!input.town.trim()) errors.town = '请填写所属乡镇'
  if (!input.village.trim()) errors.village = '请填写所属村庄'
  if (
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180 ||
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90
  )
    errors.location = '请先获取有效定位'
  if (!input.contact.trim()) errors.contact = '请填写联系人'
  const phone = input.phone.replace(/[\s-]/g, '')
  if (!phone) errors.phone = '请填写联系电话'
  else if (!/^1[3-9]\d{9}$/.test(phone)) errors.phone = '请输入有效的大陆手机号码'
  return errors
}
