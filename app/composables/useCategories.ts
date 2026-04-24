import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Category } from '~/types/database'

export function useCategories() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  return useQuery({
    queryKey: ['categories', computed(() => user.value?.id)],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .is('archived_at', null)
        .order('name')
      if (error) throw error
      return data as Category[]
    },
  })
}

export function useCreateCategory() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: Partial<Category>) => {
      if (!user.value) throw new Error('not authenticated')
      const payload = { ...input, user_id: user.value.id }
      const { data, error } = await supabase
        .from('categories')
        .insert(payload as any)
        .select()
        .single()
      if (error) throw error
      return data as Category
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Category> }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(patch as any)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Category
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useArchiveCategory() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
