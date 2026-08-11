<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
const source = computed<'report' | 'profile'>(() =>
  route.query.source === 'report' ? 'report' : 'profile',
)

async function loadIssue() {
  try {
    issue.value = await getGovernanceIssue(
      config.apiBaseUrl,
      config.requestTimeoutMs,
      String(route.params.id ?? ''),
    )
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '问题详情加载失败'
  } finally {
    loading.value = false
  }
}

function returnToSource() {
  router.push({
    name: source.value === 'report' ? 'governance-mobile-report' : 'governance-mobile-profile',
  })
}

onMounted(loadIssue)
</script>

<template>
  <main class="gm-page gm-shell-page">
    <div class="gm-phone-canvas gm-app-canvas">
      <header class="gm-detail-hero">
        <button type="button" aria-label="返回来源页面" @click="returnToSource">‹</button>
        <p class="gm-eyebrow">GREENTWIN · 乡村治理</p>
        <h1>问题详情</h1>
      </header>

      <div class="gm-app-content gm-detail-content">
        <section v-if="loading" class="gm-list-state">正在加载问题详情…</section>
        <section v-else-if="error" class="gm-list-state is-error">
          <strong>详情暂不可用</strong><span>{{ error }}。开发服务重启后，Mock 新增记录会清空。</span>
          <button type="button" @click="returnToSource">返回</button>
        </section>
        <template v-else-if="issue">
          <section class="gm-detail-summary">
            <span>{{ issue.status }}</span>
            <strong>{{ issue.type }} · {{ issue.subtype }}</strong>
            <small>{{ issue.id }}</small>
          </section>
          <section class="gm-detail-card">
            <h2><i />上报信息</h2>
            <dl>
              <div><dt>上报时间</dt><dd>{{ formatIssueDate(issue.time, true) }}</dd></div>
              <div><dt>所属位置</dt><dd>{{ issue.town }} / {{ issue.village }}</dd></div>
              <div><dt>问题描述</dt><dd>{{ issue.description }}</dd></div>
              <div><dt>位置坐标</dt><dd>{{ issue.longitude.toFixed(6) }}, {{ issue.latitude.toFixed(6) }}</dd></div>
              <div><dt>联系人</dt><dd>{{ issue.contact }}</dd></div>
              <div><dt>联系电话</dt><dd>{{ issue.phone }}</dd></div>
              <div><dt>现场照片</dt><dd>{{ issue.images.length }} 张</dd></div>
            </dl>
          </section>
        </template>
      </div>
      <MobileTabBar :active="source" />
    </div>
  </main>
</template>

<style src="./mobile.css"></style>
