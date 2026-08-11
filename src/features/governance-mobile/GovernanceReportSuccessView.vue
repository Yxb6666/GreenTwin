<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGovernanceIssue, type GovernanceIssue } from '@/api/governance'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import MobileTabBar from './MobileTabBar.vue'
import { formatIssueDate } from './userIssues'

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const issue = ref<GovernanceIssue | null>(null)
const loading = ref(true)
const error = ref('')
const stages = ['待审核', '已派单', '处理中', '已办结']

async function loadIssue() {
  const id = String(route.params.id ?? '')
  if (!id) {
    error.value = '问题编号无效'
    loading.value = false
    return
  }
  try {
    issue.value = await getGovernanceIssue(
      config.apiBaseUrl,
      config.requestTimeoutMs,
      id,
    )
    error.value = ''
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? `${cause.message}。Mock 数据会在开发服务重启后清空。`
        : '问题回执加载失败'
  } finally {
    loading.value = false
  }
}

function openDetail() {
  router.push({
    name: 'governance-mobile-issue-detail',
    params: { id: route.params.id },
    query: { source: 'report' },
  })
}

onMounted(() => loadIssue())
</script>

<template>
  <main class="gm-page gm-success-page">
    <div class="gm-phone-canvas gm-app-canvas">
      <header class="gm-hero gm-success-header">
        <p class="gm-eyebrow">GREENTWIN · 乡村治理</p>
        <h1>上报成功</h1>
      </header>

      <section v-if="loading" class="gm-state-panel">
        <span class="gm-loader" />
        <p>正在生成上报回执…</p>
      </section>

      <section v-else-if="error" class="gm-state-panel is-error">
        <div class="gm-state-icon">!</div>
        <h2>回执暂不可用</h2>
        <p>{{ error }}</p>
        <button class="gm-primary-button" type="button" @click="router.push('/governance/mobile/report')">
          返回问题上报
        </button>
      </section>

      <div v-else-if="issue" class="gm-success-content">
        <section class="gm-success-intro">
          <div class="gm-checkmark" aria-hidden="true">
            <svg viewBox="0 0 64 64"><path d="m17 33 10 10 21-23" /></svg>
          </div>
          <div class="gm-confetti" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <h2>感谢您的上报！</h2>
          <p>我们已经收到您提交的问题<br />工作人员将尽快审核处理</p>
        </section>

        <section class="gm-receipt-card">
          <dl>
            <div><dt>问题编号</dt><dd class="is-id">{{ issue.id }}</dd></div>
            <div><dt>上报时间</dt><dd>{{ formatIssueDate(issue.time, true) }}</dd></div>
            <div><dt>问题类型</dt><dd>{{ issue.type }} - {{ issue.subtype }}</dd></div>
            <div><dt>所属位置</dt><dd>{{ issue.town }} / {{ issue.village }}</dd></div>
            <div><dt>当前状态</dt><dd><span class="gm-status">{{ issue.status }}</span></dd></div>
          </dl>
        </section>

        <section class="gm-process-card">
          <h2>处理流程</h2>
          <ol>
            <li v-for="(stage, index) in stages" :key="stage" :class="{ active: index === 0 }">
              <span>
                <svg v-if="index === 0" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12.5 10.5 16 17 8" /></svg>
                <b v-else>{{ index + 1 }}</b>
              </span>
              <small>{{ stage }}</small>
            </li>
          </ol>
        </section>

        <div class="gm-success-actions">
          <button class="gm-primary-button" type="button" @click="openDetail">
            查看我的上报
          </button>
          <button class="gm-secondary-button" type="button" @click="router.push('/governance/mobile/report')">
            继续上报其他问题
          </button>
        </div>
      </div>
      <MobileTabBar active="report" />
    </div>
  </main>
</template>

<style src="./mobile.css"></style>
