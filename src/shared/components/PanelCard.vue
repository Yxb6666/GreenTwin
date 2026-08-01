<script setup lang="ts">
defineProps<{ title: string; meta?: string }>()
</script>

<template>
  <section class="panel-card panel-frame">
    <header class="panel-card__header">
      <h2>{{ title }}</h2>
      <span v-if="meta">{{ meta }}</span>
      <slot name="action" />
    </header>
    <div class="panel-card__body">
      <slot />
    </div>
  </section>
</template>
