<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

export type SceneMeasureType = 'distance' | 'area'

const props = defineProps<{
  measuring: SceneMeasureType | null
  layers: Array<{ key: string; label: string; visible: boolean }>
  feedback: string
  weatherActive?: boolean
  shadowActive?: boolean
  shadowTime?: string
}>()

const emit = defineEmits<{
  clear: []
  measure: [type: SceneMeasureType]
  'end-measure': []
  refresh: []
  export: []
  'zoom-in': []
  'zoom-out': []
  locate: []
  'update-layer': [key: string, visible: boolean]
  'toggle-weather': []
  'toggle-shadow': []
  'update-shadow-time': [value: string]
}>()

const measurementMenuOpen = ref(false)
const layerMenuOpen = ref(false)
const analysisMenuOpen = ref(false)

function toggleMeasurementMenu() {
  if (props.measuring) {
    emit('end-measure')
    return
  }
  measurementMenuOpen.value = !measurementMenuOpen.value
  layerMenuOpen.value = false
  analysisMenuOpen.value = false
  if (props.weatherActive) emit('toggle-weather')
}

function selectMeasure(type: SceneMeasureType) {
  measurementMenuOpen.value = false
  emit('measure', type)
}

function toggleLayerMenu() {
  layerMenuOpen.value = !layerMenuOpen.value
  measurementMenuOpen.value = false
  analysisMenuOpen.value = false
  if (props.weatherActive) emit('toggle-weather')
}

function toggleWeather() {
  measurementMenuOpen.value = false
  layerMenuOpen.value = false
  analysisMenuOpen.value = false
  emit('toggle-weather')
}

function toggleAnalysisMenu() {
  analysisMenuOpen.value = !analysisMenuOpen.value
  measurementMenuOpen.value = false
  layerMenuOpen.value = false
  if (props.weatherActive) emit('toggle-weather')
}

function updateShadowTime(event: Event) {
  emit('update-shadow-time', (event.target as HTMLInputElement).value)
}

function setShadowHour(hour: number) {
  const date = props.shadowTime?.slice(0, 10) || new Date().toISOString().slice(0, 10)
  emit('update-shadow-time', `${date}T${String(hour).padStart(2, '0')}:00`)
}

function updateLayer(key: string, event: Event) {
  const input = event.target as HTMLInputElement
  emit('update-layer', key, input.checked)
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  measurementMenuOpen.value = false
  layerMenuOpen.value = false
  analysisMenuOpen.value = false
  if (props.weatherActive) emit('toggle-weather')
}

window.addEventListener('keydown', onKeyDown)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="scene-toolbox" aria-label="三维场景常用工具">
    <div class="scene-toolbox__rail" role="toolbar" aria-label="三维场景操作">
      <button
        type="button"
        aria-label="清除标绘与测量结果"
        title="清除标绘与测量结果"
        @click="emit('clear')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
        </svg>
        <span>清除标绘</span>
      </button>
      <button
        type="button"
        :class="{ active: measurementMenuOpen || measuring }"
        :aria-expanded="measurementMenuOpen"
        aria-label="测量工具"
        title="测量工具"
        @click="toggleMeasurementMenu"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4 18 9-14 7 5-9 13H4v-4Zm9-14 2 6m-8 5 3 2m0-7 3 2" />
        </svg>
        <span>{{ measuring ? '结束测量' : '测量工具' }}</span>
      </button>
      <button
        type="button"
        aria-label="刷新场景"
        title="刷新场景"
        @click="emit('refresh')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 7v5h-5M4 17v-5h5m9.2-3A7 7 0 0 0 6.6 7L4 12m16 0-2.6 5a7 7 0 0 1-11.6-1" />
        </svg>
        <span>刷新场景</span>
      </button>
      <button
        type="button"
        aria-label="导出场景图片"
        title="导出场景图片"
        @click="emit('export')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 16v4h14v-4" />
        </svg>
        <span>导出图片</span>
      </button>
      <button
        type="button"
        :class="{ active: layerMenuOpen }"
        :aria-expanded="layerMenuOpen"
        aria-label="场景图层"
        title="场景图层"
        @click="toggleLayerMenu"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 9 5-9 5-9-5 9-5Zm-7 9 7 4 7-4M5 16l7 4 7-4" />
        </svg>
        <span>场景图层</span>
      </button>
    </div>

    <div
      class="scene-toolbox__rail scene-toolbox__rail--right"
      role="toolbar"
      aria-label="场景环境分析"
    >
      <button
        type="button"
        :class="{ active: analysisMenuOpen || shadowActive }"
        :aria-expanded="analysisMenuOpen"
        aria-label="空间分析"
        title="日照阴影分析"
        @click="toggleAnalysisMenu"
      >
        <svg
          class="scene-toolbox__sunlight-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="2.5" />
          <path
            d="M7 2v1.5M7 10.5V12M2 7h1.5M10.5 7H12M3.5 3.5l1 1m5 5 1 1m0-7-1 1m-5 5-1 1"
          />
          <path d="m12 14 4-2 4 2-4 2-4-2Zm0 0v4l4 2 4-2v-4m-4 2v4" />
        </svg>
        <span>空间分析</span>
      </button>
      <button
        type="button"
        :class="{ active: weatherActive }"
        :aria-expanded="weatherActive"
        aria-label="天气模拟"
        title="天气模拟"
        @click="toggleWeather"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 17h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.4 8 4.5 4.5 0 0 0 7 17Zm2 3-1 2m5-2-1 2m5-2-1 2" />
        </svg>
        <span>{{ weatherActive ? '收起天气' : '天气模拟' }}</span>
      </button>
    </div>

    <Transition name="tool-panel">
      <div v-if="measurementMenuOpen" class="scene-toolbox__panel measure-panel">
        <header><span>MEASURE</span><strong>选择测量方式</strong></header>
        <button type="button" @click="selectMeasure('distance')">
          <i>↗</i><span><strong>空间距离</strong><small>沿路径累计长度</small></span>
        </button>
        <button type="button" @click="selectMeasure('area')">
          <i>⌑</i><span><strong>地表面积</strong><small>闭合范围估算</small></span>
        </button>
      </div>
    </Transition>

    <Transition name="tool-panel">
      <div
        v-if="analysisMenuOpen"
        class="scene-toolbox__panel scene-toolbox__panel--right analysis-panel"
      >
        <header>
          <span>SUNLIGHT</span>
          <strong>日照阴影分析</strong>
          <small>查看指定时刻的建筑投影与遮挡关系</small>
        </header>
        <section class="shadow-analysis-card">
          <div class="shadow-analysis-card__status">
            <i :class="{ active: shadowActive }" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3.5" />
                <path d="M12 2.5V5m0 14v2.5M2.5 12H5m14 0h2.5M5.3 5.3l1.8 1.8m9.8 9.8 1.8 1.8m0-13.4-1.8 1.8m-9.8 9.8-1.8 1.8" />
              </svg>
            </i>
            <span>
              <strong>{{ shadowActive ? '阴影效果已显示' : '阴影效果未启用' }}</strong>
              <small>{{ shadowActive ? '调整时间可实时更新场景' : '开启后按当前时间模拟光照' }}</small>
            </span>
            <button
              type="button"
              class="shadow-toggle"
              :class="{ active: shadowActive }"
              :aria-pressed="shadowActive"
              @click="emit('toggle-shadow')"
            >
              {{ shadowActive ? '关闭分析' : '开启分析' }}
            </button>
          </div>
          <label class="shadow-time-field">
            <span>分析日期与时间</span>
            <input
              type="datetime-local"
              :value="shadowTime"
              @change="updateShadowTime"
            />
          </label>
          <div class="shadow-presets" aria-label="常用日照时段">
            <button
              v-for="hour in [9, 12, 15, 18]"
              :key="hour"
              type="button"
              :class="{ active: shadowTime?.slice(11, 13) === String(hour).padStart(2, '0') }"
              @click="setShadowHour(hour)"
            >
              {{ String(hour).padStart(2, '0') }}:00
            </button>
          </div>
          <p class="shadow-analysis-card__tip">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 7v4m0-6v.01" />
            </svg>
            <span>阴影结果取决于场景中已加载的建筑与模型数据。</span>
          </p>
        </section>
      </div>
    </Transition>

    <Transition name="tool-panel">
      <div v-if="layerMenuOpen" class="scene-toolbox__panel layer-panel">
        <header><span>LAYERS</span><strong>场景要素图层</strong></header>
        <label v-for="layer in layers" :key="layer.key">
          <input
            type="checkbox"
            :checked="layer.visible"
            @change="updateLayer(layer.key, $event)"
          />
          <span>{{ layer.label }}</span>
        </label>
      </div>
    </Transition>

    <div class="scene-toolbox__zoom" role="group" aria-label="场景缩放">
      <button type="button" aria-label="放大场景" title="放大" @click="emit('zoom-in')">
        ＋
      </button>
      <button type="button" aria-label="缩小场景" title="缩小" @click="emit('zoom-out')">
        −
      </button>
      <button type="button" aria-label="定位到当前落点" title="定位到当前落点" @click="emit('locate')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6" />
        </svg>
      </button>
    </div>

    <Transition name="tool-feedback">
      <div v-if="feedback" class="scene-toolbox__feedback" role="status">
        {{ feedback }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scene-toolbox {
  position: absolute;
  z-index: 120;
  inset: 0;
  pointer-events: none;
}

.scene-toolbox button {
  color: inherit;
  font: inherit;
}

.scene-toolbox__rail {
  position: absolute;
  top: 12px;
  left: 12px;
  display: grid;
  gap: 6px;
  pointer-events: auto;
}

.scene-toolbox__rail.scene-toolbox__rail--right {
  top: 144px;
  right: 12px;
  left: auto;
  width: 38px;
}

.scene-toolbox__rail button {
  position: relative;
  display: grid;
  width: 38px;
  height: 38px;
  padding: 0;
  place-items: center;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.25);
  border-radius: 7px;
  background: rgba(5, 16, 17, 0.86);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
  cursor: pointer;
  backdrop-filter: blur(8px);
}

.scene-toolbox__rail button:hover,
.scene-toolbox__rail button.active {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.55);
  background: rgba(61, 214, 196, 0.12);
}

.scene-toolbox__rail svg,
.scene-toolbox__zoom svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.scene-toolbox__rail span {
  position: absolute;
  left: 44px;
  display: none;
  padding: 4px 8px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.18);
  border-radius: 5px;
  background: rgba(5, 16, 17, 0.9);
  font-size: 8px;
  white-space: nowrap;
}

.scene-toolbox__rail--right span {
  right: 44px;
  left: auto;
}

.scene-toolbox__rail button:hover span {
  display: block;
}

.scene-toolbox__panel {
  position: absolute;
  top: 12px;
  left: 56px;
  overflow: hidden;
  width: 178px;
  pointer-events: auto;
  border: 1px solid rgba(61, 214, 196, 0.32);
  border-radius: 9px;
  background: linear-gradient(
    160deg,
    rgba(14, 35, 34, 0.97),
    rgba(5, 18, 19, 0.98)
  );
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(12px);
}

.scene-toolbox__panel--right {
  top: 144px;
  right: 56px;
  left: auto;
}

.scene-toolbox__panel header {
  display: grid;
  padding: 9px 11px 7px;
  gap: 2px;
  border-bottom: 1px solid rgba(122, 203, 190, 0.12);
}

.scene-toolbox__panel header span {
  color: var(--cyan);
  font: 7px var(--font-data);
  letter-spacing: 0.12em;
}

.scene-toolbox__panel header strong {
  font-size: 10px;
}

.measure-panel > button {
  display: grid;
  align-items: center;
  width: 100%;
  padding: 9px 11px;
  gap: 9px;
  color: var(--text);
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
  grid-template-columns: 26px 1fr;
}

.measure-panel > button + button {
  border-top: 1px solid rgba(122, 203, 190, 0.08);
}

.measure-panel > button:hover {
  background: rgba(61, 214, 196, 0.08);
}

.measure-panel > button > i {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.32);
  border-radius: 6px;
  font: normal 13px var(--font-data);
}

.measure-panel > button span {
  display: grid;
  gap: 2px;
}

.measure-panel > button strong {
  font-size: 9px;
}

.measure-panel > button small {
  color: var(--text-soft);
  font-size: 8px;
}

.analysis-panel {
  width: 248px;
}

.analysis-panel header small {
  color: var(--text-soft);
  font-size: 8px;
  line-height: 1.4;
}

.shadow-analysis-card {
  display: grid;
  padding: 11px;
  gap: 10px;
}

.shadow-analysis-card__status {
  display: grid;
  align-items: center;
  padding: 8px;
  gap: 7px;
  border: 1px solid rgba(122, 203, 190, 0.12);
  border-radius: 8px;
  background: linear-gradient(
    135deg,
    rgba(61, 214, 196, 0.06),
    rgba(0, 0, 0, 0.08)
  );
  grid-template-columns: 30px minmax(0, 1fr) auto;
}

.shadow-analysis-card__status > i {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.18);
  border-radius: 8px;
  background: rgba(61, 214, 196, 0.045);
}

.shadow-analysis-card__status > i svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.shadow-analysis-card__status > i.active {
  color: var(--amber);
  border-color: rgba(240, 184, 92, 0.4);
  background: rgba(240, 184, 92, 0.09);
  box-shadow: 0 0 14px rgba(240, 184, 92, 0.12);
}

.shadow-analysis-card__status > span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.shadow-analysis-card__status strong {
  color: var(--text);
  font-size: 9px;
  line-height: 1.25;
}

.shadow-analysis-card__status small {
  line-height: 1.35;
}

.shadow-analysis-card__status small,
.shadow-time-field > span,
.shadow-analysis-card__tip {
  color: var(--text-soft);
  font-size: 8px;
}

.shadow-toggle {
  min-width: 62px;
  min-height: 30px;
  padding: 0 9px;
  color: #06211e;
  border: 1px solid rgba(89, 234, 216, 0.72);
  border-radius: 6px;
  background: linear-gradient(135deg, #53ddcc, #2fc4b3);
  box-shadow: 0 4px 12px rgba(23, 177, 160, 0.18);
  font-size: 8px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    background 140ms ease,
    box-shadow 140ms ease;
}

.shadow-toggle:hover {
  border-color: rgba(121, 255, 239, 0.9);
  box-shadow: 0 5px 15px rgba(23, 177, 160, 0.26);
  transform: translateY(-1px);
}

.shadow-toggle.active {
  color: var(--amber);
  border-color: rgba(240, 184, 92, 0.42);
  background: rgba(240, 184, 92, 0.08);
  box-shadow: none;
}

.shadow-time-field {
  display: grid;
  padding-top: 9px;
  gap: 5px;
  border-top: 1px solid rgba(122, 203, 190, 0.1);
}

.shadow-time-field input {
  width: 100%;
  min-height: 31px;
  padding: 0 8px;
  color: var(--text);
  color-scheme: dark;
  border: 1px solid rgba(122, 203, 190, 0.18);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.18);
  font: 8px var(--font-data);
}

.shadow-time-field input:focus {
  border-color: rgba(61, 214, 196, 0.5);
  outline: 0;
  box-shadow: 0 0 0 2px rgba(61, 214, 196, 0.06);
}

.shadow-presets {
  display: grid;
  gap: 5px;
  grid-template-columns: repeat(4, 1fr);
}

.shadow-presets button {
  min-height: 25px;
  padding: 0;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.14);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.02);
  font: 8px var(--font-data);
  cursor: pointer;
}

.shadow-presets button:hover,
.shadow-presets button.active {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.42);
  background: rgba(61, 214, 196, 0.08);
}

.shadow-analysis-card__tip {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding: 8px 1px 0;
  gap: 6px;
  border-top: 1px solid rgba(122, 203, 190, 0.09);
  line-height: 1.5;
}

.shadow-analysis-card__tip svg {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  margin-top: 1px;
  fill: none;
  stroke: rgba(90, 221, 204, 0.72);
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.layer-panel {
  display: grid;
  padding: 7px 9px 9px;
  gap: 5px;
}

.layer-panel label {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 7px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.1);
  border-radius: 6px;
  font-size: 9px;
  cursor: pointer;
}

.layer-panel input {
  accent-color: var(--cyan);
}

.layer-panel label:has(input:checked) {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.36);
  background: rgba(61, 214, 196, 0.06);
}

.scene-toolbox__zoom {
  position: absolute;
  bottom: 16px;
  left: 12px;
  display: grid;
  overflow: hidden;
  gap: 1px;
  pointer-events: auto;
  border: 1px solid rgba(122, 203, 190, 0.25);
  border-radius: 7px;
  background: rgba(5, 16, 17, 0.86);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px);
}

.scene-toolbox__zoom button {
  display: grid;
  width: 34px;
  height: 32px;
  padding: 0;
  place-items: center;
  color: var(--text-soft);
  border: 0;
  background: transparent;
  font-size: 15px;
  cursor: pointer;
}

.scene-toolbox__zoom button + button {
  border-top: 1px solid rgba(122, 203, 190, 0.12);
}

.scene-toolbox__zoom button:hover {
  color: var(--cyan);
  background: rgba(61, 214, 196, 0.1);
}

.scene-toolbox__feedback {
  position: absolute;
  bottom: 16px;
  left: 56px;
  padding: 7px 11px;
  color: var(--text-soft);
  border: 1px solid rgba(61, 214, 196, 0.26);
  border-radius: 6px;
  background: rgba(5, 16, 17, 0.9);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  font-size: 9px;
  pointer-events: none;
}

.tool-panel-enter-active,
.tool-panel-leave-active,
.tool-feedback-enter-active,
.tool-feedback-leave-active {
  transition: 150ms ease;
}

.tool-panel-enter-from,
.tool-panel-leave-to,
.tool-feedback-enter-from,
.tool-feedback-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 1440px) {
  .scene-toolbox__rail {
    top: 10px;
    left: 10px;
  }
  .scene-toolbox__zoom {
    bottom: 14px;
    left: 10px;
  }
}
</style>
