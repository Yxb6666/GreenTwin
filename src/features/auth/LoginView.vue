<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './auth'

type AuthMode = 'login' | 'register'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const rememberedUsername = auth.getRememberedUsername()

const mode = ref<AuthMode>('login')
const username = ref(rememberedUsername)
const password = ref('')
const confirmPassword = ref('')
const rememberAccount = ref(Boolean(rememberedUsername))
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isSubmitting = ref(false)
const feedback = ref('')

const title = computed(() =>
  mode.value === 'login' ? '欢迎回来' : '创建账户',
)
const description = computed(() =>
  mode.value === 'login'
    ? '验证账户后进入乡村数字孪生决策工作台。'
    : '',
)

function switchMode(nextMode: AuthMode) {
  mode.value = nextMode
  password.value = ''
  confirmPassword.value = ''
  feedback.value = ''
}

function destinationAfterAuth() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' &&
    redirect.startsWith('/') &&
    !redirect.startsWith('//')
    ? redirect
    : '/master'
}

async function submit() {
  if (isSubmitting.value) return
  feedback.value = ''

  if (mode.value === 'register' && password.value !== confirmPassword.value) {
    feedback.value = '两次输入的密码不一致'
    return
  }

  isSubmitting.value = true
  try {
    const result =
      mode.value === 'login'
        ? await auth.login(username.value, password.value)
        : await auth.register(username.value, password.value)

    if (!result.success) {
      feedback.value = result.message
      return
    }

    auth.rememberUsername(rememberAccount.value ? username.value : null)
    await router.replace(destinationAfterAuth())
  } catch {
    feedback.value = '账户验证暂时不可用，请刷新页面后重试'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="auth-title">
      <div class="auth-visual">
        <div class="auth-visual__grid" aria-hidden="true"></div>
        <header class="brand-lockup">
          <div class="brand-mark" aria-hidden="true">
            <img src="/branding/greentwin-logo.png" alt="" />
          </div>
          <div>
            <strong>GreenTwin</strong>
            <span>兰考 · 和美乡村数字孪生</span>
          </div>
        </header>

        <div class="auth-visual__copy">
          <p class="eyebrow"><span></span> 决策空间已就绪</p>
          <h1>看见每一块土地<br />正在发生的变化</h1>
          <p>
            汇集自然资源、产业发展与乡村治理数据，让空间分析成为可执行的决策依据。
          </p>
        </div>

        <div class="twin-map" aria-hidden="true">
          <div class="twin-map__status"><i></i> 数据孪生在线</div>
          <svg viewBox="0 0 620 280" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="parcel-fill" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stop-color="#3dd6c4" stop-opacity=".18" />
                <stop offset="1" stop-color="#78d787" stop-opacity=".03" />
              </linearGradient>
              <filter
                id="node-glow"
                x="-100%"
                y="-100%"
                width="300%"
                height="300%"
              >
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g class="parcel-lines">
              <path
                d="M16 192 98 74l109 25 48-50 116 27 47-37 184 80-23 111-191 30-164-20Z"
              />
              <path
                d="m98 74 38 90 88 76M207 99l43 75 138 86M255 49l-5 125M371 76l17 184M418 39l-30 221M136 164l114 10 168-135M250 174l229 56M371 76l108 154"
              />
              <path
                d="M38 202 162 44M74 227 197 57M438 52l-96 197M477 69l-87 176"
                opacity=".35"
              />
            </g>
            <g class="contour-lines">
              <path d="M35 128c92-62 132-9 220-52s153 7 250 18" />
              <path d="M14 160c95-54 147-8 239-47s168 5 278 24" />
              <path d="M50 213c86-28 137-5 221-34 92-32 167-5 249 15" />
            </g>
            <g class="map-nodes" filter="url(#node-glow)">
              <circle cx="136" cy="164" r="5" />
              <circle cx="250" cy="174" r="5" />
              <circle cx="371" cy="76" r="5" />
              <circle cx="388" cy="260" r="5" />
              <circle cx="479" cy="230" r="5" />
            </g>
            <path
              class="active-parcel"
              d="m207 99 43 75 138 86-17-184-116-27z"
            />
          </svg>
          <div class="twin-map__scan"></div>
          <span class="map-label map-label--one">生态空间</span>
          <span class="map-label map-label--two">生产空间</span>
          <span class="map-label map-label--three">生活空间</span>
        </div>

        <ul class="module-signals" aria-label="平台能力">
          <li><span>01</span> 综合态势</li>
          <li><span>02</span> 三生评价</li>
          <li><span>03</span> 孪生场景</li>
          <li><span>04</span> 乡村治理</li>
        </ul>
      </div>

      <div class="auth-form-panel">
        <div class="auth-form-panel__head">
          <p>GreenTwin 工作台</p>
          <h2 id="auth-title">{{ title }}</h2>
          <span v-if="description">{{ description }}</span>
        </div>

        <div class="auth-tabs" role="tablist" aria-label="账户操作">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'login'"
            :class="{ active: mode === 'login' }"
            @click="switchMode('login')"
          >
            账户登录
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'register'"
            :class="{ active: mode === 'register' }"
            @click="switchMode('register')"
          >
            注册账户
          </button>
        </div>

        <form class="auth-form" @submit.prevent="submit">
          <div class="auth-field">
            <label for="auth-username">账户名称</label>
            <span class="auth-input">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M19 21a7 7 0 0 0-14 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
                />
              </svg>
              <input
                v-model.trim="username"
                id="auth-username"
                name="username"
                autocomplete="username"
                placeholder="请输入账户名称"
                maxlength="24"
                autofocus
              />
            </span>
          </div>

          <div class="auth-field">
            <label for="auth-password">登录密码</label>
            <span class="auth-input">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" />
              </svg>
              <input
                v-model="password"
                id="auth-password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="
                  mode === 'login' ? 'current-password' : 'new-password'
                "
                :placeholder="
                  mode === 'login' ? '请输入登录密码' : '8–64 个字符'
                "
                maxlength="64"
              />
              <button
                type="button"
                class="visibility-toggle"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.6 10.6 0 0 1 12 4c5.5 0 9 8 9 8a18 18 0 0 1-2.1 3.3M6.6 6.6C4.3 8.3 3 12 3 12s3.5 8 9 8a8.7 8.7 0 0 0 3.4-.7"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </span>
          </div>

          <div v-if="mode === 'register'" class="auth-field">
            <label for="auth-confirm-password">确认密码</label>
            <span class="auth-input">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
              <input
                v-model="confirmPassword"
                id="auth-confirm-password"
                name="confirm-password"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="请再次输入密码"
                maxlength="64"
              />
              <button
                type="button"
                class="visibility-toggle"
                :aria-label="
                  showConfirmPassword ? '隐藏确认密码' : '显示确认密码'
                "
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </span>
          </div>

          <div class="auth-options">
            <label
              ><input v-model="rememberAccount" type="checkbox" /><span
                >记住账户名称</span
              ></label
            >
          </div>
          <p v-if="feedback" class="auth-feedback" role="alert">
            {{ feedback }}
          </p>
          <button class="auth-submit" type="submit" :disabled="isSubmitting">
            <span>{{
              isSubmitting
                ? '正在验证…'
                : mode === 'login'
                  ? '进入决策平台'
                  : '创建并进入平台'
            }}</span>
            <svg v-if="!isSubmitting" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M14 7l5 5-5 5" />
            </svg>
            <i v-else aria-hidden="true"></i>
          </button>
        </form>

        <footer>GreenTwin Platform <span>·</span> 2026</footer>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  position: relative;
  z-index: 1;
  display: grid;
  width: 100%;
  min-height: 100%;
  padding: clamp(24px, 4vh, 46px) clamp(22px, 4vw, 72px);
  overflow: auto;
  place-items: center;
  background:
    radial-gradient(
      circle at 12% 8%,
      rgba(61, 214, 196, 0.13),
      transparent 28%
    ),
    radial-gradient(
      circle at 90% 88%,
      rgba(120, 215, 135, 0.08),
      transparent 25%
    );
}
.auth-card {
  display: grid;
  width: min(1180px, 100%);
  min-height: min(690px, calc(100vh - 60px));
  overflow: hidden;
  border: 1px solid rgba(122, 203, 190, 0.22);
  border-radius: 18px;
  grid-template-columns: minmax(0, 1.35fr) minmax(390px, 0.82fr);
  background: rgba(8, 22, 22, 0.9);
  box-shadow: 0 32px 90px rgba(0, 0, 0, 0.44);
}
.auth-visual {
  position: relative;
  display: flex;
  min-width: 0;
  padding: 38px 44px 30px;
  overflow: hidden;
  flex-direction: column;
  isolation: isolate;
  background:
    linear-gradient(145deg, rgba(17, 48, 45, 0.94), rgba(5, 20, 20, 0.96)),
    #071515;
}
.auth-visual::after {
  position: absolute;
  z-index: -1;
  top: -20%;
  right: -18%;
  width: 58%;
  aspect-ratio: 1;
  border: 1px solid rgba(61, 214, 196, 0.08);
  border-radius: 50%;
  content: '';
  box-shadow:
    0 0 0 54px rgba(61, 214, 196, 0.026),
    0 0 0 108px rgba(61, 214, 196, 0.018);
}
.auth-visual__grid {
  position: absolute;
  z-index: -2;
  inset: 0;
  opacity: 0.32;
  background-image:
    linear-gradient(rgba(122, 203, 190, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(122, 203, 190, 0.08) 1px, transparent 1px);
  background-size: 38px 38px;
  mask-image: linear-gradient(135deg, #000, transparent 76%);
}
.brand-lockup {
  display: flex;
  align-items: center;
  gap: 14px;
}
.brand-lockup strong,
.brand-lockup span {
  display: block;
}
.brand-lockup strong {
  font: 600 19px var(--font-body);
  letter-spacing: 0.055em;
}
.brand-lockup span {
  margin-top: 4px;
  color: var(--text-soft);
  font-size: 10px;
  letter-spacing: 0.08em;
}
.brand-mark {
  width: 58px;
  height: 58px;
  overflow: hidden;
  flex: 0 0 auto;
  border: 1px solid rgba(61, 214, 196, 0.34);
  border-radius: 50%;
  background: #0b2b28;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.22),
    0 0 0 3px rgba(61, 214, 196, 0.045);
}
.brand-mark img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  transform: scale(1.04);
}
.auth-visual__copy {
  margin-top: clamp(38px, 7vh, 78px);
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  color: var(--cyan);
  font: 11px var(--font-data);
  letter-spacing: 0.14em;
}
.eyebrow span {
  width: 22px;
  height: 1px;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
}
.auth-visual__copy h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(34px, 3.2vw, 52px);
  font-weight: 680;
  line-height: 1.23;
  letter-spacing: 0.025em;
}
.auth-visual__copy > p:last-child {
  max-width: 510px;
  margin: 18px 0 0;
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.85;
}
.twin-map {
  position: relative;
  height: 220px;
  margin: auto -8px 18px;
  overflow: hidden;
  border: 1px solid rgba(61, 214, 196, 0.16);
  border-radius: 12px;
  background:
    radial-gradient(
      circle at 58% 50%,
      rgba(61, 214, 196, 0.12),
      transparent 42%
    ),
    rgba(2, 15, 15, 0.5);
}
.twin-map svg {
  width: 100%;
  height: 100%;
}
.parcel-lines {
  fill: url('#parcel-fill');
  stroke: rgba(94, 220, 200, 0.5);
  stroke-width: 1;
}
.contour-lines {
  fill: none;
  stroke: rgba(120, 215, 135, 0.22);
  stroke-dasharray: 4 7;
}
.map-nodes {
  fill: #caffd2;
  stroke: var(--green);
}
.active-parcel {
  fill: rgba(61, 214, 196, 0.1);
  stroke: var(--cyan);
  stroke-width: 1.6;
}
.twin-map__status {
  position: absolute;
  z-index: 2;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 9px;
  border: 1px solid rgba(120, 215, 135, 0.2);
  border-radius: 99px;
  color: #bcefc3;
  font: 9px var(--font-data);
  background: rgba(4, 18, 17, 0.8);
}
.twin-map__status i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
}
.twin-map__scan {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 24%;
  width: 1px;
  background: linear-gradient(transparent, var(--cyan), transparent);
  box-shadow: 0 0 16px 2px rgba(61, 214, 196, 0.22);
  animation: map-scan 5.5s ease-in-out infinite alternate;
}
.map-label {
  position: absolute;
  padding: 3px 6px;
  border-left: 1px solid var(--cyan);
  color: rgba(225, 255, 249, 0.78);
  font-size: 9px;
  background: rgba(5, 20, 19, 0.7);
}
.map-label--one {
  top: 42%;
  left: 14%;
}
.map-label--two {
  top: 57%;
  left: 48%;
}
.map-label--three {
  right: 11%;
  bottom: 20%;
}
.module-signals {
  display: grid;
  margin: 0;
  padding: 16px 0 0;
  border-top: 1px solid rgba(122, 203, 190, 0.14);
  list-style: none;
  grid-template-columns: repeat(4, 1fr);
}
.module-signals li {
  color: var(--text-soft);
  font-size: 10px;
  letter-spacing: 0.06em;
}
.module-signals span {
  margin-right: 6px;
  color: rgba(61, 214, 196, 0.72);
  font: 9px var(--font-data);
}
.auth-form-panel {
  display: flex;
  padding: 42px clamp(34px, 3.2vw, 52px) 30px;
  flex-direction: column;
  color: #17302d;
  background:
    linear-gradient(rgba(8, 55, 48, 0.028) 1px, transparent 1px), #f0f6f2;
  background-size: 100% 30px;
}
.auth-form-panel__head {
  margin-top: auto;
}
.auth-form-panel__head > p {
  margin: 0 0 16px;
  color: #52766f;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.auth-form-panel__head h2 {
  margin: 0;
  color: #102925;
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 720;
}
.auth-form-panel__head > span {
  display: block;
  margin-top: 9px;
  color: #68817c;
  font-size: 12px;
  line-height: 1.65;
}
.auth-tabs {
  display: grid;
  margin: 28px 0 24px;
  padding: 4px;
  border: 1px solid rgba(26, 91, 80, 0.12);
  border-radius: 8px;
  grid-template-columns: 1fr 1fr;
  background: rgba(19, 72, 63, 0.045);
}
.auth-tabs button {
  min-height: 36px;
  border: 0;
  border-radius: 5px;
  color: #70847f;
  font-size: 12px;
  background: transparent;
  cursor: pointer;
  transition: 160ms ease;
}
.auth-tabs button.active {
  color: #f2fffb;
  background: #176e61;
  box-shadow: 0 5px 12px rgba(16, 72, 63, 0.18);
}
.auth-form {
  display: grid;
  gap: 17px;
}
.auth-field {
  display: grid;
  gap: 7px;
}
.auth-field > label {
  color: #365d56;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
}
.auth-input {
  position: relative;
  display: flex;
  align-items: center;
}
.auth-input > svg {
  position: absolute;
  left: 13px;
  width: 17px;
  pointer-events: none;
  fill: none;
  stroke: #6b8f88;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}
.auth-input input {
  width: 100%;
  min-height: 46px;
  padding: 0 45px 0 42px;
  border: 1px solid rgba(33, 88, 78, 0.18);
  border-radius: 7px;
  outline: 0;
  color: #17302d;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 2px 9px rgba(20, 57, 50, 0.04);
  transition: 160ms ease;
}
.auth-input input::placeholder {
  color: #9aa9a5;
}
.auth-input input:focus {
  border-color: #208d7e;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(32, 141, 126, 0.11);
}
.visibility-toggle {
  position: absolute;
  right: 8px;
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  place-items: center;
  color: #6b8f88;
  background: transparent;
  cursor: pointer;
}
.visibility-toggle:hover {
  color: #176e61;
  background: rgba(23, 110, 97, 0.07);
}
.visibility-toggle svg {
  width: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}
.auth-options {
  display: flex;
  min-height: 20px;
  align-items: center;
  gap: 12px;
}
.auth-options label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #496861;
  font-size: 11px;
  cursor: pointer;
}
.auth-options input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: #176e61;
}
.auth-feedback {
  margin: -4px 0 0;
  padding: 9px 11px;
  border: 1px solid rgba(184, 70, 59, 0.17);
  border-radius: 6px;
  color: #a13d35;
  font-size: 11px;
  background: rgba(231, 116, 104, 0.08);
}
.auth-submit {
  display: flex;
  width: 100%;
  min-height: 48px;
  margin-top: 1px;
  padding: 0 16px;
  border: 1px solid #176e61;
  border-radius: 7px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #f4fffc;
  font-size: 13px;
  font-weight: 680;
  letter-spacing: 0.04em;
  background: linear-gradient(110deg, #176e61, #208d7e);
  box-shadow: 0 10px 24px rgba(23, 110, 97, 0.2);
  cursor: pointer;
  transition: 160ms ease;
}
.auth-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 13px 28px rgba(23, 110, 97, 0.26);
}
.auth-submit:disabled {
  opacity: 0.72;
  cursor: wait;
}
.auth-submit svg {
  width: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}
.auth-submit i {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.42);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
.auth-form-panel footer {
  margin-top: auto;
  padding-top: 22px;
  color: #8ca09b;
  font: 9px var(--font-data);
  text-align: center;
  letter-spacing: 0.08em;
}
.auth-form-panel footer span {
  margin: 0 5px;
  color: #67a096;
}
@keyframes map-scan {
  to {
    left: 78%;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 980px) {
  .auth-page {
    align-items: start;
    padding: 18px;
  }
  .auth-card {
    min-height: auto;
    grid-template-columns: 1fr;
  }
  .auth-visual {
    min-height: 290px;
    padding: 28px 30px;
  }
  .auth-visual__copy {
    margin-top: 38px;
  }
  .auth-visual__copy h1 {
    font-size: clamp(30px, 7vw, 44px);
  }
  .twin-map {
    position: absolute;
    right: 22px;
    bottom: 24px;
    width: 46%;
    height: 142px;
    margin: 0;
    opacity: 0.82;
  }
  .module-signals {
    width: 48%;
    margin-top: auto;
    grid-template-columns: repeat(2, 1fr);
    row-gap: 8px;
  }
  .auth-form-panel {
    padding: 34px clamp(24px, 7vw, 70px) 26px;
  }
}
@media (max-width: 620px) {
  .auth-page {
    padding: 0;
  }
  .auth-card {
    width: 100%;
    border: 0;
    border-radius: 0;
  }
  .auth-visual {
    min-height: 218px;
    padding: 24px;
  }
  .brand-lockup span,
  .twin-map,
  .module-signals,
  .auth-visual__copy > p:last-child {
    display: none;
  }
  .auth-visual__copy {
    margin-top: 30px;
  }
  .auth-visual__copy h1 {
    font-size: 30px;
  }
  .auth-form-panel {
    min-height: calc(100vh - 218px);
    padding: 28px 22px 22px;
  }
  .auth-options {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
