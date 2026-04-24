<script setup lang="ts">
defineProps<{
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'positive' | 'negative' | 'accent'
}>()
</script>

<template>
  <div
    class="app-card flex min-w-0 flex-col gap-1 overflow-hidden"
    :class="{
      '!bg-success-bg !border-success/30': tone === 'positive',
      '!bg-danger-bg !border-danger/30': tone === 'negative',
      '!bg-accent-soft !border-accent/30': tone === 'accent',
    }"
  >
    <p class="truncate text-[11px] uppercase tracking-wider text-text-muted">{{ label }}</p>
    <p
      class="mt-0.5 truncate font-mono text-base font-semibold tabular-nums leading-tight sm:text-lg"
      :class="{
        'text-success': tone === 'positive',
        'text-danger': tone === 'negative',
      }"
    >
      {{ value }}
    </p>
    <p v-if="sub" class="truncate text-[11px] text-text-muted">{{ sub }}</p>
  </div>
</template>
