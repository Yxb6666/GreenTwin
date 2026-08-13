import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import type { GovernanceIssue } from '@/features/governance/data'
import {
  createGovernanceShapefileArchive,
  createUtf8Dbf,
  governanceShapefileFields,
} from '@/features/governance/shapefile'

const issue: GovernanceIssue = {
  id: 'GT-001',
  type: '人居环境',
  subtype: '垃圾清运',
  description: '村口垃圾需要及时清运',
  contact: '张三',
  phone: '13800000000',
  townCode: '410225001',
  town: '兰阳街道',
  villageCode: '410225001001',
  village: '城中村',
  address: '村口道路北侧',
  time: '2026-08-13 09:30',
  urgency: '高',
  status: '待审核',
  channel: '随手拍',
  dataClass: '场景模拟',
  longitude: 114.81234567,
  latitude: 34.81234567,
}

describe('乡村治理 Shapefile 导出', () => {
  it('生成 GIS 所需的完整文件组', async () => {
    const archive = await createGovernanceShapefileArchive([issue])
    const zip = await JSZip.loadAsync(archive)
    expect(Object.keys(zip.files).sort()).toEqual([
      'governance_issues.cpg',
      'governance_issues.dbf',
      'governance_issues.prj',
      'governance_issues.shp',
      'governance_issues.shx',
    ])
    expect(await zip.file('governance_issues.cpg')!.async('string')).toBe(
      'UTF-8',
    )
    expect(await zip.file('governance_issues.prj')!.async('string')).toContain(
      'WGS_1984',
    )
    expect(
      (await zip.file('governance_issues.shp')!.async('uint8array')).length,
    ).toBeGreaterThan(100)
  })

  it('DBF 保留中文 UTF-8 字节并使用兼容字段名', () => {
    const dbf = createUtf8Dbf(
      [{ TOWN: issue.town }],
      [governanceShapefileFields.find((field) => field.name === 'TOWN')!],
    )
    expect(new TextDecoder().decode(dbf)).toContain(issue.town)
    expect(
      governanceShapefileFields.every((field) => field.name.length <= 10),
    ).toBe(true)
  })

  it('没有可导出要素时给出明确错误', async () => {
    await expect(createGovernanceShapefileArchive([])).rejects.toThrow(
      '当前没有可导出的治理问题要素',
    )
  })
})
