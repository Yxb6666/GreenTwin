<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

const modules = [
  { to: '/master', code: '01', label: '主控大屏' },
  { to: '/sansheng', code: '02', label: '三生空间' },
  { to: '/twin', code: '03', label: '数字孪生' },
  { to: '/governance', code: '04', label: '乡村治理' },
]
</script>

<template>
  <div class="app-shell">
    <nav class="module-nav" aria-label="平台模块导航">
      <RouterLink v-for="item in modules" :key="item.to" :to="item.to">
        <span>{{ item.code }}</span>
        {{ item.label }}
      </RouterLink>
    </nav>
    <RouterView v-slot="{ Component }">
      <Transition name="module" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>
</template>
