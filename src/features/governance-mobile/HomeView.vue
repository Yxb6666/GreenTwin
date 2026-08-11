<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listGovernanceIssuesByUser, type GovernanceIssueSummary } from '@/api/governance'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useAuthStore } from '@/features/auth/auth'
import MobileTabBar from './MobileTabBar.vue'

const auth = useAuthStore()
const config = useRuntimeConfig()
const summary = ref<GovernanceIssueSummary>({ total: 0, processing: 0, completed: 0 })
const loading = ref(true)
const message = ref('')

async function loadSummary() {
  try {
    const response = await listGovernanceIssuesByUser(
      config.apiBaseUrl,
      config.requestTimeoutMs,
      auth.username,
    )
    summary.value = response.summary
  } catch (cause) {
    message.value = cause instanceof Error ? cause.message : '治理数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadSummary)
</script>

<template>
  <main class="gm-page gm-shell-page">
    <div class="gm-phone-canvas gm-app-canvas">
      <header class="gm-workbench-hero">
        <p class="gm-eyebrow">GREENTWIN · 乡村治理</p>
        <h1>治理工作台</h1>
        <div class="gm-workbench-user">
          <img src="/branding/greentwin-logo.png" alt="GreenTwin 用户头像" />
          <div>
            <p><strong>{{ auth.username }}</strong><span>乡村治理用户</span></p>
            <small>您好，欢迎参与美丽乡村建设</small>
          </div>
        </div>
      </header>

      <div class="gm-app-content">
        <section class="gm-stat-grid" aria-label="治理统计">
          <article><small>累计上报</small><strong>{{ loading ? '—' : summary.total }}</strong><span>次</span></article>
          <article><small>处理中</small><strong>{{ loading ? '—' : summary.processing }}</strong><span>件</span></article>
          <article><small>已办结</small><strong>{{ loading ? '—' : summary.completed }}</strong><span>件</span></article>
        </section>
        <p v-if="message" class="gm-inline-message">{{ message }}</p>

        <section class="gm-workbench-section">
          <h2><i />快捷服务</h2>
          <div class="gm-service-grid">
            <RouterLink :to="{ name: 'governance-mobile-report' }">
              <span class="is-green"><svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4Zm9-13 4 4M18 5l1-1 2 2-1 1" /></svg></span>
              <strong>问题上报</strong><small>发现问题，随手上报</small><b>→</b>
            </RouterLink>
            <RouterLink :to="{ name: 'governance-mobile-profile' }">
              <span class="is-blue"><svg viewBox="0 0 24 24"><path d="M5 3h14v18H5zM9 8h6M9 12h6M9 16h3" /></svg></span>
              <strong>我的上报</strong><small>查看上报进度与结果</small><b>→</b>
            </RouterLink>
          </div>
        </section>

        <section class="gm-brand-banner">
          <div><p>让每一次发现都有回应</p><span>连接村民与治理平台，共建美好家园</span></div>
        </section>
      </div>
      <MobileTabBar active="home" />
    </div>
  </main>
</template>

<style src="./mobile.css"></style>
