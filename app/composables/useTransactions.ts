import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { v4 as uuidv4 } from 'uuid'
import type { Transaction } from '~/types/database'

export interface TransactionFilters {
  start?: string
  end?: string
  accountId?: string
  categoryId?: string
  type?: 'expense' | 'income' | 'transfer'
  search?: string
  limit?: number
}

/**
 * Invalida TODAS las queries que dependen del estado de las transacciones.
 * Usar en todas las mutations que cambien algo que afecte saldos, stats, metas o presupuestos.
 */
function invalidateAllTxDependencies(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['transactions'] })
  qc.invalidateQueries({ queryKey: ['account-balances'] })
  qc.invalidateQueries({ queryKey: ['monthly-summary'] })
  qc.invalidateQueries({ queryKey: ['monthly-trends'] })
  qc.invalidateQueries({ queryKey: ['goals'] })
  qc.invalidateQueries({ queryKey: ['budgets'] })
}

export function useTransactions(filters: Ref<TransactionFilters> | TransactionFilters = {}) {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const filtersRef = isRef(filters) ? filters : ref(filters)

  return useQuery({
    queryKey: ['transactions', computed(() => user.value?.id), filtersRef],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const f = filtersRef.value
      let q = supabase
        .from('transactions')
        .select('*, account:accounts(*), category:categories(*)')
        .is('deleted_at', null)
        .order('occurred_at', { ascending: false })
        .limit(f.limit ?? 100)

      if (f.start) q = q.gte('occurred_at', f.start)
      if (f.end) q = q.lt('occurred_at', f.end)
      if (f.accountId) q = q.eq('account_id', f.accountId)
      if (f.categoryId) q = q.eq('category_id', f.categoryId)
      if (f.type) q = q.eq('type', f.type)
      if (f.search && f.search.trim()) {
        const s = `%${f.search.trim()}%`
        q = q.or(`description.ilike.${s},notes.ilike.${s}`)
      }

      const { data, error } = await q
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export interface CreateTransactionInput {
  account_id: string
  category_id?: string | null
  type: 'expense' | 'income'
  amount: number
  currency: string
  occurred_at: string
  description?: string | null
  notes?: string | null
}

export function useCreateTransaction() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const payload = {
        ...input,
        user_id: user.value?.id,
        client_uuid: uuidv4(),
        source: 'manual',
      }
      const { data, error } = await supabase
        .from('transactions')
        .insert(payload as any)
        .select('*, account:accounts(*), category:categories(*)')
        .single()
      if (error) throw error
      return data as Transaction
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['transactions'] })
      const previous = qc.getQueriesData<Transaction[]>({ queryKey: ['transactions'] })

      const optimistic: any = {
        id: `tmp-${uuidv4()}`,
        user_id: user.value?.id,
        account_id: input.account_id,
        category_id: input.category_id ?? null,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        exchange_rate_to_ars: null,
        occurred_at: input.occurred_at,
        description: input.description ?? null,
        notes: input.notes ?? null,
        source: 'manual',
        source_metadata: null,
        client_uuid: uuidv4(),
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      qc.setQueriesData<Transaction[]>({ queryKey: ['transactions'] }, (old) => {
        if (!old) return [optimistic]
        return [optimistic, ...old]
      })

      return { previous }
    },
    onError: (_err, _input, ctx) => {
      ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      invalidateAllTxDependencies(qc)
    },
  })
}

export function useUpdateTransaction() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Transaction> }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(patch as any)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Transaction
    },
    onSettled: () => {
      invalidateAllTxDependencies(qc)
    },
  })
}

export function useDeleteTransaction() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('soft_delete_transaction', { p_tx_id: id })
      if (error) throw error
    },
    onSettled: () => {
      invalidateAllTxDependencies(qc)
    },
  })
}

export interface TransferInput {
  from_account: string
  to_account: string
  amount: number
  occurred_at?: string
  description?: string
  exchange_rate?: number
  fee?: number
}

export function useCreateTransfer() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: TransferInput) => {
      const { data, error } = await supabase.rpc('create_transfer', {
        p_from_account: input.from_account,
        p_to_account: input.to_account,
        p_amount: input.amount,
        p_occurred_at: input.occurred_at ?? new Date().toISOString(),
        p_description: input.description ?? null,
        p_exchange_rate: input.exchange_rate ?? null,
        p_fee: input.fee ?? 0,
      })
      if (error) throw error
      return data as string
    },
    onSettled: () => {
      invalidateAllTxDependencies(qc)
    },
  })
}
