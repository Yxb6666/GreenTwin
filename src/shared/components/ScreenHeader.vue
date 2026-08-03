<script setup lang="ts">
import { useClock } from '@/shared/composables/useClock'

defineProps<{
  title: string
  subtitle: string
}>()

const now = useClock()
</script>

<template>
  <header class="screen-header panel-frame">
    <div class="screen-header__title">
      <h1>{{ title }}</h1>
      <p>{{ subtitle }}</p>
    </div>
    <div class="screen-header__time">
      <span></span>
      <strong>{{ now }}</strong>
    </div>
  </header>
</template>
