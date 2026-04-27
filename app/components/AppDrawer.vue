<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

// Bloquear scroll del body cuando el drawer está abierto
watch(() => props.open, (v) => {
  if (import.meta.client) {
    document.body.style.overflow = v ? 'hidden' : ''
  }
})

// ESC cierra
onMounted(() => {
  if (!import.meta.client) return
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.open) emit('close')
  }
  window.addEventListener('keydown', onKey)
  onUnmounted(() => window.removeEventListener('keydown', onKey))
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
        @click="emit('close')"
      />
    </Transition>
    <Transition
      enter-active-class="transition duration-250 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="open"
        class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-bg shadow-xl md:hidden"
        style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);"
      >
        <slot />
      </aside>
    </Transition>
  </Teleport>
</template>
