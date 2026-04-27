<script setup lang="ts">
// :key fuerza un re-mount completo de la página cuando cambia el user.id.
// Junto con queryClient.clear() en el layout, garantiza que no se muestre
// data cacheada del user anterior al hacer login con otro user.
const user = useSupabaseUser()
const pageKey = computed(() => `page-${user.value?.id ?? 'guest'}`)
</script>

<template>
  <NuxtLayout :key="pageKey">
    <NuxtPage :key="pageKey" />
  </NuxtLayout>
</template>
