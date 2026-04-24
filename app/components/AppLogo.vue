<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: number; showText?: boolean }>(), {
  size: 28,
  showText: true,
})
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <!-- Logo Swiss: cuadrado redondeado con fondo acento -->
    <svg
      :width="props.size"
      :height="props.size"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      class="shrink-0"
      aria-hidden="true"
    >
      <rect
        x="0" y="0" width="32" height="32"
        rx="7"
        fill="rgb(var(--color-text))"
      />
      <text
        x="16"
        y="22"
        text-anchor="middle"
        fill="rgb(var(--color-bg))"
        font-family="'Inter', sans-serif"
        font-size="19"
        font-weight="600"
      >
        $
      </text>
    </svg>
    <span
      v-if="showText"
      class="text-base font-semibold tracking-tight leading-none text-text"
    >
      mis-finanzas
    </span>
  </div>
</template>
