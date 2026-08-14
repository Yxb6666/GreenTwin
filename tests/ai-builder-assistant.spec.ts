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
  it('嵌入右栏时始终显示内容并移除浮动交互外壳', async () => {
    const wrapper = mount(AiBuilderAssistant, {
      props: { ...defaultProps, embedded: true },
    })

    expect(wrapper.find('.builder-panel.is-embedded').exists()).toBe(true)
    expect(wrapper.find('.builder-launcher').exists()).toBe(false)
    expect(wrapper.find('[aria-label="关闭 AI 建造助手"]').exists()).toBe(false)
    expect(wrapper.find('.builder-resize-handle').exists()).toBe(false)
    expect(wrapper.text()).toContain('AI 建造助手')
    expect(wrapper.text()).not.toContain('模板生成')
    expect(wrapper.findAll('.builder-mode-tabs button')).toHaveLength(1)
    expect(wrapper.find('.builder-mode-tabs button').text()).toBe('3D Agent')
    expect(wrapper.find('.builder-style-chips').exists()).toBe(false)

    await wrapper.find('.builder-point button').trigger('click')
    expect(wrapper.emitted('toggle-pick')).toHaveLength(1)
  })
})
