import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GovernanceFeatureCollection } from '@/api/governance'
import {
  defaultGovernanceCategory,
  defaultGovernanceSubtype,
  extractTownSuggestions,
  fallbackLocation,
  getGovernanceSubtypes,
  governanceCategories,
  validateGovernanceRequest,
} from '@/features/governance-mobile/model'

const collection = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      'public/data/governance/governance-issues.geojson',
    ),
    'utf8',
  ),
) as GovernanceFeatureCollection

describe('移动端治理问题表单模型', () => {
  it('提供 8 个一级分类、25 个子类型及指定默认值', () => {
    expect(Object.keys(governanceCategories)).toHaveLength(8)
    expect(
      Object.values(governanceCategories).reduce(
        (total, subtypes) => total + subtypes.length,
        0,
      ),
    ).toBe(25)
    expect(defaultGovernanceCategory).toBe('生态保护类')
    expect(defaultGovernanceSubtype).toBe('岸线垃圾')
    expect(getGovernanceSubtypes('基础设施类')).toEqual([
      '道路破损',
      '供水压力不足',
      '路灯损坏',
      '排水涵管堵塞',
    ])
  })

  it('从现有 FeatureCollection 动态提取并去重乡镇建议', () => {
    const towns = extractTownSuggestions(collection)
    expect(towns).toHaveLength(16)
    expect(towns).toContain('三义寨乡')
    expect(towns).toContain('兰阳街道')
  })

  it('校验必填项、坐标、手机号及照片数量', () => {
    const invalid = validateGovernanceRequest({
      type: '生态保护类',
      subtype: '岸线垃圾',
      description: '',
      images: [],
      town: '',
      village: '',
      longitude: Number.NaN,
      latitude: Number.NaN,
      contact: '',
      phone: '123',
    })
    expect(invalid).toMatchObject({
      description: expect.any(String),
      images: expect.any(String),
      town: expect.any(String),
      village: expect.any(String),
      location: expect.any(String),
      contact: expect.any(String),
      phone: expect.any(String),
    })

    expect(
      validateGovernanceRequest({
        type: '生态保护类',
        subtype: '岸线垃圾',
        description: '河道附近存在垃圾，需要及时处理。',
        images: [{ url: 'mock://one' }],
        town: '三义寨乡',
        village: '葡萄架村',
        ...fallbackLocation,
        contact: '张三',
        phone: '138 1000 1096',
      }),
    ).toEqual({})
  })
})
