<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  issueStatuses,
  type GovernanceIssue,
  type IssueStatus,
} from './data'

const props = defineProps<{ issue: GovernanceIssue }>()
const emit = defineEmits<{
  close: []
  locate: []
  updateStatus: [status: IssueStatus]
}>()

const closeButton = ref<HTMLButtonElement | null>(null)
const evidencePhotoUrl = `${import.meta.env.BASE_URL}images/governance/issue-evidence-triptych.webp`
const previousOverflow = document.body.style.overflow

const statusColors: Record<IssueStatus, string> = {
  待审核: '#f0b85c',
  已派单: '#6da9ed',
  处理中: '#3dd6c4',
  已办结: '#839b95',
}

const stageDefinitions = [
  {
    label: '上报',
    recordTitle: '问题上报',
    description: '问题已通过移动端或感知设备进入处置平台',
    icon: 'location',
    minutes: 0,
  },
  {
    label: '审核',
    recordTitle: '审核通过',
    description: '管理员核验问题位置、类型及描述信息',
    icon: 'clipboard',
    minutes: 23,
  },
  {
    label: '派单',
    recordTitle: '派单处理',
    description: '任务已派发至属地乡镇环境整治队伍',
    icon: 'send',
    minutes: 53,
  },
  {
    label: '处理中',
    recordTitle: '处理中',
    description: '工作人员已到现场，正在开展问题处置',
    icon: 'clock',
    minutes: 78,
  },
  {
    label: '已办结',
    recordTitle: '已办结',
    description: '问题处置完成，等待复核归档',
    icon: 'check',
    minutes: 112,
  },
] as const

const currentStage = computed(
  () =>
    ({ 待审核: 1, 已派单: 2, 处理中: 3, 已办结: 4 })[
      props.issue.status
    ],
)
const statusIndex = computed(() => issueStatuses.indexOf(props.issue.status))
const nextStatus = computed(() => issueStatuses[statusIndex.value + 1])
const previousStatus = computed(() => issueStatuses[statusIndex.value - 1])

function addMinutes(value: string, minutes: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  date.setMinutes(date.getMinutes() + minutes)
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace('/', '-')
}

const stages = computed(() =>
  stageDefinitions.map((stage, index) => ({
    ...stage,
    state:
      index < currentStage.value
        ? 'complete'
        : index === currentStage.value
          ? 'current'
          : 'pending',
    time:
      index <= currentStage.value
        ? addMinutes(props.issue.time, stage.minutes)
        : '--',
    recordTitle:
      index === 1 && currentStage.value === 1
        ? '等待审核'
        : stage.recordTitle,
    description:
      index === 1 && currentStage.value === 1
        ? '问题已进入审核队列，等待管理员核验'
        : stage.description,
  })),
)

const maskedContact = computed(() =>
  props.issue.contact
    ? `${props.issue.contact.slice(0, 1)}${'*'.repeat(Math.max(1, props.issue.contact.length - 1))}`
    : '未登记',
)

const currentStatusColor = computed(() => statusColors[props.issue.status])

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

function advanceStatus() {
  if (nextStatus.value) emit('updateStatus', nextStatus.value)
}

function revertStatus() {
  if (previousStatus.value) emit('updateStatus', previousStatus.value)
}

onMounted(async () => {
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <section
    class="issue-detail-page"
    role="dialog"
    aria-modal="true"
    :aria-label="`${issue.id} 问题详情`"
  >
    <div class="issue-detail-page__canvas">
      <header class="issue-detail-page__header">
        <div>
          <i aria-hidden="true" />
          <span>
            <strong>问题详情</strong>
            <small>编号：{{ issue.id }}</small>
          </span>
        </div>
        <button
          ref="closeButton"
          class="detail-close"
          type="button"
          aria-label="关闭问题详情"
          title="关闭（Esc）"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <section class="detail-section process-section">
        <h2>处理流程</h2>
        <div class="process-rail">
          <article
            v-for="(stage, index) in stages"
            :key="stage.label"
            :class="[`is-${stage.state}`, { 'line-complete': index < currentStage }]"
          >
            <div class="process-node">
              <svg
                v-if="stage.icon === 'location'"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
                <circle cx="12" cy="10" r="2.2" />
              </svg>
              <svg
                v-else-if="stage.icon === 'clipboard'"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M9 5h6M9 3h6v4H9zM7 5H5v16h14V5h-2M8 13l2.4 2.4L16 10" />
              </svg>
              <svg
                v-else-if="stage.icon === 'send'"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m22 2-9 20-2.5-8.5L2 11l20-9ZM10.5 13.5 22 2" />
              </svg>
              <svg
                v-else-if="stage.icon === 'clock'"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 2" />
              </svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12 2.7 2.7L16.5 9" />
              </svg>
            </div>
            <strong>{{ stage.label }}</strong>
            <time>{{ stage.time }}</time>
          </article>
        </div>

        <div class="process-statuses" aria-label="切换处置状态">
          <button
            v-for="(status, index) in issueStatuses"
            :key="status"
            type="button"
            :class="{ active: issue.status === status }"
            :style="{ '--status-color': statusColors[status] }"
            @click="emit('updateStatus', status)"
          >
            <small>{{ String(index + 1).padStart(2, '0') }}</small>
            <span>{{ status }}</span>
          </button>
        </div>
        <p class="process-note">
          <span aria-hidden="true">ⓘ</span>
          当前状态：<b :style="{ color: currentStatusColor }">{{ issue.status }}</b>
          <template v-if="nextStatus">，可继续推进至下一阶段</template>
          <template v-else>，问题已完成闭环处置</template>
        </p>
      </section>

      <div class="detail-grid">
        <section class="detail-section issue-profile">
          <h2>问题信息</h2>
          <dl>
            <div>
              <dt>问题类型</dt>
              <dd><em>{{ issue.type }} · {{ issue.subtype }}</em></dd>
            </div>
            <div>
              <dt>所属村庄</dt>
              <dd>{{ issue.town }} · {{ issue.village }}</dd>
            </div>
            <div>
              <dt>上报时间</dt>
              <dd>{{ addMinutes(issue.time, 0) }}</dd>
            </div>
            <div>
              <dt>上报人</dt>
              <dd>
                {{ maskedContact }}（{{ issue.channel }}）
                <a :href="`tel:${issue.phone}`">联系 TA</a>
              </dd>
            </div>
            <div>
              <dt>紧急程度</dt>
              <dd><b :class="`urgency-${issue.urgency}`">{{ issue.urgency }}</b></dd>
            </div>
            <div class="description-row">
              <dt>问题描述</dt>
              <dd>{{ issue.description }}</dd>
            </div>
            <div>
              <dt>位置坐标</dt>
              <dd>
                {{ issue.latitude.toFixed(6) }}, {{ issue.longitude.toFixed(6) }}
                <button type="button" @click="emit('locate')">查看地图</button>
              </dd>
            </div>
          </dl>

          <h3>现场照片</h3>
          <div class="evidence-photos">
            <div
              v-for="index in 3"
              :key="index"
              role="img"
              :aria-label="`现场取证照片 ${index}`"
              :style="{
                backgroundImage: `url(${evidencePhotoUrl})`,
                backgroundPosition: `${(index - 1) * 50}% center`,
              }"
            >
              <span>取证 {{ String(index).padStart(2, '0') }}</span>
            </div>
          </div>
        </section>

        <section class="detail-section handling-records">
          <h2>处理记录</h2>
          <ol>
            <li
              v-for="stage in stages"
              :key="stage.label"
              :class="`is-${stage.state}`"
            >
              <i aria-hidden="true" />
              <article>
                <header>
                  <strong>{{ stage.recordTitle }}</strong>
                  <time>{{ stage.time }}</time>
                </header>
                <p>{{ stage.description }}</p>
              </article>
            </li>
          </ol>

          <footer>
            <button
              class="advance-button"
              type="button"
              :disabled="!nextStatus"
              @click="advanceStatus"
            >
              <span aria-hidden="true">→</span>
              {{ nextStatus ? `推进至“${nextStatus}”` : '处置已闭环' }}
            </button>
            <button
              class="revert-button"
              type="button"
              :disabled="!previousStatus"
              @click="revertStatus"
            >
              <span aria-hidden="true">↶</span> 返回上一步
            </button>
          </footer>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.issue-detail-page {
  position: fixed;
  z-index: 4000;
  inset: 0;
  overflow: auto;
  color: var(--text);
  background:
    radial-gradient(circle at 50% 12%, rgba(32, 118, 111, 0.16), transparent 38%),
    linear-gradient(145deg, #071313, #081b1b 56%, #061111);
  font-family: var(--font-body);
}

.issue-detail-page::before {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(61, 214, 196, 0.018) 1px, transparent 1px),
    linear-gradient(90deg, rgba(61, 214, 196, 0.018) 1px, transparent 1px);
  background-size: 44px 44px;
  content: '';
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent 68%);
}

.issue-detail-page__canvas {
  position: relative;
  display: grid;
  width: min(1500px, calc(100% - 48px));
  min-height: 100%;
  margin: 0 auto;
  padding: 18px 0 24px;
  gap: 16px;
  grid-template-rows: auto auto minmax(430px, 1fr);
}

.issue-detail-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 58px;
}

.issue-detail-page__header > div {
  display: flex;
  align-items: center;
  gap: 16px;
}

.issue-detail-page__header > div > i {
  width: 6px;
  height: 44px;
  border-radius: 4px;
  background: linear-gradient(to bottom, #58e7cd, #20c799);
  box-shadow: 0 0 18px rgba(61, 214, 196, 0.42);
}

.issue-detail-page__header span {
  display: grid;
  gap: 3px;
}

.issue-detail-page__header strong {
  font: 700 23px/1.2 var(--font-display);
}

.issue-detail-page__header small {
  color: var(--text-soft);
  font: 13px var(--font-data);
}

.detail-close {
  display: grid;
  width: 42px;
  height: 42px;
  padding: 0 0 4px;
  place-items: center;
  color: var(--text-soft);
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  font: 34px/1 var(--font-body);
  cursor: pointer;
}

.detail-close:hover,
.detail-close:focus-visible {
  color: var(--text);
  border-color: var(--line-bright);
  outline: none;
  background: rgba(61, 214, 196, 0.08);
}

.detail-section {
  min-width: 0;
  border: 1px solid rgba(122, 203, 190, 0.12);
  border-radius: 14px;
  background:
    linear-gradient(145deg, rgba(17, 45, 44, 0.88), rgba(10, 29, 29, 0.9)),
    rgba(13, 31, 31, 0.9);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.2);
}

.detail-section h2 {
  position: relative;
  margin: 0;
  padding-left: 13px;
  font: 700 16px var(--font-display);
}

.detail-section h2::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  border-radius: 3px;
  background: var(--cyan);
  box-shadow: 0 0 8px rgba(61, 214, 196, 0.5);
  content: '';
}

.process-section {
  padding: 18px 30px 14px;
}

.process-rail {
  display: grid;
  margin: 22px 18px 12px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.process-rail article {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 6px;
  color: #6e8987;
  text-align: center;
}

.process-rail article::after {
  position: absolute;
  z-index: 0;
  top: 25px;
  left: calc(50% + 25px);
  width: calc(100% - 50px);
  height: 2px;
  background: repeating-linear-gradient(
    90deg,
    rgba(122, 203, 190, 0.2) 0 7px,
    transparent 7px 13px
  );
  content: '';
}

.process-rail article:last-child::after {
  display: none;
}

.process-rail article.line-complete::after {
  height: 3px;
  background: linear-gradient(90deg, #28d09d, #48a9e9);
  box-shadow: 0 0 10px rgba(61, 214, 196, 0.22);
}

.process-node {
  position: relative;
  z-index: 1;
  display: grid;
  width: 50px;
  height: 50px;
  place-items: center;
  border: 1px solid rgba(122, 203, 190, 0.12);
  border-radius: 50%;
  background: #243d3e;
}

.process-node svg {
  width: 25px;
  height: 25px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.process-rail article > strong {
  font-size: 13px;
}

.process-rail article > time {
  color: #718d89;
  font: 11px var(--font-data);
}

.process-rail .is-complete {
  color: #65e4b1;
}

.process-rail .is-complete .process-node {
  border-color: rgba(69, 224, 166, 0.5);
  background: linear-gradient(145deg, #2ccf98, #168e71);
  box-shadow: 0 0 20px rgba(49, 212, 158, 0.22);
}

.process-rail .is-current {
  color: var(--cyan);
}

.process-rail .is-current .process-node {
  border: 2px solid var(--cyan);
  background: rgba(22, 73, 70, 0.88);
  box-shadow:
    0 0 0 8px rgba(61, 214, 196, 0.06),
    0 0 24px rgba(61, 214, 196, 0.28);
}

.process-statuses {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.process-statuses button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 42px;
  gap: 9px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.2);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.018);
  cursor: pointer;
}

.process-statuses button small {
  color: var(--status-color);
  font: 9px var(--font-data);
}

.process-statuses button span {
  font-size: 12px;
}

.process-statuses button:hover,
.process-statuses button:focus-visible,
.process-statuses button.active {
  color: var(--status-color);
  border-color: var(--status-color);
  outline: none;
  background: color-mix(in srgb, var(--status-color) 10%, transparent);
  box-shadow: inset 0 -2px 0 var(--status-color);
}

.process-note {
  margin: 10px 0 0;
  color: var(--text-soft);
  font-size: 11px;
  text-align: center;
}

.process-note span {
  margin-right: 7px;
  color: var(--cyan);
}

.detail-grid {
  display: grid;
  min-height: 0;
  gap: 16px;
  grid-template-columns: minmax(380px, 0.84fr) minmax(520px, 1.16fr);
}

.issue-profile,
.handling-records {
  display: flex;
  min-height: 0;
  padding: 18px 28px 20px;
  flex-direction: column;
}

.issue-profile dl {
  display: grid;
  gap: 0;
  margin: 14px 0 10px;
}

.issue-profile dl > div {
  display: grid;
  min-height: 34px;
  padding: 7px 3px;
  border-bottom: 1px solid rgba(122, 203, 190, 0.08);
  grid-template-columns: 92px 1fr;
}

.issue-profile dt {
  color: var(--text-soft);
  font-size: 11px;
}

.issue-profile dd {
  margin: 0;
  font-size: 11px;
  line-height: 1.55;
}

.issue-profile dd em {
  padding: 3px 8px;
  color: #ffd0ca;
  border: 1px solid rgba(231, 116, 104, 0.3);
  border-radius: 5px;
  background: rgba(231, 116, 104, 0.13);
  font-style: normal;
}

.issue-profile dd a,
.issue-profile dd button {
  margin-left: 14px;
  padding: 0;
  color: var(--cyan);
  border: 0;
  background: transparent;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.issue-profile dd b {
  display: inline-grid;
  min-width: 26px;
  height: 22px;
  padding: 0 7px;
  place-content: center;
  border-radius: 5px;
  font: 11px var(--font-data);
}

.issue-profile dd b.urgency-高 {
  color: #ffd6d1;
  background: rgba(231, 116, 104, 0.24);
}

.issue-profile dd b.urgency-中 {
  color: #ffe3ad;
  background: rgba(240, 184, 92, 0.22);
}

.issue-profile dd b.urgency-低 {
  color: #cfe2dd;
  background: rgba(109, 169, 237, 0.16);
}

.description-row dd {
  max-width: 520px;
}

.issue-profile h3 {
  margin: auto 0 10px;
  font: 700 13px var(--font-display);
}

.evidence-photos {
  display: grid;
  height: 112px;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.evidence-photos > div {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(122, 203, 190, 0.15);
  border-radius: 8px;
  background-repeat: no-repeat;
  background-size: 300% 100%;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.18);
}

.evidence-photos span {
  position: absolute;
  right: 6px;
  bottom: 5px;
  padding: 3px 5px;
  color: rgba(238, 248, 245, 0.78);
  border-radius: 3px;
  background: rgba(4, 17, 17, 0.72);
  font: 7px var(--font-data);
}

.handling-records ol {
  display: grid;
  flex: 1;
  min-height: 0;
  margin: 14px 0 16px;
  padding: 0 0 0 48px;
  gap: 8px;
  grid-template-rows: repeat(5, minmax(0, 1fr));
  list-style: none;
}

.handling-records li {
  position: relative;
  color: #6e8987;
}

.handling-records li::before {
  position: absolute;
  top: 24px;
  bottom: -13px;
  left: -28px;
  width: 1px;
  background: rgba(122, 203, 190, 0.18);
  content: '';
}

.handling-records li:last-child::before {
  display: none;
}

.handling-records li > i {
  position: absolute;
  top: 15px;
  left: -34px;
  width: 13px;
  height: 13px;
  border: 3px solid #173132;
  border-radius: 50%;
  background: #557071;
}

.handling-records li article {
  padding: 10px 14px;
  border: 1px solid rgba(122, 203, 190, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.018);
}

.handling-records li header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.handling-records li strong {
  font-size: 13px;
}

.handling-records li time {
  font: 10px var(--font-data);
}

.handling-records li p {
  margin: 5px 0 0;
  font-size: 10px;
}

.handling-records li.is-complete,
.handling-records li.is-current {
  color: #44dba7;
}

.handling-records li.is-current {
  color: var(--cyan);
}

.handling-records li.is-complete::before {
  background: linear-gradient(#35d4a0, #56a9e7);
}

.handling-records li.is-complete > i,
.handling-records li.is-current > i {
  background: currentColor;
  box-shadow: 0 0 12px currentColor;
}

.handling-records li.is-current article {
  border-color: rgba(61, 214, 196, 0.32);
  background: rgba(61, 214, 196, 0.055);
}

.handling-records footer {
  display: grid;
  margin-top: auto;
  gap: 12px;
  grid-template-columns: 1.35fr 0.85fr;
}

.handling-records footer button {
  height: 46px;
  border-radius: 7px;
  font: 600 12px var(--font-body);
  cursor: pointer;
}

.handling-records footer button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.advance-button {
  color: #ecfffb;
  border: 1px solid #3fe0c5;
  background: linear-gradient(135deg, #1da293, #20b7a0);
  box-shadow: 0 8px 24px rgba(32, 183, 160, 0.16);
}

.revert-button {
  color: var(--text-soft);
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.035);
}

.advance-button span,
.revert-button span {
  margin-right: 8px;
  font-size: 17px;
}

@media (max-width: 1100px) {
  .issue-detail-page__canvas {
    width: calc(100% - 28px);
    grid-template-rows: auto auto auto;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .process-section,
  .issue-profile,
  .handling-records {
    padding-right: 15px;
    padding-left: 15px;
  }

  .process-rail {
    margin-right: 0;
    margin-left: 0;
  }

  .process-node {
    width: 40px;
    height: 40px;
  }

  .process-rail article::after {
    top: 20px;
    left: calc(50% + 20px);
    width: calc(100% - 40px);
  }

  .process-rail article > strong {
    font-size: 10px;
  }

  .process-rail article > time {
    display: none;
  }

  .process-statuses {
    grid-template-columns: repeat(2, 1fr);
  }

  .issue-profile dl > div {
    grid-template-columns: 78px 1fr;
  }

  .evidence-photos {
    height: 220px;
    grid-template-columns: 1fr;
  }

  .handling-records footer {
    grid-template-columns: 1fr;
  }
}
</style>
