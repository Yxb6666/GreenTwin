import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const moduleViews = [
  ['master/MasterView.vue', '三生空间'],
  ['governance/GovernanceView.vue', '三生治理'],
  ['twin/TwinView.vue', '三生模拟'],
  ['sansheng/SanshengView.vue', '三生评估'],
] as const

describe('模块页面标题', () => {
  it.each(moduleViews)('%s 使用与顶部导航一致的标题', async (viewPath, title) => {
    const source = await readFile(resolve(process.cwd(), 'src/features', viewPath), 'utf8')

    expect(source).toContain(`<ScreenHeader`)
    expect(source).toContain(`title="${title}"`)
  })
})
