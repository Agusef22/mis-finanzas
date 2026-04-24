<script setup lang="ts">
import { X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  title?: string
  closable?: boolean
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

function onBackdrop() {
  if (props.closable !== false) emit('close')
}

onMounted(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.open && props.closable !== false) emit('close')
  }
  window.addEventListener('keydown', onKey)
  onUnmounted(() => window.removeEventListener('keydown', onKey))
})

watch(() => props.open, (v) => {
  if (import.meta.client) {
    document.body.style.overflow = v ? 'hidden' : ''
  }
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
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
        @click.self="onBackdrop"
      >
        <div
          class="w-full max-w-md rounded-t-xl bg-surface p-6 shadow-2xl sm:rounded-xl border border-border animate-fade-in"
          @click.stop
        >
          <div v-if="title || closable !== false" class="mb-4 flex items-start justify-between gap-3">
            <h3 v-if="title" class="font-serif text-xl leading-tight">{{ title }}</h3>
            <button
              v-if="closable !== false"
              class="app-btn app-btn-ghost !p-1 -mr-1 -mt-1"
              aria-label="Cerrar"
              @click="emit('close')"
            >
              <X :size="18" />
            </button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
