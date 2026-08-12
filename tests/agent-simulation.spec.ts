import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  extractAgentCode,
  validateAgentRequest,
  validateGeneratedCode,
} from '../server/agent-simulation.mjs'

describe('3D Agent 模拟任务服务', () => {
  it('从 DeepSeek 返回中提取 Blender 代码', () => {
    const code = 'def build_custom(config):\n    pass\n'
    expect(
      extractAgentCode(`\`\`\`json\n{"code": ${JSON.stringify(code)}}\n\`\`\``),
    ).toBe(code.trim())
  })

  it('拒绝不包含 build_custom 的代码', () => {
    expect(() =>
      validateGeneratedCode('print("hello")'),
    ).toThrow('缺少 build_custom 函数')
  })

  it('拒绝包含系统访问的代码', () => {
    const dangerous = [
      'def build_custom(config):\n    import os\n    os.system("calc")',
      'def build_custom(config):\n    import subprocess\n    subprocess.run("ls")',
      'def build_custom(config):\n    open("/tmp/x", "w")',
      'def build_custom(config):\n    eval("1+1")',
    ]
    for (const code of dangerous) {
      expect(() => validateGeneratedCode(code)).toThrow(
        '不允许的系统访问操作',
      )
    }
  })

  it('接受仅使用辅助函数的代码', () => {
    const code = [
      'def build_custom(config):',
      '    stone = material("Stone", (0.5, 0.5, 0.5, 1))',
      '    add_box("Base", (0, 0, 1), (6, 6, 2), stone, 1)',
    ].join('\n')
    expect(validateGeneratedCode(code)).toMatchObject({
      primitiveCalls: 1,
    })
  })

  it('校验 Agent 请求并规范化落点', () => {
    const result = validateAgentRequest({
      prompt: '建一座两层带飞檐和柱廊的古风楼阁，要精致',
      placement: {
        longitude: 114.97012345,
        latitude: 34.95112345,
        height: 5,
        heading: 10,
        label: '测试点',
      },
    }) as {
      building: Record<string, unknown>
      placement: Record<string, unknown>
    }
    expect(result.building.buildingType).toBe('tower')
    expect(result.building.floors).toBe(3)
    expect(result.building.roof).toBe('hipped')
    expect(result.building.ornamentLevel).toBe(3)
    expect(result.placement).toMatchObject({
      longitude: 114.970123,
      latitude: 34.951123,
      accuracy: 'user-picked',
    })
  })

  it('拒绝过短或过长的提示词', () => {
    expect(() => validateAgentRequest({ prompt: '建' })).toThrow(
      '提示词长度',
    )
    expect(() =>
      validateAgentRequest({ prompt: '建'.repeat(601) }),
    ).toThrow('提示词长度')
  })

  it('Blender 执行器把辅助函数注入与生成代码相同的命名空间', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'scripts/blender/agent_runner.py'),
      'utf8',
    )
    expect(source).toContain(
      'exec(compile(code, "<agent>", "exec"), safe_globals)',
    )
    expect(source).toContain('"material": material')
    expect(source).toContain('"add_box": add_box')
  })

  it('Blender 材质函数兼容 RGB 三元组与 0-255 颜色', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'scripts/blender/agent_runner.py'),
      'utf8',
    )
    expect(source).toContain('def _normalize_color(color):')
    expect(source).toContain('values.append(1.0)')
    expect(source).toContain('item / 255.0')
  })
})
