<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useDraggablePanel } from '@/shared/composables/useDraggablePanel'
import {
  requestDecisionAssistant,
  type DecisionAssistantContext,
  type DecisionAssistantResponse,
} from './assistant'

interface Message {
  id: number
  role: 'assistant' | 'user'
  content: string
  result?: DecisionAssistantResponse
  error?: boolean
}

const props = defineProps<{
  endpoint: string
  timeoutMs: number
  context: DecisionAssistantContext
  prompts: string[]
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const draft = ref('')
const messageId = ref(1)
const messageList = ref<HTMLElement | null>(null)
const messages = ref<Message[]>([
  {
    id: messageId.value++,
    role: 'assistant',
    content: `我是${props.context.module} AI 决策助手。我会依据当前页面的实时指标和操作状态进行分析，并明确列出数据依据。`,
  },
])
const {
  isDragging,
  onHeaderPointerDown,
  onHeaderPointerEnd,
  onHeaderPointerMove,
  panelRef,
  panelStyle,
  resetPosition,
} = useDraggablePanel(isOpen)

async function scrollToLatest() {
  await nextTick()
  messageList.value?.scrollTo({
    top: messageList.value.scrollHeight,
    behavior: 'smooth',
  })
}

async function sendQuestion(question = draft.value) {
  const content = question.trim()
  if (!content || isLoading.value) return
  const history = messages.value
    .filter((message) => message.id !== 1 && !message.error)
    .slice(-8)
    .map((message) => ({ role: message.role, content: message.content }))
  messages.value.push({ id: messageId.value++, role: 'user', content })
  draft.value = ''
  isOpen.value = true
  isLoading.value = true
  await scrollToLatest()

  try {
    const result = await requestDecisionAssistant(
      props.endpoint,
      props.timeoutMs,
      {
        question: content,
        history,
        context: props.context,
      },
    )
    messages.value.push({
      id: messageId.value++,
      role: 'assistant',
      content: result.answer,
      result,
    })
  } catch (cause) {
    messages.value.push({
      id: messageId.value++,
      role: 'assistant',
      content:
        cause instanceof Error ? cause.message : 'AI 分析失败，请稍后重试',
      error: true,
    })
  } finally {
    isLoading.value = false
    await scrollToLatest()
  }
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  void sendQuestion()
}
</script>

<template>
  <Teleport to="body">
    <button
      class="assistant-launcher"
      :class="{ 'is-open': isOpen }"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="module-ai-panel"
      @click="isOpen = !isOpen"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M8 10h8M8 14h5M9 3h6l1 3h2a3 3 0 013 3v7a3 3 0 01-3 3h-7l-4 2v-2H6a3 3 0 01-3-3V9a3 3 0 013-3h2l1-3z"
        />
      </svg>
      <span>AI 决策助手</span>
    </button>

    <Transition name="assistant-panel">
      <section
        v-if="isOpen"
        ref="panelRef"
        id="module-ai-panel"
        class="assistant-panel"
        :class="{ 'is-dragging': isDragging }"
        :style="panelStyle"
        :aria-label="`${context.module} AI 决策助手`"
      >
        <header
          class="assistant-header"
          title="拖动标题栏可移动，双击恢复默认位置"
          @dblclick="resetPosition"
          @pointercancel="onHeaderPointerEnd"
          @pointerdown="onHeaderPointerDown"
          @pointermove="onHeaderPointerMove"
          @pointerup="onHeaderPointerEnd"
        >
          <div class="assistant-identity">
            <span class="assistant-mark">AI</span>
            <div>
              <strong>{{ context.module }}决策助手</strong>
              <small><i /> DeepSeek · 页面数据已连接</small>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭 AI 助手"
            @click="isOpen = false"
          >
            ×
          </button>
        </header>

        <div class="assistant-context">
          <span>分析上下文</span>
          <strong>{{ context.scopeLabel }}</strong>
          <small
            >{{ Object.keys(context.data).length }} 组页面数据 ·
            随操作实时更新</small
          >
        </div>

        <div ref="messageList" class="assistant-messages">
          <article
            v-for="message in messages"
            :key="message.id"
            class="assistant-message"
            :class="[`is-${message.role}`, { 'is-error': message.error }]"
          >
            <span class="assistant-message__role">{{
              message.role === 'assistant' ? 'AI' : '我'
            }}</span>
            <div class="assistant-message__body">
              <p>{{ message.content }}</p>
              <template v-if="message.result">
                <ul
                  v-if="message.result.evidence.length"
                  class="assistant-evidence"
                >
                  <li
                    v-for="evidence in message.result.evidence"
                    :key="evidence"
                  >
                    {{ evidence }}
                  </li>
                </ul>
                <div
                  v-if="message.result.suggestions.length"
                  class="assistant-suggestions"
                >
                  <strong>建议行动</strong>
                  <ol>
                    <li
                      v-for="suggestion in message.result.suggestions"
                      :key="suggestion"
                    >
                      {{ suggestion }}
                    </li>
                  </ol>
                </div>
                <footer>
                  <span>{{ message.result.scopeLabel }}</span>
                  <span>{{ message.result.meta.model }}</span>
                </footer>
                <small class="assistant-disclaimer">{{
                  message.result.disclaimer
                }}</small>
              </template>
            </div>
          </article>
          <article v-if="isLoading" class="assistant-message is-assistant">
            <span class="assistant-message__role">AI</span>
            <div class="assistant-message__body assistant-thinking">
              <i /><i /><i />
              <span>正在读取当前模块数据并形成研判…</span>
            </div>
          </article>
        </div>

        <div class="assistant-prompts">
          <button
            v-for="prompt in prompts"
            :key="prompt"
            type="button"
            :disabled="isLoading"
            @click="sendQuestion(prompt)"
          >
            {{ prompt }}
          </button>
        </div>

        <div class="assistant-composer">
          <textarea
            v-model="draft"
            rows="2"
            maxlength="500"
            :placeholder="`询问${context.module}的态势、对比或决策建议…`"
            :disabled="isLoading"
            @keydown="onComposerKeydown"
          />
          <button
            type="button"
            :disabled="!draft.trim() || isLoading"
            aria-label="发送问题"
            @click="sendQuestion()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12L20 4l-6 16-2.7-5.3L4 12zM11.3 14.7L20 4" />
            </svg>
          </button>
        </div>
        <p class="assistant-notice">
          AI 结论仅供辅助研判，请结合专业规范与现场情况核实。
        </p>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.assistant-launcher {
  position: fixed;
  z-index: 3600;
  right: 22px;
  bottom: 22px;
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
  cursor: pointer;
}

.assistant-launcher svg,
.assistant-composer svg {
  width: 21px;
  height: 21px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.assistant-launcher.is-open {
  opacity: 0;
  pointer-events: none;
}

.assistant-panel {
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

.assistant-panel.is-dragging {
  box-shadow:
    0 28px 76px rgba(0, 0, 0, 0.65),
    0 0 38px rgba(61, 214, 196, 0.12);
}

.assistant-header {
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

.assistant-panel.is-dragging .assistant-header {
  cursor: grabbing;
}

.assistant-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.assistant-mark,
.assistant-message__role {
  display: grid;
  place-items: center;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.32);
  border-radius: 7px;
  background: rgba(61, 214, 196, 0.08);
  font: 700 8px var(--font-data);
}

.assistant-mark {
  width: 36px;
  height: 36px;
  color: #eafffb;
  border-radius: 9px;
  font-size: 11px;
}

.assistant-identity div {
  display: grid;
  gap: 3px;
}

.assistant-identity strong {
  font-size: 13px;
}

.assistant-identity small,
.assistant-context span,
.assistant-context small {
  color: var(--text-soft);
  font-size: 8px;
}

.assistant-identity small i {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 4px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 7px var(--green);
}

.assistant-header > button {
  width: 31px;
  height: 31px;
  padding: 0;
  color: var(--text-soft);
  border: 0;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
}

.assistant-context {
  display: grid;
  padding: 9px 13px;
  gap: 2px;
  border-bottom: 1px solid rgba(122, 203, 190, 0.1);
  background: rgba(5, 16, 17, 0.52);
  grid-template-columns: 78px 1fr;
}

.assistant-context strong {
  overflow: hidden;
  color: var(--cyan);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant-context small {
  grid-column: 2;
}

.assistant-messages {
  overflow-y: auto;
  padding: 14px 12px;
  scrollbar-color: rgba(61, 214, 196, 0.25) transparent;
  scrollbar-width: thin;
}

.assistant-message {
  display: grid;
  align-items: start;
  margin-bottom: 14px;
  gap: 7px;
  grid-template-columns: 26px minmax(0, 1fr);
}

.assistant-message.is-user {
  padding-left: 42px;
  grid-template-columns: minmax(0, 1fr) 26px;
}

.assistant-message.is-user .assistant-message__role {
  grid-column: 2;
  grid-row: 1;
}

.assistant-message.is-user .assistant-message__body {
  grid-column: 1;
  grid-row: 1;
  border-color: rgba(109, 169, 237, 0.22);
  background: rgba(109, 169, 237, 0.09);
}

.assistant-message__role {
  width: 26px;
  height: 26px;
}

.assistant-message__body {
  min-width: 0;
  padding: 10px 11px;
  border: 1px solid rgba(122, 203, 190, 0.14);
  border-radius: 4px 9px 9px;
  background: rgba(255, 255, 255, 0.025);
}

.assistant-message__body > p {
  margin: 0;
  color: #dcece8;
  font-size: 11px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.assistant-message.is-error .assistant-message__body {
  border-color: rgba(231, 116, 104, 0.28);
  background: rgba(231, 116, 104, 0.08);
}

.assistant-evidence,
.assistant-suggestions {
  margin: 9px 0 0;
  padding: 8px 9px 8px 24px;
  color: var(--text-soft);
  border-left: 2px solid rgba(61, 214, 196, 0.42);
  background: rgba(61, 214, 196, 0.035);
  font-size: 9px;
  line-height: 1.55;
}

.assistant-suggestions {
  padding-left: 9px;
  border: 1px solid rgba(61, 214, 196, 0.14);
  border-radius: 6px;
}

.assistant-suggestions strong {
  color: var(--cyan);
  font-size: 8px;
}

.assistant-suggestions ol {
  margin: 5px 0 0;
  padding-left: 18px;
}

.assistant-message footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: rgba(154, 183, 176, 0.62);
  font: 7px var(--font-data);
}

.assistant-disclaimer {
  display: block;
  margin-top: 6px;
  color: rgba(240, 184, 92, 0.72);
  font-size: 7px;
}

.assistant-thinking {
  display: flex;
  align-items: center;
  min-height: 40px;
  gap: 4px;
  color: var(--text-soft);
  font-size: 9px;
}

.assistant-thinking i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--cyan);
  animation: assistant-thinking 1.1s infinite ease-in-out;
}

.assistant-thinking i:nth-child(2) {
  animation-delay: 120ms;
}
.assistant-thinking i:nth-child(3) {
  animation-delay: 240ms;
}

.assistant-prompts {
  display: flex;
  overflow-x: auto;
  padding: 8px 11px;
  gap: 6px;
  border-top: 1px solid rgba(122, 203, 190, 0.09);
  scrollbar-width: none;
}

.assistant-prompts button {
  flex: 0 0 auto;
  min-height: 27px;
  padding: 0 9px;
  color: var(--text-soft);
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
  font-size: 8px;
  cursor: pointer;
}

.assistant-composer {
  display: grid;
  margin: 0 11px;
  padding: 7px;
  gap: 7px;
  border: 1px solid rgba(122, 203, 190, 0.22);
  border-radius: 8px;
  background: rgba(3, 13, 14, 0.7);
  grid-template-columns: minmax(0, 1fr) 34px;
}

.assistant-composer textarea {
  resize: none;
  min-height: 37px;
  padding: 3px;
  color: var(--text);
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 10px;
}

.assistant-composer > button {
  align-self: end;
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  place-items: center;
  color: #eafffb;
  border: 1px solid rgba(61, 214, 196, 0.52);
  border-radius: 7px;
  background: linear-gradient(145deg, #1caa97, #197a70);
  cursor: pointer;
}

.assistant-composer > button:disabled,
.assistant-prompts button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.assistant-composer svg {
  width: 17px;
  height: 17px;
}

.assistant-notice {
  margin: 7px 11px 9px;
  color: rgba(154, 183, 176, 0.58);
  font-size: 7px;
  text-align: center;
}

.assistant-panel-enter-active,
.assistant-panel-leave-active {
  transition: 180ms ease;
}
.assistant-panel-enter-from,
.assistant-panel-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

@keyframes assistant-thinking {
  0%,
  60%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

@media (max-width: 600px) {
  .assistant-panel {
    right: 16px;
    bottom: 16px;
    width: calc(100vw - 32px);
    height: calc(100vh - 76px);
  }
  .assistant-launcher {
    right: 12px;
    bottom: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .assistant-panel-enter-active,
  .assistant-panel-leave-active,
  .assistant-thinking i {
    animation: none;
    transition: none;
  }
}
</style>
