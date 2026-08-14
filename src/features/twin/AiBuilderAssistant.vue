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
  embedded?: boolean
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

const promptSuggestions = [
  '建一座带廊架和座椅的乡村口袋公园',
  '生成一座两层现代乡村服务站，带坡屋顶',
  '建一座中式六角亭，包含台阶、围栏和灯笼',
]

const draft = ref('')
const messageId = ref(1)
const messageList = ref<HTMLElement | null>(null)
const statusMessageId = ref<number | null>(null)
const messages = ref<BuilderMessage[]>([])

const canSend = computed(
  () => props.pointReady && !props.isBuilding && draft.value.trim().length > 0,
)
const currentStep = computed(() =>
  props.isBuilding || props.modelReady ? 3 : props.pointReady ? 2 : 1,
)
const builderStatus = computed(() => {
  if (props.isBuilding) return `生成中 ${props.buildProgress}%`
  if (props.modelReady) return '模型已就绪'
  if (props.picking) return '等待地图落点'
  if (props.pointReady) return '等待描述'
  return '尚未开始'
})

async function scrollToLatest() {
  await nextTick()
  const list = messageList.value
  if (!list) return
  if (typeof list.scrollTo === 'function') {
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  } else {
    list.scrollTop = list.scrollHeight
  }
}

function usePromptSuggestion(prompt: string) {
  if (props.isBuilding) return
  draft.value = prompt
}

function send() {
  const content = draft.value.trim()
  if (!canSend.value || !content) return

  messages.value.push({ id: messageId.value++, role: 'user', content })
  statusMessageId.value = messageId.value++
  messages.value.push({
    id: statusMessageId.value,
    role: 'assistant',
    content: `已收到建造指令，正在 ${props.pointLabel} 准备 Blender 建模任务……`,
  })
  draft.value = ''
  emit('build-agent', content)
  void scrollToLatest()
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
      content: `正在 ${props.pointLabel} 调用本机 Blender 生成模型……`,
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
      content: `3D 模型已在 ${props.pointLabel} 生成完成。可在场景中拖动模型，并使用下方控制调整大小和朝向。`,
    })
    statusMessageId.value = null
    void scrollToLatest()
  },
)
</script>

<template>
  <Teleport to="body" :disabled="embedded">
    <button
      v-if="!embedded"
      ref="launcherRef"
      class="builder-launcher"
      :class="{ 'is-open': isOpen, 'is-dragging': isLauncherDragging }"
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
        v-if="embedded || isOpen"
        id="ai-builder-panel"
        ref="panelRef"
        class="builder-panel"
        :class="{
          'is-embedded': embedded,
          'is-dragging': isDragging,
          'is-resizing': isResizing,
        }"
        :style="embedded ? undefined : panelStyle"
        aria-label="AI 建造助手"
      >
        <header
          class="builder-header"
          :title="embedded ? undefined : '拖动标题栏可移动，双击恢复默认位置'"
          @dblclick="embedded || resetPosition()"
          @lostpointercapture="embedded || onHeaderPointerEnd($event)"
          @pointercancel="embedded || onHeaderPointerEnd($event)"
          @pointerdown="embedded || onHeaderPointerDown($event)"
          @pointermove="embedded || onHeaderPointerMove($event)"
          @pointerup="embedded || onHeaderPointerEnd($event)"
        >
          <div class="builder-identity">
            <span class="builder-mark">建</span>
            <div>
              <strong>AI 建造助手</strong>
              <small>自然语言生成场景模型</small>
            </div>
          </div>
          <em
            class="builder-status-pill"
            :class="{ 'is-active': picking || isBuilding, 'is-ready': modelReady }"
          >
            {{ builderStatus }}
          </em>
          <button
            v-if="!embedded"
            type="button"
            data-no-drag
            aria-label="关闭 AI 建造助手"
            @click="isOpen = false"
          >
            ×
          </button>
        </header>

        <ol class="builder-steps" aria-label="AI 建造流程">
          <li
            v-for="(label, index) in ['选择位置', '描述需求', '生成模型']"
            :key="label"
            :class="{
              'is-current': currentStep === index + 1,
              'is-complete': currentStep > index + 1,
            }"
            :aria-current="currentStep === index + 1 ? 'step' : undefined"
          >
            <i>{{ currentStep > index + 1 ? '✓' : index + 1 }}</i>
            <span>{{ label }}</span>
          </li>
        </ol>

        <main class="builder-workspace">
          <section
            v-if="!pointReady || picking"
            class="builder-empty"
            :class="{ 'is-picking': picking }"
          >
            <span class="builder-empty__icon" aria-hidden="true">⌖</span>
            <strong>{{ picking ? '请在地图中点击落点' : '先确定模型建造位置' }}</strong>
            <p>
              {{
                picking
                  ? '建议选择建筑旁的空地，落点后即可继续描述模型。'
                  : '选点后再描述建筑类型、尺寸和风格，操作会更清晰。'
              }}
            </p>
            <button
              type="button"
              class="is-primary"
              data-no-drag
              @click="picking ? emit('cancel-pick') : emit('toggle-pick')"
            >
              {{ picking ? '取消选点' : '在地图上选择位置' }}
            </button>
            <small v-if="picking">按 Esc 也可取消</small>
          </section>

          <template v-else>
            <section class="builder-location">
              <i aria-hidden="true">✓</i>
              <span>
                <small>建造位置</small>
                <strong>{{ pointLabel }}</strong>
              </span>
              <button type="button" data-no-drag @click="emit('toggle-pick')">
                重新选点
              </button>
            </section>

            <div v-if="messages.length" ref="messageList" class="builder-messages">
              <article
                v-for="message in messages"
                :key="message.id"
                class="builder-message"
                :class="`is-${message.role}`"
              >
                <span class="builder-message__role">
                  {{ message.role === 'assistant' ? 'AI' : '我' }}
                </span>
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

            <section v-else class="builder-prompt-guide">
              <span>
                <strong>描述你想建什么</strong>
                <small>可选择示例，再按需要修改</small>
              </span>
              <div class="builder-suggestions">
                <button
                  v-for="prompt in promptSuggestions"
                  :key="prompt"
                  type="button"
                  data-no-drag
                  @click="usePromptSuggestion(prompt)"
                >
                  {{ prompt }}
                </button>
              </div>
            </section>
          </template>
        </main>

        <section v-if="modelReady" class="builder-transform">
          <span>模型调整</span>
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

        <section v-if="pointReady && !picking" class="builder-composer">
          <div class="builder-composer__heading">
            <span>
              <strong>3D Agent</strong>
              <small>自然语言生成 Blender 模型</small>
            </span>
            <em>{{ draft.length }}/240</em>
          </div>
          <textarea
            v-model="draft"
            rows="3"
            maxlength="240"
            placeholder="描述建筑类型、层数、尺寸、屋顶和细节……"
            :disabled="isBuilding"
            @keydown="onComposerKeydown"
          />
          <button type="button" data-no-drag :disabled="!canSend" @click="send">
            {{
              isBuilding
                ? `生成中 ${buildProgress}%`
                : modelReady
                  ? '重新生成模型'
                  : '生成 3D 模型'
            }}
          </button>
        </section>

        <p v-if="pointReady && !picking" class="builder-notice">
          生成后可在场景中拖动、缩放和旋转模型
        </p>

        <template v-if="!embedded">
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
        </template>
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
  background: linear-gradient(135deg, #189788, #146863);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.38);
  font-size: 11px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.builder-launcher svg {
  width: 21px;
  height: 21px;
  fill: currentcolor;
}

.builder-launcher.is-open {
  opacity: 0;
  pointer-events: none;
}

.builder-launcher.is-dragging {
  cursor: grabbing;
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
  background: linear-gradient(160deg, rgba(14, 35, 34, 0.985), rgba(5, 18, 19, 0.99));
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.56);
  grid-template-rows: auto auto minmax(0, 1fr) auto auto auto;
  backdrop-filter: blur(18px);
}

.builder-panel.is-embedded {
  position: relative;
  inset: auto;
  z-index: auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  border-color: rgba(122, 203, 190, 0.22);
  border-radius: 10px;
  box-shadow: none;
  backdrop-filter: none;
}

.builder-panel.is-dragging,
.builder-panel.is-resizing {
  border-color: rgba(61, 214, 196, 0.58);
}

.builder-header {
  display: flex;
  align-items: center;
  min-height: 58px;
  padding: 9px 12px;
  gap: 8px;
  border-bottom: 1px solid rgba(122, 203, 190, 0.13);
  background: rgba(61, 214, 196, 0.035);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.is-embedded .builder-header {
  cursor: default;
  touch-action: auto;
  user-select: auto;
}

.builder-panel.is-dragging .builder-header {
  cursor: grabbing;
}

.builder-identity {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 9px;
}

.builder-identity > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.builder-identity strong {
  font-size: 12px;
}

.builder-identity small {
  color: var(--text-soft);
  font-size: 8px;
  white-space: nowrap;
}

.builder-mark,
.builder-message__role {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.32);
  border-radius: 7px;
  background: rgba(61, 214, 196, 0.08);
  font: 700 8px var(--font-data);
}

.builder-mark {
  width: 32px;
  height: 32px;
  color: #eafffb;
  font-size: 10px;
}

.builder-status-pill {
  margin-left: auto;
  padding: 4px 7px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.16);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.025);
  font: normal 8px var(--font-data);
  white-space: nowrap;
}

.builder-status-pill.is-active {
  color: var(--amber);
  border-color: rgba(245, 190, 76, 0.28);
  background: rgba(245, 190, 76, 0.07);
}

.builder-status-pill.is-ready {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.3);
  background: rgba(61, 214, 196, 0.08);
}

.builder-header > button {
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--text-soft);
  border: 0;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
}

.builder-steps {
  display: grid;
  margin: 0;
  padding: 9px 12px 10px;
  list-style: none;
  border-bottom: 1px solid rgba(122, 203, 190, 0.1);
  background: rgba(4, 17, 18, 0.46);
  grid-template-columns: repeat(3, 1fr);
}

.builder-steps li {
  position: relative;
  display: grid;
  place-items: center;
  gap: 4px;
  color: rgba(190, 212, 207, 0.52);
  font-size: 8px;
}

.builder-steps li:not(:last-child)::after {
  position: absolute;
  top: 9px;
  left: calc(50% + 15px);
  width: calc(100% - 30px);
  height: 1px;
  background: rgba(122, 203, 190, 0.18);
  content: '';
}

.builder-steps i {
  z-index: 1;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 1px solid rgba(122, 203, 190, 0.2);
  border-radius: 50%;
  background: #0b2221;
  font: normal 8px var(--font-data);
}

.builder-steps .is-current {
  color: #eafffb;
}

.builder-steps .is-current i {
  color: #04201d;
  border-color: var(--cyan);
  background: var(--cyan);
  box-shadow: 0 0 10px rgba(61, 214, 196, 0.24);
}

.builder-steps .is-complete {
  color: var(--cyan);
}

.builder-steps .is-complete i,
.builder-steps .is-complete::after {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.42);
  background: rgba(61, 214, 196, 0.14);
}

.builder-workspace {
  display: grid;
  overflow: hidden;
  min-height: 0;
}

.builder-empty {
  display: grid;
  align-content: center;
  justify-items: center;
  padding: 22px 18px;
  text-align: center;
}

.builder-empty__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin-bottom: 10px;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.28);
  border-radius: 15px;
  background: rgba(61, 214, 196, 0.07);
  font-size: 25px;
}

.builder-empty.is-picking .builder-empty__icon {
  color: var(--amber);
  border-color: rgba(245, 190, 76, 0.3);
  background: rgba(245, 190, 76, 0.07);
  animation: builder-pulse 1.8s ease-in-out infinite;
}

.builder-empty strong {
  color: #eafffb;
  font-size: 12px;
}

.builder-empty p {
  max-width: 250px;
  margin: 7px 0 15px;
  color: var(--text-soft);
  font-size: 9px;
  line-height: 1.6;
}

.builder-empty button {
  min-height: 30px;
  padding: 0 16px;
  color: #04201d;
  border: 1px solid var(--cyan);
  border-radius: 7px;
  background: var(--cyan);
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
}

.builder-empty.is-picking button {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.34);
  background: rgba(61, 214, 196, 0.08);
}

.builder-empty small {
  margin-top: 8px;
  color: var(--text-soft);
  font-size: 8px;
}

.builder-location {
  display: grid;
  align-items: center;
  margin: 10px 10px 0;
  padding: 8px 9px;
  gap: 8px;
  border: 1px solid rgba(61, 214, 196, 0.18);
  border-radius: 7px;
  background: rgba(61, 214, 196, 0.045);
  grid-template-columns: 22px minmax(0, 1fr) auto;
}

.builder-location > i {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  color: #04201d;
  border-radius: 50%;
  background: var(--cyan);
  font: normal 10px var(--font-data);
}

.builder-location > span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.builder-location small,
.builder-prompt-guide small,
.builder-composer__heading small {
  color: var(--text-soft);
  font-size: 8px;
}

.builder-location strong {
  overflow: hidden;
  color: #eafffb;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.builder-location button {
  min-height: 24px;
  padding: 0 8px;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.24);
  border-radius: 6px;
  background: rgba(61, 214, 196, 0.06);
  font-size: 8px;
  cursor: pointer;
}

.builder-prompt-guide {
  display: grid;
  align-content: center;
  padding: 16px 10px;
  gap: 10px;
}

.builder-prompt-guide > span {
  display: grid;
  gap: 3px;
}

.builder-prompt-guide strong {
  color: #eafffb;
  font-size: 10px;
}

.builder-suggestions {
  display: grid;
  gap: 6px;
}

.builder-suggestions button {
  min-height: 32px;
  padding: 6px 9px;
  color: #cfe5e0;
  border: 1px solid rgba(122, 203, 190, 0.14);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.025);
  font-size: 8px;
  line-height: 1.45;
  text-align: left;
  cursor: pointer;
}

.builder-suggestions button:hover {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.35);
  background: rgba(61, 214, 196, 0.07);
}

.builder-messages {
  overflow-y: auto;
  min-height: 0;
  padding: 12px 10px;
  scrollbar-color: rgba(61, 214, 196, 0.25) transparent;
  scrollbar-width: thin;
}

.builder-message {
  display: grid;
  align-items: start;
  margin-bottom: 10px;
  gap: 7px;
  grid-template-columns: 26px minmax(0, 1fr);
}

.builder-message.is-user {
  padding-left: 34px;
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
  padding: 8px 9px;
  border: 1px solid rgba(122, 203, 190, 0.14);
  border-radius: 4px 9px 9px;
  background: rgba(255, 255, 255, 0.025);
}

.builder-message__body > p {
  margin: 0;
  color: #dcece8;
  font-size: 9px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.builder-progress {
  display: grid;
  align-items: center;
  height: 4px;
  margin-top: 8px;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) 32px;
}

.builder-progress > i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: var(--cyan);
}

.builder-progress span {
  color: var(--cyan);
  font: 8px var(--font-data);
}

.builder-transform {
  display: grid;
  padding: 8px 11px;
  gap: 5px;
  border-top: 1px solid rgba(61, 214, 196, 0.12);
  background: rgba(61, 214, 196, 0.035);
}

.builder-transform > span {
  color: #dcece8;
  font-size: 9px;
  font-weight: 700;
}

.builder-transform label {
  display: grid;
  gap: 2px;
}

.builder-transform label > span {
  display: flex;
  color: var(--text-soft);
  font-size: 8px;
}

.builder-transform label strong {
  margin-left: auto;
  color: var(--cyan);
  font: 8px var(--font-data);
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
  min-height: 25px;
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
  margin: 0 10px;
  padding: 8px;
  gap: 7px;
  border: 1px solid rgba(122, 203, 190, 0.22);
  border-radius: 8px;
  background: rgba(3, 13, 14, 0.72);
}

.builder-composer__heading {
  display: flex;
  align-items: center;
}

.builder-composer__heading > span {
  display: grid;
  gap: 1px;
}

.builder-composer__heading strong {
  color: var(--cyan);
  font-size: 9px;
}

.builder-composer__heading em {
  margin-left: auto;
  color: var(--text-soft);
  font: normal 8px var(--font-data);
}

.builder-composer textarea {
  resize: none;
  min-height: 48px;
  padding: 7px 8px;
  color: var(--text);
  border: 1px solid rgba(122, 203, 190, 0.14);
  border-radius: 6px;
  outline: 0;
  background: rgba(255, 255, 255, 0.025);
  font: 9px/1.55 inherit;
}

.builder-composer textarea:focus {
  border-color: rgba(61, 214, 196, 0.45);
  box-shadow: 0 0 0 2px rgba(61, 214, 196, 0.07);
}

.builder-composer > button {
  min-height: 31px;
  color: #eafffb;
  border: 1px solid rgba(61, 214, 196, 0.52);
  border-radius: 7px;
  background: linear-gradient(145deg, #1caa97, #197a70);
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
}

.builder-composer > button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.builder-notice {
  margin: 6px 10px 8px;
  color: var(--text-soft);
  font-size: 8px;
  line-height: 1.5;
  text-align: center;
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

.builder-resize-handle.is-n { top: 0; }
.builder-resize-handle.is-s { bottom: 0; }

.builder-resize-handle.is-e,
.builder-resize-handle.is-w {
  top: 12px;
  bottom: 12px;
  width: 7px;
  cursor: ew-resize;
}

.builder-resize-handle.is-e { right: 0; }
.builder-resize-handle.is-w { left: 0; }

.builder-resize-handle.is-ne,
.builder-resize-handle.is-se,
.builder-resize-handle.is-sw,
.builder-resize-handle.is-nw {
  width: 14px;
  height: 14px;
}

.builder-resize-handle.is-ne,
.builder-resize-handle.is-sw { cursor: nesw-resize; }

.builder-resize-handle.is-se,
.builder-resize-handle.is-nw { cursor: nwse-resize; }

.builder-resize-handle.is-ne,
.builder-resize-handle.is-nw { top: 0; }

.builder-resize-handle.is-se,
.builder-resize-handle.is-sw { bottom: 0; }

.builder-resize-handle.is-ne,
.builder-resize-handle.is-se { right: 0; }

.builder-resize-handle.is-nw,
.builder-resize-handle.is-sw { left: 0; }

.builder-panel-enter-active,
.builder-panel-leave-active {
  transition: 180ms ease;
}

.builder-panel-enter-from,
.builder-panel-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

@keyframes builder-pulse {
  50% { box-shadow: 0 0 18px rgba(245, 190, 76, 0.18); }
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
    transition: none;
  }

  .builder-empty.is-picking .builder-empty__icon {
    animation: none;
  }
}
</style>
