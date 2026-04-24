<script setup lang="ts">
import { Mail, Lock, User, Mailbox } from 'lucide-vue-next'

definePageMeta({ layout: 'auth', auth: false })

const supabase = useSupabaseClient()
const email = ref('')
const password = ref('')
const displayName = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

async function signup() {
  loading.value = true
  error.value = null
  const { error: err } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: { data: { display_name: displayName.value || null } },
  })
  loading.value = false
  if (err) { error.value = err.message; return }
  success.value = true
}
</script>

<template>
  <form v-if="!success" class="app-card space-y-5" @submit.prevent="signup">
    <h2 class="font-serif text-2xl">Crear cuenta</h2>

    <div>
      <label class="app-label" for="name">Nombre</label>
      <div class="relative">
        <User :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input id="name" v-model="displayName" type="text" class="app-input pl-10" placeholder="Tu nombre" />
      </div>
    </div>

    <div>
      <label class="app-label" for="email">Email</label>
      <div class="relative">
        <Mail :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input id="email" v-model="email" type="email" required autocomplete="email" class="app-input pl-10" placeholder="tu@email.com" />
      </div>
    </div>

    <div>
      <label class="app-label" for="password">Contraseña</label>
      <div class="relative">
        <Lock :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input id="password" v-model="password" type="password" required minlength="6" autocomplete="new-password" class="app-input pl-10" placeholder="Mínimo 6 caracteres" />
      </div>
    </div>

    <p v-if="error" class="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{{ error }}</p>

    <button type="submit" :disabled="loading" class="app-btn app-btn-primary w-full">
      {{ loading ? 'Creando…' : 'Crear cuenta' }}
    </button>

    <p class="text-center text-sm text-text-soft">
      ¿Ya tenés cuenta?
      <NuxtLink to="/login" class="font-medium text-accent hover:underline">Ingresar</NuxtLink>
    </p>
  </form>

  <div v-else class="app-card space-y-4 text-center">
    <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
      <Mailbox :size="28" />
    </div>
    <h2 class="font-serif text-2xl">Revisá tu mail</h2>
    <p class="text-sm text-text-soft">Te mandamos un link para confirmar la cuenta.</p>
    <NuxtLink to="/login" class="app-btn app-btn-secondary inline-flex">Volver a login</NuxtLink>
  </div>
</template>
