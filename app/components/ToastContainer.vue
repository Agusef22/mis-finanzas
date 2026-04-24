<script setup lang="ts">
import { Info, CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-vue-next'

const { toasts, dismiss } = useToast()

const iconFor = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:left-auto md:right-6 md:items-end"
    >
      <TransitionGroup
        enter-active-class="transition duration-250 ease-out"
        enter-from-class="opacity-0 translate-y-2 sm:translate-x-4 sm:translate-y-0"
        enter-to-class="opacity-100 translate-y-0 sm:translate-x-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-lg backdrop-blur"
          :class="{
            'border-accent/30': t.variant === 'info',
            'border-success/40 bg-success-bg/90': t.variant === 'success',
            'border-danger/40 bg-danger-bg/90': t.variant === 'error',
            'border-warning/40 bg-warning-bg/90': t.variant === 'warning',
          }"
        >
          <component
            :is="iconFor[t.variant]"
            :size="18"
            class="mt-0.5 shrink-0"
            :class="{
              'text-accent': t.variant === 'info',
              'text-success': t.variant === 'success',
              'text-danger': t.variant === 'error',
              'text-warning': t.variant === 'warning',
            }"
          />
          <p class="flex-1 text-sm leading-snug">{{ t.message }}</p>
          <button
            class="text-text-muted hover:text-text -m-1 p-1"
            :aria-label="'Cerrar'"
            @click="dismiss(t.id)"
          >
            <X :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
