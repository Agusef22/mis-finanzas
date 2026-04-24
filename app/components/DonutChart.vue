<script setup lang="ts">
/**
 * Donut chart en SVG puro. Zero dependencies.
 *
 * Props:
 *   data: [{ label, value, color, icon? }]
 *   size: diámetro en px (default 180)
 *   thickness: grosor del anillo (default 28)
 *   currency: para formatear el tooltip
 */
import { formatCurrency } from '~/utils/format'

interface DonutSlice {
  label: string
  value: number
  color: string
  icon?: string | null
}

const props = withDefaults(defineProps<{
  data: DonutSlice[]
  size?: number
  thickness?: number
  currency?: string
  centerLabel?: string
}>(), {
  size: 180,
  thickness: 28,
  currency: 'ARS',
  centerLabel: '',
})

const hovered = ref<number | null>(null)

const radius = computed(() => (props.size - props.thickness) / 2)
const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

const total = computed(() => props.data.reduce((sum, s) => sum + s.value, 0))

// Segmentos con sus offsets para el SVG stroke-dasharray trick
const segments = computed(() => {
  if (total.value === 0) return []
  let acc = 0
  return props.data.map((s, i) => {
    const fraction = s.value / total.value
    const length = fraction * circumference.value
    const segment = {
      ...s,
      index: i,
      fraction,
      strokeDasharray: `${length} ${circumference.value - length}`,
      strokeDashoffset: -acc,
    }
    acc += length
    return segment
  })
})

const hoveredSlice = computed(() =>
  hovered.value !== null ? props.data[hovered.value] : null,
)

const displayValue = computed(() => {
  if (hoveredSlice.value) return formatCurrency(hoveredSlice.value.value, props.currency)
  return formatCurrency(total.value, props.currency)
})

const displayLabel = computed(() => {
  if (hoveredSlice.value) return hoveredSlice.value.label
  return props.centerLabel || 'Total'
})

const displayPct = computed(() => {
  if (hoveredSlice.value && total.value > 0) {
    return `${((hoveredSlice.value.value / total.value) * 100).toFixed(1)}%`
  }
  return null
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
    <div class="relative" :style="{ width: size + 'px', height: size + 'px' }">
      <svg
        :width="size"
        :height="size"
        :viewBox="`0 0 ${size} ${size}`"
        class="-rotate-90"
      >
        <!-- Fondo del track (cuando no hay data) -->
        <circle
          v-if="total === 0"
          :cx="cx"
          :cy="cy"
          :r="radius"
          fill="none"
          :stroke="'rgb(var(--color-border))'"
          :stroke-width="thickness"
        />
        <!-- Segmentos -->
        <circle
          v-for="s in segments"
          :key="s.index"
          :cx="cx"
          :cy="cy"
          :r="radius"
          fill="none"
          :stroke="s.color"
          :stroke-width="thickness"
          :stroke-dasharray="s.strokeDasharray"
          :stroke-dashoffset="s.strokeDashoffset"
          :opacity="hovered === null || hovered === s.index ? 1 : 0.35"
          class="cursor-pointer transition-opacity"
          @mouseenter="hovered = s.index"
          @mouseleave="hovered = null"
        >
          <title>{{ s.label }}: {{ formatCurrency(s.value, currency) }}</title>
        </circle>
      </svg>

      <!-- Centro -->
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <p class="text-[10px] uppercase tracking-wider text-text-muted">
          {{ displayLabel }}
        </p>
        <p class="mt-0.5 font-mono text-sm font-semibold tabular-nums">
          {{ displayValue }}
        </p>
        <p v-if="displayPct" class="text-[10px] text-text-muted tabular-nums">
          {{ displayPct }}
        </p>
      </div>
    </div>

    <!-- Leyenda -->
    <ul v-if="data.length" class="flex-1 space-y-1.5 text-xs min-w-0">
      <li
        v-for="(s, i) in data"
        :key="i"
        class="flex items-center gap-2 cursor-pointer rounded px-1.5 py-0.5 transition"
        :class="{ 'bg-elevated': hovered === i, 'opacity-50': hovered !== null && hovered !== i }"
        @mouseenter="hovered = i"
        @mouseleave="hovered = null"
      >
        <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: s.color }" />
        <span v-if="s.icon" class="shrink-0 text-sm leading-none">{{ s.icon }}</span>
        <span class="flex-1 truncate">{{ s.label }}</span>
        <span class="font-mono tabular-nums text-text-muted shrink-0">
          {{ total > 0 ? ((s.value / total) * 100).toFixed(0) : 0 }}%
        </span>
      </li>
    </ul>
  </div>
</template>
