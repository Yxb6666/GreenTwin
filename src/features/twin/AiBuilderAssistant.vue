<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useDraggablePanel } from '@/shared/composables/useDraggablePanel'

export type AiBuilderStyle =
  | 'auto'
  | 'traditional-chinese'
  | 'modern'
  | 'rural'

interface BuilderMessage {
  id: number
  role: 'assistant' | 'user'
  content: string
  progress?: number
}

const props = defineProps<{
  open: boolean
  pointReady: boolean
  pointLabel: string
  picking: boolean
  isBuilding: boolean
  buildProgress: number
  buildMessage: string
  modelReady: boolean
  modelScale: number
  modelHeading: number
  buildSummary: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'toggle-pick': []
  'cancel-pick': []
  build: [prompt: string, style: AiBuilderStyle]
  'build-agent': [prompt: string]
  'update-scale': [value: number]
  'update-heading': [value: number]
  'remove-model': []
  'focus-model': []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})
const {
  isDragging,
  isLauncherDragging,
  isResizing,
  launcherRef,
  launcherStyle,
  onHeaderPointerDown,
  onHeaderPointerEnd,
  onHeaderPointerMove,
  onLauncherClick,
  onLauncherPointerCancel,
  onLauncherPointerDown,
  onLauncherPointerEnd,
  onLauncherPointerMove,
  onResizePointerEnd,
  onResizePointerMove,
  panelRef,
  panelStyle,
  resetPosition,
  resizeDirections,
  startResize,
} = useDraggablePanel(isOpen, { storagePrefix: 'greentwin.ai-builder' })

const draft = ref('')
const style = ref<AiBuilderStyle>('auto')
const mode = ref<'template' | 'agent'>('template')
const lastMode = ref<'template' | 'agent'>('template')
const messageId = ref(1)
const messageList = ref<HTMLElement | null>(null)
const statusMessageId = ref<number | null>(null)
const messages = ref<BuilderMessage[]>([
  {
    id: messageId.value++,
    role: 'assistant',
    content:
      '你好，我是 AI 建造助手。先在地图上确定建造位置，再输入提示词，我会调用本机 Blender 生成模型，并支持选中、拖拽、缩放和旋转。',
  },
])

const styleOptions: Array<{ value: AiBuilderStyle; label: string }> = [
  { value: 'auto', label: '自动识别' },
  { value: 'traditional-chinese', label: '古风' },
  { value: 'modern', label: '现代' },
  { value: 'rural', label: '乡村' },
]

const canSend = computed(
  () => props.pointReady && !props.isBuilding && draft.value.trim().length > 0,
)

async function scrollToLatest() {
  await nextTick()
  messageList.value?.scrollTo({
    top: messageList.value.scrollHeight,
    behavior: 'smooth',
  })
}

function send() {
  const content = draft.value.trim()
  if (!canSend.value || !content) return
  lastMode.value = mode.value
  messages.value.push({ id: messageId.value++, role: 'user', content })
  statusMessageId.value = messageId.value++
  messages.value.push({
    id: statusMessageId.value,
    role: 'assistant',
    content: `已收到建造指令，正在 ${props.pointLabel} 准备 Blender 建模任务…`,
  })
  draft.value = ''
  if (mode.value === 'agent') emit('build-agent', content)
  else emit('build', content, style.value)
  void scrollToLatest()
}

function selectMode(value: 'template' | 'agent') {
  if (props.isBuilding) return
  mode.value = value
  if (value === 'agent') {
    messages.value.push({
      id: messageId.value++,
      role: 'assistant',
      content:
        '已切换到 3D Agent 模式：我会把提示词交给 DeepSeek 生成 Blender 脚本，直接构建更贴近描述的模型。',
    })
  }
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  send()
}

watch(
  () => props.isBuilding,
  (building) => {
    if (!building || statusMessageId.value !== null) return
    statusMessageId.value = messageId.value++
    messages.value.push({
      id: statusMessageId.value,
      role: 'assistant',
      content: `正在 ${props.pointLabel} 调用本机 Blender 生成模型…`,
      progress: 0,
    })
  },
)

watch(
  () => props.buildMessage,
  (message) => {
    if (!message || statusMessageId.value === null) return
    const current = messages.value.find(
      (item) => item.id === statusMessageId.value,
    )
    if (current) current.content = message
  },
)

watch(
  () => props.buildProgress,
  (progress) => {
    if (statusMessageId.value === null) return
    const current = messages.value.find(
      (item) => item.id === statusMessageId.value,
    )
    if (current) current.progress = progress
  },
)

watch(
  () => props.modelReady,
  (ready) => {
    if (!ready) return
    messages.value.push({
      id: messageId.value++,
      role: 'assistant',
      content:
        lastMode.value === 'agent'
          ? `3D Agent 已在 ${props.pointLabel} 生成完成。点击模型可选中，在地图上拖拽可移动，使用面板滑杆可缩放与旋转。`
          : `模型已在 ${props.pointLabel} 生成完成（${props.buildSummary || '参数模板'}）。点击模型可选中，在地图上拖拽可移动，使用面板滑杆可缩放与旋转。`,
    })
    statusMessageId.value = null
    void scrollToLatest()
  },
)
</script>

<template>
  <Teleport to="body">
    <button
      ref="launcherRef"
      class="builder-launcher"
      :class="{
        'is-open': isOpen,
        'is-dragging': isLauncherDragging,
      }"
      :style="launcherStyle"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="ai-builder-panel"
      @click="onLauncherClick"
      @lostpointercapture="onLauncherPointerEnd"
      @pointercancel="onLauncherPointerCancel"
      @pointerdown="onLauncherPointerDown"
      @pointermove="onLauncherPointerMove"
      @pointerup="onLauncherPointerEnd"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 6.2L7.8 11.3 12 13.4l4.2-2.1L12 9.2zM8.4 12.6v3.5L12 18.2v-3.5l-3.6-2.1zm7.2 0l-3.6 2.1v3.5l3.6-2.1v-3.5z"
        />
      </svg>
      <span>AI 建造</span>
    </button>

    <Transition name="builder-panel">
      <section
        v-if="isOpen"
        ref="panelRef"
        id="ai-builder-panel"
        class="builder-panel"
        :class="{
          'is-dragging': isDragging,
          'is-resizing': isResizing,
        }"
        :style="panelStyle"
        aria-label="AI 建造助手"
      >
        <header
          class="builder-header"
          title="拖动标题栏可移动，双击恢复默认位置"
          @dblclick="resetPosition"
          @lostpointercapture="onHeaderPointerEnd"
          @pointercancel="onHeaderPointerEnd"
          @pointerdown="onHeaderPointerDown"
          @pointermove="onHeaderPointerMove"
          @pointerup="onHeaderPointerEnd"
        >
          <div class="builder-identity">
            <span class="builder-mark">建</span>
            <div>
              <strong>AI 建造助手</strong>
              <small><i /> 选点 → 提示词 → Blender 建模</small>
            </div>
          </div>
          <button
            type="button"
            data-no-drag
            aria-label="关闭 AI 建造助手"
            @click="isOpen = false"
          >
            ×
          </button>
        </header>

        <section class="builder-point" :class="{ 'is-picking': picking }">
          <span>第一步 · 确定建造位置</span>
          <template v-if="picking">
            <strong>请在地图上点击确定位置</strong>
            <small>点击底图任意点后自动拾取坐标</small>
            <button type="button" data-no-drag @click="emit('cancel-pick')">
              取消选点
            </button>
          </template>
          <template v-else-if="pointReady">
            <strong class="is-selected">已选点 · {{ pointLabel }}</strong>
            <small>选中后可在场景中点击模型进行交互</small>
            <button type="button" data-no-drag @click="emit('toggle-pick')">
              重新选点
            </button>
          </template>
          <template v-else>
            <strong>尚未选择建造位置</strong>
            <small>请先在地图上点击确定模型落点</small>
            <button
              type="button"
              class="is-primary"
              data-no-drag
              @click="emit('toggle-pick')"
            >
              在地图上选点
            </button>
          </template>
        </section>

        <div ref="messageList" class="builder-messages">
          <article
            v-for="message in messages"
            :key="message.id"
            class="builder-message"
            :class="`is-${message.role}`"
          >
            <span class="builder-message__role">{{
              message.role === 'assistant' ? 'AI' : '我'
            }}</span>
            <div class="builder-message__body">
              <p>{{ message.content }}</p>
              <div
                v-if="message.progress !== undefined"
                class="builder-progress"
              >
                <i :style="{ width: `${message.progress}%` }" />
                <span>{{ message.progress }}%</span>
              </div>
            </div>
          </article>
        </div>

        <section v-if="modelReady" class="builder-transform">
          <span>第二步 · 模型交互（选中 / 拖拽 / 缩放 / 旋转）</span>
          <label>
            <span>缩放 <strong>{{ modelScale.toFixed(1) }}×</strong></span>
            <input
              type="range"
              min="0.2"
              max="8"
              step="0.1"
              :value="modelScale"
              @input="
                emit('update-scale', Number(($event.target as HTMLInputElement).value))
              "
            />
          </label>
          <label>
            <span>朝向 <strong>{{ Math.round(modelHeading) }}°</strong></span>
            <input
              type="range"
              min="0"
              max="359"
              step="1"
              :value="modelHeading"
              @input="
                emit('update-heading', Number(($event.target as HTMLInputElement).value))
              "
            />
          </label>
          <div class="builder-transform-actions">
            <button type="button" data-no-drag @click="emit('focus-model')">
              聚焦模型
            </button>
            <button
              type="button"
              class="is-danger"
              data-no-drag
              @click="emit('remove-model')"
            >
              移除模型
            </button>
          </div>
        </section>

        <section class="builder-composer">
          <div class="builder-mode-tabs">
            <button
              type="button"
              data-no-drag
              :class="{ active: mode === 'template' }"
              @click="selectMode('template')"
            >
              模板生成
            </button>
            <button
              type="button"
              data-no-drag
              :class="{ active: mode === 'agent' }"
              @click="selectMode('agent')"
            >
              3D Agent
            </button>
          </div>
          <div v-if="mode === 'template'" class="builder-style-chips">
            <button
              v-for="option in styleOptions"
              :key="option.value"
              type="button"
              data-no-drag
              :class="{ active: style === option.value }"
              @click="style = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <textarea
            v-model="draft"
            rows="2"
            maxlength="240"
            :placeholder="
              mode === 'agent'
                ? '例如：建一座三层八角攒尖顶楼阁，带柱廊、斗拱、围栏和灯笼，尺寸 14×12 米，要精致'
                : '例如：帮我在地图处建造一座古风亭子，带坡屋顶和围栏'
            "
            :disabled="isBuilding"
            @keydown="onComposerKeydown"
          />
          <button
            type="button"
            data-no-drag
            :disabled="!canSend"
            @click="send"
          >
            {{ isBuilding ? '构建中…' : '发送建造指令' }}
          </button>
        </section>

        <p class="builder-notice">
          <template v-if="mode === 'agent'">
            3D Agent 由 DeepSeek 实时生成受限 Blender 脚本，可表达更复杂的提示词；需配置 DEEPSEEK_API_KEY。
          </template>
          <template v-else>
            模板模式按“古风 / 现代 / 乡村”参数模板生成，支持层数、屋顶、柱廊、围栏等特征解析。
          </template>
        </p>

        <span
          v-for="direction in resizeDirections"
          :key="direction"
          class="builder-resize-handle"
          :class="`is-${direction}`"
          aria-hidden="true"
          @lostpointercapture="onResizePointerEnd"
          @pointercancel="onResizePointerEnd"
          @pointerdown="startResize(direction, $event)"
          @pointermove="onResizePointerMove"
          @pointerup="onResizePointerEnd"
        />
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.builder-launcher {
  position: fixed;
  z-index: 3600;
  right: 22px;
  bottom: 76px;
  display: flex;
  align-items: center;
  height: 42px;
  padding: 0 15px 0 11px;
  gap: 8px;
  color: #edfffb;
  border: 1px solid rgba(61, 214, 196, 0.72);
  border-radius: 22px;
  background: linear-gradient(
    135deg,
    rgba(24, 151, 136, 0.96),
    rgba(20, 104, 99, 0.96)
  );
  box-shadow:
    0 12px 34px rgba(0, 0, 0, 0.38),
    0 0 24px rgba(61, 214, 196, 0.15);
  font-size: 11px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.builder-launcher svg {
  width: 21px;
  height: 21px;
  fill: rgba(234, 255, 251, 0.92);
}

.builder-launcher.is-open {
  opacity: 0;
  pointer-events: none;
}

.builder-launcher.is-dragging {
  cursor: grabbing;
  transform: scale(1.02);
  box-shadow:
    0 16px 42px rgba(0, 0, 0, 0.46),
    0 0 28px rgba(61, 214, 196, 0.2);
}

.builder-panel {
  position: fixed;
  z-index: 3500;
  right: 18px;
  bottom: 18px;
  display: grid;
  overflow: hidden;
  width: min(410px, calc(100vw - 32px));
  height: min(720px, calc(100vh - 88px));
  color: var(--text);
  border: 1px solid rgba(61, 214, 196, 0.38);
  border-radius: 12px;
  background: linear-gradient(
    160deg,
    rgba(14, 35, 34, 0.985),
    rgba(5, 18, 19, 0.99)
  );
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.56),
    0 0 32px rgba(61, 214, 196, 0.08);
  grid-template-rows: auto auto minmax(0, 1fr) auto auto auto;
  backdrop-filter: blur(18px);
}

.builder-panel.is-dragging,
.builder-panel.is-resizing {
  border-color: rgba(61, 214, 196, 0.58);
  box-shadow:
    0 28px 76px rgba(0, 0, 0, 0.65),
    0 0 38px rgba(61, 214, 196, 0.12);
}

.builder-resize-handle {
  position: absolute;
  z-index: 2;
  touch-action: none;
  user-select: none;
}

.builder-resize-handle.is-n,
.builder-resize-handle.is-s {
  right: 12px;
  left: 12px;
  height: 7px;
  cursor: ns-resize;
}

.builder-resize-handle.is-n {
  top: 0;
}

.builder-resize-handle.is-s {
  bottom: 0;
}

.builder-resize-handle.is-e,
.builder-resize-handle.is-w {
  top: 12px;
  bottom: 12px;
  width: 7px;
  cursor: ew-resize;
}

.builder-resize-handle.is-e {
  right: 0;
}

.builder-resize-handle.is-w {
  left: 0;
}

.builder-resize-handle.is-ne,
.builder-resize-handle.is-se,
.builder-resize-handle.is-sw,
.builder-resize-handle.is-nw {
  width: 14px;
  height: 14px;
}

.builder-resize-handle.is-ne,
.builder-resize-handle.is-sw {
  cursor: nesw-resize;
}

.builder-resize-handle.is-se,
.builder-resize-handle.is-nw {
  cursor: nwse-resize;
}

.builder-resize-handle.is-ne,
.builder-resize-handle.is-nw {
  top: 0;
}

.builder-resize-handle.is-se,
.builder-resize-handle.is-sw {
  bottom: 0;
}

.builder-resize-handle.is-ne,
.builder-resize-handle.is-se {
  right: 0;
}

.builder-resize-handle.is-nw,
.builder-resize-handle.is-sw {
  left: 0;
}

.builder-resize-handle.is-se::after {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 6px;
  height: 6px;
  border-right: 1px solid rgba(61, 214, 196, 0.52);
  border-bottom: 1px solid rgba(61, 214, 196, 0.52);
  content: '';
}

.builder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 62px;
  padding: 10px 13px;
  border-bottom: 1px solid rgba(122, 203, 190, 0.15);
  background: rgba(61, 214, 196, 0.035);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.builder-panel.is-dragging .builder-header {
  cursor: grabbing;
}

.builder-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.builder-mark,
.builder-message__role {
  display: grid;
  place-items: center;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.32);
  border-radius: 7px;
  background: rgba(61, 214, 196, 0.08);
  font: 700 8px var(--font-data);
}

.builder-mark {
  width: 36px;
  height: 36px;
  color: #eafffb;
  border-radius: 9px;
  font-size: 11px;
}

.builder-identity div {
  display: grid;
  gap: 3px;
}

.builder-identity strong {
  font-size: 13px;
}

.builder-identity small,
.builder-point span,
.builder-point small,
.builder-transform > span,
.builder-notice {
  color: var(--text-soft);
  font-size: 8px;
}

.builder-identity small i {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 4px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 7px var(--green);
}

.builder-header > button {
  width: 31px;
  height: 31px;
  padding: 0;
  color: var(--text-soft);
  border: 0;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
}

.builder-point {
  display: grid;
  padding: 9px 13px;
  gap: 3px;
  border-bottom: 1px solid rgba(122, 203, 190, 0.1);
  background: rgba(5, 16, 17, 0.52);
}

.builder-point strong {
  overflow: hidden;
  color: var(--cyan);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.builder-point strong.is-selected {
  color: var(--amber);
}

.builder-point.is-picking strong {
  color: var(--amber);
}

.builder-point button {
  justify-self: start;
  min-height: 24px;
  margin-top: 3px;
  padding: 0 10px;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.28);
  border-radius: 12px;
  background: rgba(61, 214, 196, 0.07);
  font-size: 8px;
  cursor: pointer;
}

.builder-point button.is-primary {
  color: #04201d;
  border-color: var(--cyan);
  background: var(--cyan);
  font-weight: 700;
}

.builder-messages {
  overflow-y: auto;
  padding: 14px 12px;
  scrollbar-color: rgba(61, 214, 196, 0.25) transparent;
  scrollbar-width: thin;
}

.builder-message {
  display: grid;
  align-items: start;
  margin-bottom: 14px;
  gap: 7px;
  grid-template-columns: 26px minmax(0, 1fr);
}

.builder-message.is-user {
  padding-left: 42px;
  grid-template-columns: minmax(0, 1fr) 26px;
}

.builder-message.is-user .builder-message__role {
  grid-column: 2;
  grid-row: 1;
}

.builder-message.is-user .builder-message__body {
  grid-column: 1;
  grid-row: 1;
  border-color: rgba(109, 169, 237, 0.22);
  background: rgba(109, 169, 237, 0.09);
}

.builder-message__role {
  width: 26px;
  height: 26px;
}

.builder-message__body {
  min-width: 0;
  padding: 10px 11px;
  border: 1px solid rgba(122, 203, 190, 0.14);
  border-radius: 4px 9px 9px;
  background: rgba(255, 255, 255, 0.025);
}

.builder-message__body > p {
  margin: 0;
  color: #dcece8;
  font-size: 11px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.builder-progress {
  display: grid;
  align-items: center;
  height: 5px;
  margin-top: 8px;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) 34px;
}

.builder-progress > i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: var(--cyan);
  box-shadow: 0 0 7px var(--cyan);
  transition: width 180ms linear;
}

.builder-progress span {
  color: var(--cyan);
  font: 9px var(--font-data);
}

.builder-transform {
  display: grid;
  padding: 9px 12px;
  gap: 6px;
  border-top: 1px solid rgba(61, 214, 196, 0.12);
  background: rgba(61, 214, 196, 0.035);
}

.builder-transform label {
  display: grid;
  gap: 3px;
}

.builder-transform label > span {
  display: flex;
  color: var(--text-soft);
  font-size: 8px;
}

.builder-transform label strong {
  margin-left: auto;
  color: var(--cyan);
  font: 9px var(--font-data);
}

.builder-transform input {
  width: 100%;
  height: 3px;
  accent-color: var(--cyan);
  cursor: pointer;
}

.builder-transform-actions {
  display: flex;
  gap: 6px;
}

.builder-transform-actions button {
  flex: 1;
  min-height: 26px;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.3);
  border-radius: 6px;
  background: rgba(61, 214, 196, 0.07);
  font-size: 8px;
  cursor: pointer;
}

.builder-transform-actions button.is-danger {
  color: #ef7b6e;
  border-color: rgba(239, 123, 110, 0.3);
  background: rgba(239, 123, 110, 0.07);
}

.builder-composer {
  display: grid;
  margin: 0 11px;
  padding: 8px;
  gap: 7px;
  border: 1px solid rgba(122, 203, 190, 0.22);
  border-radius: 8px;
  background: rgba(3, 13, 14, 0.7);
}

.builder-mode-tabs {
  display: grid;
  gap: 5px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.builder-mode-tabs button {
  min-height: 26px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  font-size: 9px;
  cursor: pointer;
}

.builder-mode-tabs button.active {
  color: #04201d;
  border-color: var(--cyan);
  background: var(--cyan);
  font-weight: 700;
}

.builder-style-chips {
  display: flex;
  gap: 5px;
}

.builder-style-chips button {
  min-height: 23px;
  padding: 0 9px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.15);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  font-size: 8px;
  cursor: pointer;
}

.builder-style-chips button.active {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.45);
  background: rgba(61, 214, 196, 0.1);
}

.builder-composer textarea {
  resize: none;
  min-height: 42px;
  padding: 3px;
  color: var(--text);
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 10px;
}

.builder-composer > button {
  min-height: 30px;
  color: #eafffb;
  border: 1px solid rgba(61, 214, 196, 0.52);
  border-radius: 7px;
  background: linear-gradient(145deg, #1caa97, #197a70);
  font-size: 9px;
  cursor: pointer;
}

.builder-composer > button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.builder-notice {
  margin: 7px 11px 9px;
  line-height: 1.5;
  text-align: center;
}

.builder-panel-enter-active,
.builder-panel-leave-active {
  transition: 180ms ease;
}

.builder-panel-enter-from,
.builder-panel-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

@media (max-width: 600px) {
  .builder-panel {
    right: 16px;
    bottom: 16px;
    width: calc(100vw - 32px);
    height: calc(100vh - 76px);
  }
  .builder-launcher {
    right: 12px;
    bottom: 66px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .builder-panel-enter-active,
  .builder-panel-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
