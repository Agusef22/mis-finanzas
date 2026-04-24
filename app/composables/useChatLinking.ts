import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { ChatIdentity, ChatProvider } from '~/types/database'

export function useChatIdentities() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  return useQuery({
    queryKey: ['chat-identities', computed(() => user.value?.id)],
    enabled: computed(() => !!user.value),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_identities')
        .select('*')
        .order('linked_at', { ascending: false })
      if (error) throw error
      return data as ChatIdentity[]
    },
  })
}

export function useGenerateLinkCode() {
  const supabase = useSupabaseClient()

  return useMutation({
    mutationFn: async (provider: ChatProvider) => {
      const { data, error } = await supabase.rpc('generate_link_code', { p_provider: provider })
      if (error) throw error
      return data as string
    },
  })
}

export function useUnlinkIdentity() {
  const supabase = useSupabaseClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_identities').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-identities'] }),
  })
}
