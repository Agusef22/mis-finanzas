<script setup lang="ts">
import { Mail, Lock } from 'lucide-vue-next'

definePageMeta({ layout: 'auth', auth: false })

const supabase = useSupabaseClient()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function login() {
  loading.value = true
  error.value = null
  const { error: err } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (err) {
    error.value = err.message
    return
  }
  await navigateTo('/')
}
</script>

<template>
  <form class="app-card space-y-5" @submit.prevent="login">
    <h2 class="font-serif text-2xl">Ingresar</h2>

    <div>
      <label class="app-label" for="email">Email</label>
      <div class="relative">
        <Mail :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="app-input pl-10"
          placeholder="tu@email.com"
        />
      </div>
    </div>

    <div>
      <label class="app-label" for="password">Contraseña</label>
      <div class="relative">
        <Lock :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          class="app-input pl-10"
          placeholder="••••••••"
        />
      </div>
    </div>

    <p v-if="error" class="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
      {{ error }}
    </p>

    <button type="submit" :disabled="loading" class="app-btn app-btn-primary w-full">
      {{ loading ? 'Ingresando…' : 'Ingresar' }}
    </button>

    <p class="text-center text-sm text-text-soft">
      ¿No tenés cuenta?
      <NuxtLink to="/signup" class="font-medium text-accent hover:underline">Crear cuenta</NuxtLink>
    </p>
  </form>
</template>
