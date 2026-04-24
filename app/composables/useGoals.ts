import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useExchangeRates, convertAmount } from '~/composables/useExchangeRates'
import { useProfile } from '~/composables/useProfile'
import type { RateType } from '~/types/database'

export interface Goal {
  id: string
  user_id: string
  name: string
  description: string | null
  target_amount: number
  currency: string
  account_id: string | null
  manual_progress: number
  icon: string | null
  color: string | null
  deadline: string | null
  completed_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

interface GoalRawRow {
  goal_id: string
  user_id: string
  name: string
  description: string | null
  target_amount: number
  currency: string
  account_id: string | null
  account_currency: string | null  // moneda real de la cuenta linkeada
  manual_progress: number
  icon: string | null
  color: string | null
  deadline: string | null
  completed_at: string | null
  archived_at: string | null
  created_at: string
  current_amount_raw: number        // en moneda de la cuenta (sin convertir)
}

export interface GoalStatus extends Omit<GoalRawRow, 'current_amount_raw'> {
  current_amount: number            // convertido a la moneda de la meta
  pct_complete: number
  conversion_failed: boolean        // true si no se pudo convertir (ej: rates no disponibles)
}

export function useGoals() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { data: rates } = useExchangeRates()
  const { data: profile } = useProfile()

  const query = useQuery({
    queryKey: ['goals', computed(() => user.value?.id)],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goal_status')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as GoalRawRow[]
    },
  })

  // Transformación: convertir current_amount_raw a la moneda de la meta
  const enriched = computed<GoalStatus[]>(() => {
    const rows = query.data.value ?? []
    const rateType: RateType = (profile.value?.default_rate_type as RateType) ?? 'blue'

    return rows.map((row) => {
      const goalCurrency = row.currency
      const accountCurrency = row.account_currency ?? goalCurrency
      let currentAmount = Number(row.current_amount_raw)
      let conversionFailed = false

      // Si la cuenta está en otra moneda, convertir
      if (row.account_id && accountCurrency !== goalCurrency) {
        const converted = convertAmount(
          currentAmount,
          accountCurrency,
          goalCurrency,
          rates.value,
          rateType,
        )
        if (converted === null) {
          conversionFailed = true
          currentAmount = 0
        } else {
          currentAmount = converted
        }
      }

      const target = Number(row.target_amount)
      const pct = target > 0 ? Math.min(100, (currentAmount / target) * 100) : 0

      const { current_amount_raw, ...rest } = row
      return {
        ...rest,
        current_amount: currentAmount,
        pct_complete: pct,
        conversion_failed: conversionFailed,
      }
    })
  })

  return {
    ...query,
    data: enriched,
  }
}

export function useCreateGoal() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: Partial<Goal>) => {
      if (!user.value) throw new Error('not authenticated')
      const payload = { ...input, user_id: user.value.id }
      const { data, error } = await supabase
        .from('goals')
        .insert(payload as any)
        .select()
        .single()
      if (error) throw error
      return data as Goal
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useUpdateGoal() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Goal> }) => {
      const { data, error } = await supabase
        .from('goals')
        .update(patch as any)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Goal
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useDeleteGoal() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}
