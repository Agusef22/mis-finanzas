import { useOnline } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'

/**
 * Estado de red + cantidad de mutations pendientes (offline queue).
 */
export function useNetworkStatus() {
  const isOnline = useOnline()
  const qc = useQueryClient()

  // Mutations que están pausadas (esperando internet para enviarse)
  const pendingCount = ref(0)

  function refreshCount() {
    if (!import.meta.client) return
    const mutations = qc.getMutationCache().getAll()
    pendingCount.value = mutations.filter(m => m.state.status === 'pending' || m.state.isPaused).length
  }

  if (import.meta.client) {
    // Re-contar periódicamente (mutations pueden agregarse/removerse)
    const interval = window.setInterval(refreshCount, 1000)
    onScopeDispose(() => window.clearInterval(interval))
    refreshCount()
  }

  return {
    isOnline,
    pendingCount: readonly(pendingCount),
  }
}
