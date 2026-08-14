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
  visibilityActive?: boolean
  visibilityPointCount?: number
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
  'start-visibility': []
  'cancel-visibility': []
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

function toggleVisibilityAnalysis() {
  analysisMenuOpen.value = false
  if (props.visibilityActive) emit('cancel-visibility')
  else emit('start-visibility')
}

function updateShadowTime(event: Event) {
  emit('update-shadow-time', (event.target as HTMLInputElement).value)
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
        :class="{
          active: analysisMenuOpen || shadowActive || visibilityActive,
        }"
        :aria-expanded="analysisMenuOpen"
        aria-label="空间分析"
        title="阴影与通视分析"
        @click="toggleAnalysisMenu"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 2v2m0 8v2M2 8h2m8 0h2m2 9-3-3 3-3m-3 3h8" />
        </svg>
        <span>空间分析</span>
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
      <div v-if="analysisMenuOpen" class="scene-toolbox__panel analysis-panel">
        <header><span>ANALYSIS</span><strong>阴影与通视分析</strong></header>
        <section>
          <div class="analysis-panel__title">
            <span><strong>阴影分析</strong><small>按指定时间模拟建筑投影</small></span>
            <button
              type="button"
              :class="{ active: shadowActive }"
              @click="emit('toggle-shadow')"
            >
              {{ shadowActive ? '关闭' : '启用' }}
            </button>
          </div>
          <label>
            <span>分析时间</span>
            <input
              type="datetime-local"
              :value="shadowTime"
              @change="updateShadowTime"
            />
          </label>
        </section>
        <section>
          <div class="analysis-panel__title">
            <span><strong>通视分析</strong><small>依次选取观察点与目标点</small></span>
            <button
              type="button"
              :class="{ active: visibilityActive }"
              @click="toggleVisibilityAnalysis"
            >
              {{ visibilityActive ? '取消' : '开始' }}
            </button>
          </div>
          <p>
            {{
              visibilityActive
                ? visibilityPointCount
                  ? '观察点已设置，请点击目标点'
                  : '请在场景中点击观察点'
                : '绿色表示可见，红色表示视线受阻'
            }}
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
  width: 230px;
}

.analysis-panel > section {
  display: grid;
  padding: 10px 11px;
  gap: 8px;
}

.analysis-panel > section + section {
  border-top: 1px solid rgba(122, 203, 190, 0.1);
}

.analysis-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.analysis-panel__title > span {
  display: grid;
  flex: 1;
  gap: 2px;
}

.analysis-panel__title strong {
  font-size: 9px;
}

.analysis-panel__title small,
.analysis-panel label > span,
.analysis-panel p {
  color: var(--text-soft);
  font-size: 8px;
}

.analysis-panel__title button {
  min-width: 48px;
  min-height: 25px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.22);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.03);
  font-size: 8px;
  cursor: pointer;
}

.analysis-panel__title button:hover,
.analysis-panel__title button.active {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.52);
  background: rgba(61, 214, 196, 0.1);
}

.analysis-panel label {
  display: grid;
  gap: 4px;
}

.analysis-panel input {
  width: 100%;
  min-height: 28px;
  padding: 0 6px;
  color: var(--text);
  color-scheme: dark;
  border: 1px solid rgba(122, 203, 190, 0.18);
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.18);
  font: 8px var(--font-data);
}

.analysis-panel p {
  margin: 0;
  line-height: 1.5;
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
