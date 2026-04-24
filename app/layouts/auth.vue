<script setup lang="ts">
// No hay nav acá; usado para login/signup.
</script>

<template>
  <div class="min-h-screen bg-bg text-text">
    <div class="absolute right-4 top-4">
      <ThemeToggle />
    </div>

    <main class="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
      <div class="w-full">
        <div class="mb-10 flex flex-col items-center text-center">
          <AppLogo :size="48" :show-text="false" class="mb-4" />
          <h1 class="font-serif text-3xl leading-tight">mis-finanzas</h1>
          <p class="mt-1 text-sm text-text-soft">Gestión de finanzas personales</p>
        </div>
        <slot />
      </div>
    </main>
  </div>
</template>
