import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Account, AccountBalance } from '~/types/database'

export function useAccounts() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  return useQuery({
    queryKey: ['accounts', computed(() => user.value?.id)],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Account[]
    },
  })
}

export function useAccountBalances() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  return useQuery({
    queryKey: ['account-balances', computed(() => user.value?.id)],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_balances')
        .select('*')
        .order('name')
      if (error) throw error
      return data as AccountBalance[]
    },
  })
}

export function useCreateAccount() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: Partial<Account>) => {
      if (!user.value) throw new Error('not authenticated')
      const payload = { ...input, user_id: user.value.id }
      const { data, error } = await supabase
        .from('accounts')
        .insert(payload as any)
        .select()
        .single()
      if (error) throw error
      return data as Account
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['account-balances'] })
    },
  })
}

export function useUpdateAccount() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Account> }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(patch as any)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Account
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['account-balances'] })
    },
  })
}

export function useArchivedAccounts() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  return useQuery({
    queryKey: ['accounts-archived', computed(() => user.value?.id)],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
      if (error) throw error
      return data as Account[]
    },
  })
}

export function useArchiveAccount() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['accounts-archived'] })
      qc.invalidateQueries({ queryKey: ['account-balances'] })
    },
  })
}

export function useUnarchiveAccount() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .update({ archived_at: null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['accounts-archived'] })
      qc.invalidateQueries({ queryKey: ['account-balances'] })
    },
  })
}

export function useDeleteAccount() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['accounts-archived'] })
      qc.invalidateQueries({ queryKey: ['account-balances'] })
    },
  })
}

/**
 * Elimina la cuenta + todas sus transacciones (destructivo).
 * Retorna el count de movimientos borrados.
 */
export function useDeleteAccountCascade() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('delete_account_cascade', { p_account_id: id })
      if (error) throw error
      // El RPC retorna una table, supabase-js devuelve array
      const row = Array.isArray(data) ? data[0] : data
      return row as { deleted_account: string; deleted_transactions: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['accounts-archived'] })
      qc.invalidateQueries({ queryKey: ['account-balances'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['monthly-summary'] })
      qc.invalidateQueries({ queryKey: ['monthly-trends'] })
    },
  })
}

/**
 * Count de movimientos de una cuenta — útil para mostrar en confirmación de borrado.
 */
export function useAccountTxCount(accountId: Ref<string | null> | string | null) {
  const supabase = useSupabaseClient()
  const idRef = isRef(accountId) ? accountId : ref(accountId)

  return useQuery({
    queryKey: ['account-tx-count', idRef],
    enabled: computed(() => !!idRef.value),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('account_transaction_count', { p_account_id: idRef.value })
      if (error) throw error
      return Number(data)
    },
  })
}
