import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'

/**
 * Cliente TanStack Query con soporte para mutations offline.
 *
 * Nota: NO persistimos el cache en IndexedDB porque causa hydration
 * mismatches al hacer refresh (server render sin data, cliente con data
 * del cache → Vue re-renderiza el DOM y queda desacomodado).
 *
 * Lo que sí mantenemos:
 *   - networkMode: 'offlineFirst' → optimistic updates funcionan offline
 *   - Cola de mutations pausadas → se reanudan cuando vuelve internet
 *   - Refetch al volver online
 *
 * Si en el futuro querés offline read, la solución correcta es usar
 * <ClientOnly> en páginas con queries y re-habilitar persistQueryClient.
 */
export default defineNuxtPlugin({
  name: 'vue-query',
  parallel: false,
  setup(nuxt) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5,
          gcTime: 1000 * 60 * 60,       // 1h en memoria (suficiente para navegar)
          refetchOnWindowFocus: true,
          retry: 2,
          networkMode: 'offlineFirst',
        },
        mutations: {
          networkMode: 'offlineFirst',
          retry: 3,
          retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
        },
      },
    })

    if (import.meta.client) {
      // Cuando vuelve la conexión: invalidar queries + reanudar mutations pausadas
      window.addEventListener('online', () => {
        queryClient.resumePausedMutations()
        queryClient.invalidateQueries()
      })
    }

    nuxt.vueApp.use(VueQueryPlugin, { queryClient })

    return {
      provide: { queryClient },
    }
  },
})
