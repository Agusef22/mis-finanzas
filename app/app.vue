<script setup lang="ts">
// :page-key fuerza un re-mount completo de la página cuando cambia el user.id.
// Esto, sumado al queryClient.clear() del layout, garantiza que NUNCA se muestre
// data cacheada del user anterior cuando se hace login con otro user.
const user = useSupabaseUser()
const pageKey = computed(() => user.value?.id ?? 'guest')
</script>

<template>
  <NuxtLayout>
    <NuxtPage :page-key="() => pageKey" />
  </NuxtLayout>
</template>
