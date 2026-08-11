<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  listGovernanceIssuesByUser,
  type GovernanceIssue,
  type GovernanceIssueSummary,
} from '@/api/governance'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useAuthStore } from '@/features/auth/auth'
import MobileTabBar from './MobileTabBar.vue'
import { formatIssueDate, maskPhone, statusClass } from './userIssues'

const auth = useAuthStore()
const config = useRuntimeConfig()
const router = useRouter()
const issues = ref<GovernanceIssue[]>([])
const summary = ref<GovernanceIssueSummary>({ total: 0, processing: 0, completed: 0 })
const loading = ref(true)
const error = ref('')
const latest = computed(() => issues.value[0])
const passwordVisible = ref(false)
const passwordValue = ref('')
const passwordError = ref('')
const phoneVisible = ref(false)
const phoneValue = computed(() => latest.value?.phone ?? '')

async function togglePassword() {
  if (passwordVisible.value) {
    passwordVisible.value = false
    passwordValue.value = ''
    return
  }
  try {
    passwordValue.value = await auth.getCurrentPassword()
    passwordVisible.value = true
    passwordError.value = ''
  } catch (cause) {
    passwordError.value = cause instanceof Error ? cause.message : '密码暂时无法查看'
  }
}

function togglePhone() {
  if (phoneValue.value) phoneVisible.value = !phoneVisible.value
}

async function loadIssues() {
  loading.value = true
  try {
    const response = await listGovernanceIssuesByUser(
      config.apiBaseUrl,
      config.requestTimeoutMs,
      auth.username,
    )
    issues.value = response.issues
    summary.value = response.summary
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '个人数据加载失败'
  } finally {
    loading.value = false
  }
}

function openIssue(id: string) {
  router.push({ name: 'governance-mobile-issue-detail', params: { id }, query: { source: 'profile' } })
}

async function logout() {
  passwordVisible.value = false
  passwordValue.value = ''
  auth.logout()
  await router.replace({ name: 'governance-mobile-login' })
}

onMounted(loadIssues)
onBeforeUnmount(() => {
  passwordVisible.value = false
  passwordValue.value = ''
})
</script>

<template>
  <main class="gm-page gm-shell-page">
    <div class="gm-phone-canvas gm-app-canvas">
      <header class="gm-profile-hero">
        <p class="gm-eyebrow">GREENTWIN · 乡村治理</p>
        <h1>个人中心</h1>
        <img src="/branding/greentwin-logo.png" alt="用户头像" />
        <strong>{{ auth.username }}</strong>
        <span>乡村治理用户</span>
      </header>

      <div class="gm-app-content gm-profile-content">
        <section class="gm-profile-card">
          <h2><i />个人资料</h2>
          <dl>
            <div><dt>账号</dt><dd>{{ auth.username }}</dd></div>
            <div>
              <dt>密码</dt>
              <dd class="gm-sensitive-value">
                <span>{{ passwordVisible ? passwordValue : '••••••••' }}</span>
                <button
                  type="button"
                  :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
                  :aria-pressed="passwordVisible"
                  @click="togglePassword"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
                    <circle cx="12" cy="12" r="3" />
                    <path v-if="!passwordVisible" d="m4 4 16 16" />
                  </svg>
                </button>
              </dd>
            </div>
            <div>
              <dt>手机号</dt>
              <dd class="gm-sensitive-value">
                <span>{{ phoneValue ? (phoneVisible ? phoneValue : maskPhone(phoneValue)) : '暂无上报信息' }}</span>
                <button
                  type="button"
                  :disabled="!phoneValue"
                  :aria-label="phoneVisible ? '隐藏手机号' : '显示手机号'"
                  :aria-pressed="phoneVisible"
                  @click="togglePhone"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
                    <circle cx="12" cy="12" r="3" />
                    <path v-if="!phoneVisible" d="m4 4 16 16" />
                  </svg>
                </button>
              </dd>
            </div>
          </dl>
          <p v-if="passwordError" class="gm-profile-error">{{ passwordError }}</p>
        </section>

        <section class="gm-stat-grid" aria-label="我的上报统计">
          <article><small>我的上报</small><strong>{{ loading ? '—' : summary.total }}</strong><span>件</span></article>
          <article><small>处理中</small><strong>{{ loading ? '—' : summary.processing }}</strong><span>件</span></article>
          <article><small>已完成</small><strong>{{ loading ? '—' : summary.completed }}</strong><span>件</span></article>
        </section>

        <section class="gm-history-section">
          <h2><i />我的上报</h2>
          <p v-if="error" class="gm-inline-message">{{ error }}</p>
          <div v-else-if="loading" class="gm-list-state">正在加载上报记录…</div>
          <div v-else-if="!issues.length" class="gm-list-state">
            <strong>暂无上报记录</strong><span>发现乡村治理问题后，可前往“上报”提交</span>
          </div>
          <button
            v-for="issue in issues"
            v-else
            :key="issue.id"
            class="gm-history-item"
            type="button"
            @click="openIssue(issue.id)"
          >
            <span><strong>{{ issue.type }} · {{ issue.subtype }}</strong><small>{{ issue.id }} · {{ formatIssueDate(issue.time) }}</small></span>
            <em :class="statusClass(issue.status)">{{ issue.status }}</em>
            <b>›</b>
          </button>
        </section>

        <button class="gm-logout-button" type="button" @click="logout">退出当前账号</button>
      </div>
      <MobileTabBar active="profile" />
    </div>
  </main>
</template>

<style src="./mobile.css"></style>
