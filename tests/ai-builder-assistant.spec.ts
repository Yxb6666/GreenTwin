import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AiBuilderAssistant from '@/features/twin/AiBuilderAssistant.vue'

const defaultProps = {
  open: false,
  pointReady: false,
  pointLabel: '',
  picking: false,
  isBuilding: false,
  buildProgress: 0,
  buildMessage: '',
  modelReady: false,
  modelScale: 1,
  modelHeading: 0,
  buildSummary: '',
}

describe('AI 建造助手', () => {
  it('未选点时展示任务步骤和明确的地图选点入口', async () => {
    const wrapper = mount(AiBuilderAssistant, {
      props: { ...defaultProps, embedded: true },
    })

    expect(wrapper.find('.builder-panel.is-embedded').exists()).toBe(true)
    expect(wrapper.find('.builder-launcher').exists()).toBe(false)
    expect(wrapper.find('[aria-label="关闭 AI 建造助手"]').exists()).toBe(false)
    expect(wrapper.find('.builder-resize-handle').exists()).toBe(false)
    expect(wrapper.findAll('.builder-steps li')).toHaveLength(3)
    expect(wrapper.find('.builder-steps [aria-current="step"]').text()).toContain(
      '选择位置',
    )
    expect(wrapper.find('.builder-empty').text()).toContain('先确定模型建造位置')
    expect(wrapper.find('.builder-empty button').text()).toBe(
      '在地图中选择建造位置',
    )
    expect(wrapper.find('.builder-composer').exists()).toBe(false)

    await wrapper.find('.builder-empty button').trigger('click')
    expect(wrapper.emitted('toggle-pick')).toHaveLength(1)
  })

  it('选点后可用示例填充描述并发送生成指令', async () => {
    const wrapper = mount(AiBuilderAssistant, {
      props: {
        ...defaultProps,
        embedded: true,
        pointReady: true,
        pointLabel: '徐桥村东侧空地',
      },
    })

    expect(wrapper.find('.builder-location').exists()).toBe(false)
    expect(wrapper.find('.builder-mark').exists()).toBe(false)
    expect(wrapper.findAll('.builder-suggestions button')).toHaveLength(3)
    expect(wrapper.find('.builder-composer').exists()).toBe(true)

    const suggestion = wrapper.find('.builder-suggestions button')
    await suggestion.trigger('click')
    expect(wrapper.find('textarea').element.value).toBe(suggestion.text())

    await wrapper.find('.builder-composer > button').trigger('click')
    expect(wrapper.emitted('build-agent')).toEqual([[suggestion.text()]])
    expect(wrapper.findAll('.builder-message')).toHaveLength(2)
    expect(wrapper.find('.builder-messages').text()).toContain('已收到建造指令')
  })

  it('选点过程中提供显式取消操作', async () => {
    const wrapper = mount(AiBuilderAssistant, {
      props: { ...defaultProps, embedded: true, picking: true },
    })

    expect(wrapper.find('.builder-empty').text()).toContain(
      '请在地图中选择建造位置',
    )
    expect(wrapper.find('.builder-empty').text()).toContain('地图会即时标记落点')
    expect(wrapper.find('.builder-empty button').text()).toBe('取消选点')

    await wrapper.find('.builder-empty button').trigger('click')
    expect(wrapper.emitted('cancel-pick')).toHaveLength(1)
  })
})
