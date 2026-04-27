<script setup lang="ts">
import {
  LayoutGrid,
  ArrowLeftRight,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  Tag,
  Target,
  Trophy,
  Menu,
  X as XIcon,
} from 'lucide-vue-next'
import { useQueryClient } from '@tanstack/vue-query'

const user = useSupabaseUser()
const client = useSupabaseClient()
const route = useRoute()
const queryClient = useQueryClient()

async function logout() {
  try {
    // 1. Cancelar queries en curso
    await queryClient.cancelQueries()

    // 2. Sign out con scope 'global' — invalida TODOS los refresh tokens del user
    //    en cualquier device. Sin esto un atacante con refresh token podría seguir entrando.
    await client.auth.signOut({ scope: 'global' })

    // 3. Limpiar cache de queries
    queryClient.clear()

    // 4. Limpiar storage local de Supabase manualmente por si algún token quedó suelto
    if (import.meta.client) {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && (k.startsWith('sb-') || k.startsWith('supabase'))) {
          keysToRemove.push(k)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
    }
  } catch (e) {
    console.error('Error en logout:', e)
  }

  // 5. Hard navigate (no SPA navigation) — fuerza recarga completa para limpiar state
  if (import.meta.client) {
    window.location.href = '/login'
  } else {
    await navigateTo('/login')
  }
}

// El watcher de cambio de user vive en el plugin auth-cache-cleanup.client.ts
// porque acá (en el layout) se desmonta al ir a /login y perdía estado.

const navLinks = [
  { to: '/', label: 'Inicio', icon: LayoutGrid },
  { to: '/transactions', label: 'Movimientos', icon: ArrowLeftRight },
  { to: '/stats', label: 'Estadísticas', icon: BarChart3 },
  { to: '/accounts', label: 'Cuentas', icon: Wallet },
  { to: '/budgets', label: 'Presupuestos', icon: Target },
  { to: '/goals', label: 'Metas', icon: Trophy },
  { to: '/categories', label: 'Categorías', icon: Tag },
  { to: '/settings', label: 'Ajustes', icon: Settings },
]

const drawerOpen = ref(false)

// Cerrar drawer al navegar
watch(() => route.path, () => {
  drawerOpen.value = false
})
</script>

<template>
  <div class="min-h-screen bg-bg text-text">
    <!-- ================= Desktop sidebar ================= -->
    <aside
      class="fixed inset-y-0 left-0 z-30 hidden w-52 flex-col border-r border-border bg-surface/50 px-3 py-4 backdrop-blur md:flex"
    >
      <NuxtLink to="/" class="mb-5 px-2">
        <AppLogo />
      </NuxtLink>

      <nav class="flex flex-1 flex-col gap-0.5">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          active-class="router-link-active"
        >
          <component :is="link.icon" :size="16" />
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="mt-auto flex items-center justify-between gap-2 px-1 pt-3">
        <ThemeToggle />
        <button class="app-btn app-btn-ghost text-xs" @click="logout">
          <LogOut :size="14" />
          Salir
        </button>
      </div>
    </aside>

    <!-- ================= Mobile header ================= -->
    <header
      class="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur md:hidden"
      style="padding-top: env(safe-area-inset-top);"
    >
      <div class="flex items-center justify-between px-3 py-2">
        <button
          class="-ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-text hover:bg-elevated"
          aria-label="Abrir menú"
          @click="drawerOpen = true"
        >
          <Menu :size="22" />
        </button>
        <NuxtLink to="/" class="flex items-center">
          <AppLogo :size="24" />
        </NuxtLink>
        <ThemeToggle />
      </div>
    </header>

    <!-- ================= Drawer mobile ================= -->
    <AppDrawer :open="drawerOpen" @close="drawerOpen = false">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <AppLogo :size="26" />
        <button
          class="flex h-10 w-10 items-center justify-center rounded-lg text-text-soft hover:bg-elevated"
          aria-label="Cerrar menú"
          @click="drawerOpen = false"
        >
          <XIcon :size="20" />
        </button>
      </div>

      <nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="nav-link !text-base !py-3"
          active-class="router-link-active"
        >
          <component :is="link.icon" :size="20" />
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="border-t border-border px-3 py-3">
        <button
          class="app-btn app-btn-ghost w-full justify-start !text-base !py-3"
          @click="logout"
        >
          <LogOut :size="20" />
          Salir
        </button>
      </div>
    </AppDrawer>

    <!-- ================= Main content ================= -->
    <main class="min-h-screen pb-6 md:pl-52">
      <div class="mx-auto w-full max-w-4xl px-3 py-4 md:py-6 md:px-6">
        <slot />
      </div>
    </main>

    <!-- Dialogs / toasts globales -->
    <NetworkStatusBar />
    <ConfirmDialog />
    <TransactionEditDialog />
    <ToastContainer />
  </div>
</template>
