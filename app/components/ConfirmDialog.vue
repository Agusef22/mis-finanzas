<script setup lang="ts">
import { AlertTriangle, HelpCircle } from 'lucide-vue-next'

const { state, handleConfirm, handleCancel } = useConfirm()

const options = computed(() => state.value.options)
const isDanger = computed(() => options.value?.variant === 'danger')
const Icon = computed(() => options.value?.icon ?? (isDanger.value ? AlertTriangle : HelpCircle))
</script>

<template>
  <AppDialog :open="state.open" :closable="true" @close="handleCancel">
    <template v-if="options">
      <div class="flex gap-4">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          :class="isDanger ? 'bg-danger-bg text-danger' : 'bg-accent-soft text-accent'"
        >
          <component :is="Icon" :size="22" />
        </div>

        <div class="min-w-0 flex-1 pt-0.5">
          <h3 class="font-serif text-xl leading-tight">
            {{ options.title }}
          </h3>
          <p v-if="options.description" class="mt-2 text-sm text-text-soft">
            {{ options.description }}
          </p>
        </div>
      </div>

      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="app-btn app-btn-secondary"
          @click="handleCancel"
        >
          {{ options.cancelText || 'Cancelar' }}
        </button>
        <button
          type="button"
          class="app-btn"
          :class="isDanger ? 'app-btn-danger' : 'app-btn-primary'"
          @click="handleConfirm"
        >
          {{ options.confirmText || 'Confirmar' }}
        </button>
      </div>
    </template>
  </AppDialog>
</template>
