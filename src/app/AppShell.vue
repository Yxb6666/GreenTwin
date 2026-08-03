<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/auth'

const modules = [
  { to: '/master', code: '01', label: '主控大屏' },
  { to: '/sansheng', code: '02', label: '三生空间' },
  { to: '/twin', code: '03', label: '数字孪生' },
  { to: '/governance', code: '04', label: '乡村治理' },
]

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const showPlatformChrome = computed(() => route.name !== 'login')

async function logout() {
  auth.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="app-shell">
    <nav v-if="showPlatformChrome" class="module-nav" aria-label="平台模块导航">
      <RouterLink v-for="item in modules" :key="item.to" :to="item.to">
        <span>{{ item.code }}</span>
        {{ item.label }}
      </RouterLink>
    </nav>
    <div v-if="showPlatformChrome" class="account-nav">
      <span class="account-nav__avatar" aria-hidden="true">{{
        auth.username.slice(0, 1)
      }}</span>
      <span class="account-nav__identity">
        <small>当前账户</small>
        <strong>{{ auth.username }}</strong>
      </span>
      <button
        type="button"
        title="退出登录"
        aria-label="退出登录"
        @click="logout"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"
          />
        </svg>
      </button>
    </div>
    <RouterView v-slot="{ Component }">
      <Transition name="module" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>
</template>
