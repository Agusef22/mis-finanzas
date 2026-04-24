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
} from 'lucide-vue-next'

const user = useSupabaseUser()
const client = useSupabaseClient()

async function logout() {
  await client.auth.signOut()
  await navigateTo('/login')
}

// Links principales del nav — los 5 que van al bottom en mobile
const primaryNav = [
  { to: '/', label: 'Inicio', icon: LayoutGrid },
  { to: '/transactions', label: 'Movimientos', icon: ArrowLeftRight },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/accounts', label: 'Cuentas', icon: Wallet },
  { to: '/settings', label: 'Ajustes', icon: Settings },
]

// Links secundarios — solo sidebar desktop
const secondaryNav = [
  { to: '/budgets', label: 'Presupuestos', icon: Target },
  { to: '/goals', label: 'Metas', icon: Trophy },
  { to: '/categories', label: 'Categorías', icon: Tag },
]
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
          v-for="link in primaryNav"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          active-class="router-link-active"
        >
          <component :is="link.icon" :size="16" />
          {{ link.label }}
        </NuxtLink>
        <div class="my-2 border-t border-border" />
        <NuxtLink
          v-for="link in secondaryNav"
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
    >
      <div class="flex items-center justify-between px-3 py-2">
        <NuxtLink to="/">
          <AppLogo :size="24" />
        </NuxtLink>
        <div class="flex items-center gap-0.5">
          <NuxtLink to="/categories" class="app-btn app-btn-ghost !p-1.5" title="Categorías">
            <Tag :size="16" />
          </NuxtLink>
          <ThemeToggle />
          <button class="app-btn app-btn-ghost !p-1.5" title="Salir" @click="logout">
            <LogOut :size="16" />
          </button>
        </div>
      </div>
    </header>

    <!-- ================= Main content ================= -->
    <main class="min-h-screen pb-20 md:pb-4 md:pl-52">
      <div class="mx-auto max-w-4xl px-3 py-3 md:py-5 md:px-6">
        <slot />
      </div>
    </main>

    <!-- ================= Mobile bottom nav ================= -->
    <nav
      v-if="user"
      class="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/90 backdrop-blur-lg md:hidden"
      style="padding-bottom: env(safe-area-inset-bottom);"
    >
      <div class="flex items-stretch">
        <NuxtLink
          v-for="link in primaryNav"
          :key="link.to"
          :to="link.to"
          class="bottom-nav-link"
          active-class="router-link-active"
        >
          <component :is="link.icon" :size="20" />
          <span>{{ link.label }}</span>
        </NuxtLink>
      </div>
    </nav>

    <!-- Banner de estado de red (aparece solo cuando estás offline o recién volviste online) -->
    <NetworkStatusBar />

    <!-- Dialog global de confirmación — usar con useConfirm() -->
    <ConfirmDialog />

    <!-- Dialog global para editar transacciones — usar con useEditTransaction() -->
    <TransactionEditDialog />

    <!-- Toasts globales — usar con useToast() -->
    <ToastContainer />
  </div>
</template>
