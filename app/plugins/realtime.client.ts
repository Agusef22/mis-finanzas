import type { QueryClient } from '@tanstack/vue-query'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

/**
 * Suscripción Supabase Realtime:
 * - Escucha cambios en las tablas relevantes del user actual
 * - Invalida las queries de TanStack Query correspondientes
 * - La UI se actualiza sola cuando cambia algo desde Telegram, otro device,
 *   o incluso desde otra pestaña abierta
 */
export default defineNuxtPlugin({
  name: 'realtime',
  dependsOn: ['vue-query'], // necesita que el plugin vue-query ya haya corrido
  setup(nuxtApp) {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()
    const qc = nuxtApp.$queryClient as QueryClient
    const { toast } = useToast()

    let channel: RealtimeChannel | null = null

    function cleanup() {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }

    function setup(userId: string) {
      cleanup()

      channel = supabase
        .channel(`user-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${userId}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            qc.invalidateQueries({ queryKey: ['transactions'] })
            qc.invalidateQueries({ queryKey: ['account-balances'] })
            qc.invalidateQueries({ queryKey: ['monthly-summary'] })
            qc.invalidateQueries({ queryKey: ['monthly-trends'] })
            qc.invalidateQueries({ queryKey: ['goals'] })        // metas linkeadas a cuentas
            qc.invalidateQueries({ queryKey: ['budgets'] })      // presupuestos por categoría

            if (payload.eventType === 'INSERT') {
              const row = payload.new as {
                source?: string
                description?: string
                amount?: number
                currency?: string
                type?: string
              }
              if (row.source === 'telegram' || row.source === 'whatsapp') {
                const sign = row.type === 'expense' ? '-' : row.type === 'income' ? '+' : ''
                const label = row.description || (row.type === 'income' ? 'Ingreso' : 'Gasto')
                const amt = row.amount
                  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: row.currency || 'ARS' }).format(row.amount)
                  : ''
                const channelName = row.source === 'telegram' ? 'Telegram' : 'WhatsApp'
                toast.success(`${channelName}: ${label} ${sign}${amt}`)
              }
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'accounts',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ['accounts'] })
            qc.invalidateQueries({ queryKey: ['accounts-archived'] })
            qc.invalidateQueries({ queryKey: ['account-balances'] })
            qc.invalidateQueries({ queryKey: ['goals'] })        // la moneda o estado de la cuenta pueden afectar metas
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'categories',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ['categories'] })
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_identities',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ['chat-identities'] })
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'goals',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ['goals'] })
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'budgets',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ['budgets'] })
          },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[realtime] channel status:', status)
          }
        })
    }

    watch(
      user,
      (u) => {
        if (u?.id) setup(u.id)
        else cleanup()
      },
      { immediate: true },
    )
  },
})
