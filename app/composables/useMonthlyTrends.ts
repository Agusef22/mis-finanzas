import { useQuery } from '@tanstack/vue-query'
import type { MonthlyCategorySummary } from '~/types/database'

/**
 * Trae summaries de los últimos `months` meses (incluyendo el actual).
 * Devuelve filas crudas de monthly_category_summary — las agrupás en el cliente.
 */
export function useMonthlyTrends(monthsRef: Ref<number> | number = 12) {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const mref = isRef(monthsRef) ? monthsRef : ref(monthsRef)

  return useQuery({
    queryKey: ['monthly-trends', computed(() => user.value?.id), mref],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - (mref.value - 1), 1)
      const startIso = start.toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('monthly_category_summary')
        .select('*')
        .gte('month', startIso)
        .order('month', { ascending: true })

      if (error) throw error
      return data as MonthlyCategorySummary[]
    },
  })
}
