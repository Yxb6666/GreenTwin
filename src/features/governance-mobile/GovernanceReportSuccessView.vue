<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGovernanceIssue, type GovernanceIssue } from '@/api/governance'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const issue = ref<GovernanceIssue | null>(null)
const loading = ref(true)
const error = ref('')
const detailOpen = ref(false)
const refreshing = ref(false)
const stages = ['待审核', '已派单', '处理中', '已办结']

function formatTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\//g, '-')
}

async function loadIssue(showDetail = false) {
  const id = String(route.params.id ?? '')
  if (!id) {
    error.value = '问题编号无效'
    loading.value = false
    return
  }
  refreshing.value = showDetail
  try {
    issue.value = await getGovernanceIssue(
      config.apiBaseUrl,
      config.requestTimeoutMs,
      id,
    )
    error.value = ''
    if (showDetail) detailOpen.value = true
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? `${cause.message}。Mock 数据会在开发服务重启后清空。`
        : '问题回执加载失败'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(() => loadIssue())
</script>

<template>
  <main class="gm-page gm-success-page">
    <div class="gm-phone-canvas">
      <header class="gm-hero gm-success-header">
        <button class="gm-home" type="button" aria-label="返回登录页" @click="router.push('/governance/report')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8v9h-6v-6H9v6H3z" /></svg>
        </button>
        <p class="gm-eyebrow">GREENTWIN · 乡村治理</p>
        <h1>{{ detailOpen ? '我的上报' : '上报成功' }}</h1>
      </header>

      <section v-if="loading" class="gm-state-panel">
        <span class="gm-loader" />
        <p>正在生成上报回执…</p>
      </section>

      <section v-else-if="error" class="gm-state-panel is-error">
        <div class="gm-state-icon">!</div>
        <h2>回执暂不可用</h2>
        <p>{{ error }}</p>
        <button class="gm-primary-button" type="button" @click="router.push('/governance/report/form')">
          返回问题上报
        </button>
      </section>

      <div v-else-if="issue" class="gm-success-content">
        <section class="gm-success-intro">
          <div class="gm-checkmark" aria-hidden="true">
            <svg viewBox="0 0 64 64"><path d="m17 33 10 10 21-23" /></svg>
          </div>
          <div class="gm-confetti" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <h2>{{ detailOpen ? '问题上报详情' : '感谢您的上报！' }}</h2>
          <p v-if="!detailOpen">我们已经收到您提交的问题<br />工作人员将尽快审核处理</p>
        </section>

        <section class="gm-receipt-card">
          <dl>
            <div><dt>问题编号</dt><dd class="is-id">{{ issue.id }}</dd></div>
            <div><dt>上报时间</dt><dd>{{ formatTime(issue.time) }}</dd></div>
            <div><dt>问题类型</dt><dd>{{ issue.type }} - {{ issue.subtype }}</dd></div>
            <div><dt>所属位置</dt><dd>{{ issue.town }} / {{ issue.village }}</dd></div>
            <div><dt>当前状态</dt><dd><span class="gm-status">{{ issue.status }}</span></dd></div>
          </dl>
        </section>

        <section v-if="detailOpen" class="gm-detail-card">
          <h2><i />上报内容</h2>
          <dl>
            <div><dt>问题描述</dt><dd>{{ issue.description }}</dd></div>
            <div><dt>位置坐标</dt><dd>{{ issue.longitude.toFixed(6) }}, {{ issue.latitude.toFixed(6) }}</dd></div>
            <div><dt>联系人</dt><dd>{{ issue.contact }}</dd></div>
            <div><dt>联系电话</dt><dd>{{ issue.phone }}</dd></div>
            <div><dt>现场照片</dt><dd>{{ issue.images.length }} 张</dd></div>
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
          <button class="gm-primary-button" type="button" :disabled="refreshing" @click="loadIssue(true)">
            {{ refreshing ? '正在刷新…' : detailOpen ? '刷新我的上报' : '查看我的上报' }}
          </button>
          <button class="gm-secondary-button" type="button" @click="router.push('/governance/report/form')">
            继续上报其他问题
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style src="./mobile.css"></style>
