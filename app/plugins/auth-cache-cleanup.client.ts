import type { QueryClient } from '@tanstack/vue-query'

/**
 * Plugin de seguridad anti data-leak entre usuarios.
 *
 * Por qué un plugin y no un watcher en el layout:
 * - El layout "default" se DESMONTA cuando vas a /login (que usa layout "auth")
 * - Cuando volvés al default, el watcher arranca con `lastUserId = null`
 * - Por eso el flujo logout → login con otro user nunca disparaba la limpieza
 *
 * Este plugin se monta UNA SOLA VEZ por sesión del browser y usa localStorage
 * para persistir el último user.id visto. Garantiza que cualquier cambio
 * de user.id (incluso atravesando /login) limpie el cache de TanStack Query.
 */
export default defineNuxtPlugin({
  name: 'auth-cache-cleanup',
  dependsOn: ['vue-query'],
  setup(nuxtApp) {
    const user = useSupabaseUser()
    const qc = nuxtApp.$queryClient as QueryClient

    const STORAGE_KEY = 'mis-finanzas-last-user-id'

    // Lee el último user_id visto (persiste entre refreshes del browser)
    let lastSeenUserId: string | null = null
    try {
      lastSeenUserId = localStorage.getItem(STORAGE_KEY)
    } catch {}

    // Helper para guardar el user_id actual en localStorage
    function persistUserId(id: string | null) {
      try {
        if (id) localStorage.setItem(STORAGE_KEY, id)
        else localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }

    // Chequeo INICIAL al cargar la app:
    // Si el user actual difiere del último visto, limpiar cache antes que cualquier
    // componente lea data stale.
    const currentInitialId = user.value?.id ?? null
    if (lastSeenUserId && currentInitialId && lastSeenUserId !== currentInitialId) {
      console.warn('[auth-cleanup] User cambió desde la última sesión:', lastSeenUserId, '→', currentInitialId, '— limpiando cache')
      qc.clear()
    }
    if (lastSeenUserId !== currentInitialId) {
      lastSeenUserId = currentInitialId
      persistUserId(currentInitialId)
    }

    // Watcher: cualquier cambio futuro de user.id durante la sesión
    watch(user, (u) => {
      const currentId = u?.id ?? null

      if (lastSeenUserId !== currentId) {
        console.warn('[auth-cleanup] User changed during session:', lastSeenUserId, '→', currentId)

        // Clear queries solo si había un user previo distinto
        // (el primer login después de logout también dispara esto, lo cual es correcto)
        if (lastSeenUserId !== null) {
          qc.clear()
        }

        lastSeenUserId = currentId
        persistUserId(currentId)
      }
    })
  },
})
