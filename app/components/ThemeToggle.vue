<script setup lang="ts">
import { Sun, Moon, Monitor } from 'lucide-vue-next'

const { mode, toggle } = useTheme()

// `mounted` se vuelve true solo después del hydration en cliente.
// Mientras tanto, renderizamos un placeholder del mismo tamaño
// para evitar layout shift y mismatch de SSR.
const mounted = ref(false)
onMounted(() => { mounted.value = true })

const label = computed(() => `Tema: ${mode.value} (click para cambiar)`)
</script>

<template>
  <button
    v-if="mounted"
    class="app-btn app-btn-ghost !p-2"
    :title="label"
    @click="toggle"
  >
    <Sun v-if="mode === 'light'" :size="18" />
    <Moon v-else-if="mode === 'dark'" :size="18" />
    <Monitor v-else :size="18" />
  </button>
  <!-- Placeholder mientras hidrata -->
  <div v-else class="h-9 w-9" aria-hidden="true" />
</template>
