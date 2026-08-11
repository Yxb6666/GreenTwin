<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

type MobileTab = 'home' | 'report' | 'profile'

const props = defineProps<{ active?: MobileTab }>()
const route = useRoute()

const activeTab = computed<MobileTab>(() => {
  if (props.active) return props.active
  if (route.name === 'governance-mobile-report' || route.name === 'governance-mobile-success')
    return 'report'
  if (route.name === 'governance-mobile-profile') return 'profile'
  return 'home'
})

const tabs: Array<{ key: MobileTab; label: string; name: string }> = [
  { key: 'home', label: '首页', name: 'governance-mobile-home' },
  { key: 'report', label: '上报', name: 'governance-mobile-report' },
  { key: 'profile', label: '我的', name: 'governance-mobile-profile' },
]
</script>

<template>
  <nav class="gm-tab-bar" aria-label="移动端主导航">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="{ name: tab.name }"
      :class="{ active: activeTab === tab.key }"
      :aria-current="activeTab === tab.key ? 'page' : undefined"
    >
      <span>
        <svg v-if="tab.key === 'home'" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 11 9-8 9 8v9h-6v-6H9v6H3z" />
        </svg>
        <svg v-else-if="tab.key === 'report'" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v10M7 12h10" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      </span>
      <small>{{ tab.label }}</small>
    </RouterLink>
  </nav>
</template>

<style src="./mobile.css"></style>
