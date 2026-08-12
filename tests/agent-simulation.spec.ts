import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  extractAgentCode,
  generateAgentScript,
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

  it('能从带说明文字的输出中提取 JSON 代码', () => {
    const code = 'def build_custom(config):\n    pass\n'
    expect(
      extractAgentCode(
        `好的，以下是代码：\n\`\`\`json\n{"code": ${JSON.stringify(code)}}\n\`\`\`\n请查收。`,
      ),
    ).toBe(code.trim())
  })

  it('模型直接返回 Python 源码时也能接受', () => {
    const source = 'def build_custom(config):\n    add_box("X", (0, 0, 0), (1, 1, 1), material("S", (1, 1, 1, 1)))'
    expect(extractAgentCode(source)).toBe(source)
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

  it('首次解析失败时自动重试一次', async () => {
    const code = 'def build_custom(config):\n    pass\n'
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: '抱歉，我无法生成 JSON，直接给出代码吧' } },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ code }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )

    const result = await generateAgentScript(
      '建一座三层古风楼阁',
      { buildingType: 'tower' },
      { apiKey: 'test-key', fetchImpl },
      5000,
    )

    expect(result).toBe(code.trim())
    expect(fetchImpl).toHaveBeenCalledTimes(2)
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

  it('Blender 沙箱只允许白名单模块导入', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'scripts/blender/agent_runner.py'),
      'utf8',
    )
    expect(source).toContain('ALLOWED_IMPORT_MODULES = {"math", "mathutils", "bpy"}')
    expect(source).toContain('"__import__": safe_import')
    expect(source).toContain('不允许导入模块: %s')
  })

  it('Blender 辅助函数容忍生成代码的多余参数', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'scripts/blender/agent_runner.py'),
      'utf8',
    )
    const helpers = [
      'material',
      'add_box',
      'add_beveled_box',
      'add_cylinder',
      'add_beam_between',
      'add_roof_mesh',
    ]
    for (const helper of helpers) {
      expect(source).toMatch(new RegExp(`def ${helper}\\(`))
    }
    expect(
      (source.match(/\*args, \*\*kwargs/g) || []).length,
    ).toBeGreaterThanOrEqual(helpers.length)
  })
})
