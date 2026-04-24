import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Budget } from '~/types/database'

export interface BudgetWithStatus extends Budget {
  period_start: string
  period_end: string
  spent: number
}

export function useBudgets() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  return useQuery({
    queryKey: ['budgets', computed(() => user.value?.id)],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_status')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as BudgetWithStatus[]
    },
  })
}

export function useCreateBudget() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: Partial<Budget>) => {
      if (!user.value) throw new Error('not authenticated')
      const payload = { ...input, user_id: user.value.id }
      const { data, error } = await supabase
        .from('budgets')
        .insert(payload as any)
        .select()
        .single()
      if (error) throw error
      return data as Budget
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

export function useUpdateBudget() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Budget> }) => {
      const { data, error } = await supabase
        .from('budgets')
        .update(patch as any)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Budget
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

export function useDeleteBudget() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}
