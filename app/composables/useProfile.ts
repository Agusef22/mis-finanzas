import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Profile } from '~/types/database'

export function useProfile() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  return useQuery({
    queryKey: ['profile', computed(() => user.value?.id)],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value!.id)
        .single()
      if (error) throw error
      return data as Profile
    },
  })
}

export function useUpdateProfile() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch as any)
        .eq('id', user.value!.id)
        .select()
        .single()
      if (error) throw error
      return data as Profile
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}
