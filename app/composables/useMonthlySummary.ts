import { useQuery } from '@tanstack/vue-query'
import type { MonthlyCategorySummary } from '~/types/database'

export function useMonthlySummary(monthStart: Ref<string> | string) {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const startRef = isRef(monthStart) ? monthStart : ref(monthStart)

  return useQuery({
    queryKey: ['monthly-summary', computed(() => user.value?.id), startRef],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const start = startRef.value.slice(0, 10)
      const { data, error } = await supabase
        .from('monthly_category_summary')
        .select('*')
        .eq('month', start)
        .order('total', { ascending: false })
      if (error) throw error
      return data as MonthlyCategorySummary[]
    },
  })
}
