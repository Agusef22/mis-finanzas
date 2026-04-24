<script setup lang="ts">
import { WifiOff, CloudOff, CheckCircle2 } from 'lucide-vue-next'

const { isOnline, pendingCount } = useNetworkStatus()

// Mostrar el banner verde de "todo sincronizado" solo brevemente cuando vuelve internet
const justCameBackOnline = ref(false)
watch(isOnline, (online, wasOnline) => {
  if (online && wasOnline === false) {
    justCameBackOnline.value = true
    setTimeout(() => { justCameBackOnline.value = false }, 3000)
  }
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-200"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="!isOnline"
      class="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warning-bg px-3 py-1.5 text-xs font-medium text-warning"
    >
      <WifiOff :size="14" />
      <span>Sin conexión</span>
      <span v-if="pendingCount > 0" class="rounded-full bg-warning/20 px-2 py-0.5">
        {{ pendingCount }} pendiente{{ pendingCount === 1 ? '' : 's' }}
      </span>
    </div>
    <div
      v-else-if="justCameBackOnline && pendingCount > 0"
      class="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent"
    >
      <CloudOff :size="14" />
      <span>Sincronizando {{ pendingCount }} cambio{{ pendingCount === 1 ? '' : 's' }}…</span>
    </div>
    <div
      v-else-if="justCameBackOnline"
      class="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-success-bg px-3 py-1.5 text-xs font-medium text-success"
    >
      <CheckCircle2 :size="14" />
      <span>Conectado · sincronizado</span>
    </div>
  </Transition>
</template>
