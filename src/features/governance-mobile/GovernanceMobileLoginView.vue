<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/auth'

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
const submitting = ref(false)
const feedback = ref('')

const submitLabel = computed(() =>
  mode.value === 'login' ? '登录进入治理服务' : '创建账号并进入治理服务',
)

function switchMode(nextMode: AuthMode) {
  mode.value = nextMode
  password.value = ''
  confirmPassword.value = ''
  showPassword.value = false
  showConfirmPassword.value = false
  feedback.value = ''
}

function destinationAfterAuth() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' &&
    redirect.startsWith('/governance/mobile/') &&
    !redirect.startsWith('//')
    ? redirect
    : '/governance/mobile/home'
}

async function submit() {
  if (submitting.value) return
  feedback.value = ''

  if (mode.value === 'register' && password.value !== confirmPassword.value) {
    feedback.value = '两次输入的密码不一致'
    return
  }

  submitting.value = true
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
    feedback.value = '账户验证暂时不可用，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="gm-page gm-login-page">
    <div class="gm-phone-canvas gm-login-canvas">
      <section class="gm-login-hero" aria-labelledby="mobile-login-title">
        <div class="gm-login-grid" aria-hidden="true" />
        <header class="gm-login-brand">
          <span class="gm-login-logo"><img src="/branding/greentwin-logo.png" alt="" /></span>
          <strong>GreenTwin</strong>
          <small>兰考 · 和美乡村数字治理</small>
        </header>

        <div class="gm-login-copy">
          <p><i />乡村治理移动端</p>
          <h1 id="mobile-login-title">让每一次发现<br />都有回应</h1>
          <span>连接村民与治理平台，让问题上报、空间定位和处置反馈形成闭环。</span>
        </div>

        <div class="gm-login-landscape" aria-hidden="true" />
      </section>

      <section class="gm-login-panel">
        <div class="gm-login-tabs" role="tablist" aria-label="账户操作">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'login'"
            :class="{ active: mode === 'login' }"
            @click="switchMode('login')"
          >
            账号登录
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'register'"
            :class="{ active: mode === 'register' }"
            @click="switchMode('register')"
          >
            注册账号
          </button>
        </div>

        <form class="gm-login-form" novalidate @submit.prevent="submit">
          <label class="gm-login-field" for="gm-login-username">
            <span>账号名称</span>
            <i class="gm-login-input">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 21a7 7 0 0 0-14 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
              </svg>
              <input
                id="gm-login-username"
                v-model.trim="username"
                name="username"
                autocomplete="username"
                maxlength="24"
                placeholder="请输入账号名称"
              />
            </i>
          </label>

          <label class="gm-login-field" for="gm-login-password">
            <span>{{ mode === 'login' ? '登录密码' : '设置密码' }}</span>
            <i class="gm-login-input">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" />
              </svg>
              <input
                id="gm-login-password"
                v-model="password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                maxlength="64"
                :placeholder="mode === 'login' ? '请输入登录密码' : '请输入 8–64 位密码'"
              />
              <button
                type="button"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </i>
          </label>

          <label v-if="mode === 'register'" class="gm-login-field" for="gm-login-confirm">
            <span>确认密码</span>
            <i class="gm-login-input">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
              <input
                id="gm-login-confirm"
                v-model="confirmPassword"
                name="confirm-password"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                maxlength="64"
                placeholder="请再次输入密码"
              />
              <button
                type="button"
                :aria-label="showConfirmPassword ? '隐藏确认密码' : '显示确认密码'"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </i>
          </label>

          <label class="gm-login-remember">
            <input v-model="rememberAccount" type="checkbox" />
            <span>记住账号</span>
          </label>

          <p v-if="feedback" class="gm-login-feedback" role="alert">{{ feedback }}</p>

          <button class="gm-login-submit" type="submit" :disabled="submitting">
            <span>{{ submitting ? '正在验证…' : submitLabel }}</span>
            <svg v-if="!submitting" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M14 7l5 5-5 5" />
            </svg>
            <i v-else aria-hidden="true" />
          </button>
        </form>
      </section>

      <footer class="gm-login-footer">GreenTwin Platform <i /> 2026</footer>
    </div>
  </main>
</template>

<style src="./mobile.css"></style>
