<script setup lang="ts">
import { Plus, Search, X } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { useAccounts } from '~/composables/useAccounts'
import { useCategories } from '~/composables/useCategories'
import { useTransactions, useDeleteTransaction, type TransactionFilters } from '~/composables/useTransactions'
import { monthRange, shiftMonth } from '~/utils/month'

type PresetPeriod = 'this-month' | 'last-month' | 'last-3' | 'last-6' | 'this-year' | 'all' | 'custom'

const period = ref<PresetPeriod>('this-month')
const customStart = ref('')
const customEnd = ref('')

const typeFilter = ref<'expense' | 'income' | 'transfer' | ''>('')
const accountFilter = ref('')
const categoryFilter = ref('')
const searchInput = ref('')
const searchQuery = ref('')
const applySearch = useDebounceFn((v: string) => { searchQuery.value = v }, 300)
watch(searchInput, (v) => applySearch(v))

const dateRange = computed(() => {
  const now = new Date()
  switch (period.value) {
    case 'this-month': { const r = monthRange(now); return { start: r.start, end: r.end } }
    case 'last-month': { const r = monthRange(shiftMonth(now, -1)); return { start: r.start, end: r.end } }
    case 'last-3': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    case 'last-6': {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    case 'this-year': {
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now.getFullYear() + 1, 0, 1)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    case 'custom': {
      return {
        start: customStart.value ? new Date(customStart.value).toISOString() : undefined,
        end: customEnd.value ? new Date(customEnd.value).toISOString() : undefined,
      }
    }
    default: return {}
  }
})

const filters = computed<TransactionFilters>(() => ({
  limit: 500,
  type: typeFilter.value || undefined,
  accountId: accountFilter.value || undefined,
  categoryId: categoryFilter.value || undefined,
  start: dateRange.value.start,
  end: dateRange.value.end,
  search: searchQuery.value || undefined,
}))

const { data: accounts } = useAccounts()
const { data: categories } = useCategories()
const { data: transactions, isLoading } = useTransactions(filters)
const delTx = useDeleteTransaction()

function clearFilters() {
  period.value = 'this-month'
  typeFilter.value = ''
  accountFilter.value = ''
  categoryFilter.value = ''
  customStart.value = ''
  customEnd.value = ''
  searchInput.value = ''
  searchQuery.value = ''
}

const totalsByCurrency = computed(() => {
  const out: Record<string, { income: number; expense: number; count: number }> = {}
  for (const t of transactions.value ?? []) {
    if (!out[t.currency]) out[t.currency] = { income: 0, expense: 0, count: 0 }
    out[t.currency].count++
    if (t.type === 'income') out[t.currency].income += Number(t.amount)
    else if (t.type === 'expense') out[t.currency].expense += Number(t.amount)
  }
  return out
})

const periods: { v: PresetPeriod; l: string }[] = [
  { v: 'this-month', l: 'Este mes' },
  { v: 'last-month', l: 'Mes anterior' },
  { v: 'last-3', l: 'Últimos 3' },
  { v: 'last-6', l: 'Últimos 6' },
  { v: 'this-year', l: 'Este año' },
  { v: 'all', l: 'Todo' },
  { v: 'custom', l: 'Personalizado' },
]
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="font-serif text-3xl">Movimientos</h1>
      <NuxtLink to="/transactions/new" class="app-btn app-btn-primary">
        <Plus :size="16" /> Nuevo
      </NuxtLink>
    </div>

    <!-- Filtros -->
    <div class="app-card space-y-4">
      <!-- Búsqueda -->
      <div class="relative">
        <Search :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          v-model="searchInput"
          type="search"
          placeholder="Buscar por descripción o notas…"
          class="app-input pl-9 pr-9"
        />
        <button
          v-if="searchInput"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
          :aria-label="'Limpiar búsqueda'"
          @click="searchInput = ''"
        >
          <X :size="14" />
        </button>
      </div>

      <!-- Chips de período -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in periods"
          :key="p.v"
          type="button"
          class="app-chip"
          :data-active="period === p.v"
          @click="period = p.v"
        >
          {{ p.l }}
        </button>
      </div>

      <div v-if="period === 'custom'" class="grid grid-cols-2 gap-3">
        <div>
          <label class="app-label">Desde</label>
          <input v-model="customStart" type="date" class="app-input" />
        </div>
        <div>
          <label class="app-label">Hasta</label>
          <input v-model="customEnd" type="date" class="app-input" />
        </div>
      </div>

      <div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        <div>
          <label class="app-label">Tipo</label>
          <select v-model="typeFilter" class="app-input">
            <option value="">Todos</option>
            <option value="expense">Gastos</option>
            <option value="income">Ingresos</option>
            <option value="transfer">Transferencias</option>
          </select>
        </div>
        <div>
          <label class="app-label">Cuenta</label>
          <select v-model="accountFilter" class="app-input">
            <option value="">Todas</option>
            <option v-for="a in accounts || []" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div>
          <label class="app-label">Categoría</label>
          <select v-model="categoryFilter" class="app-input">
            <option value="">Todas</option>
            <option v-for="c in categories || []" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
          </select>
        </div>
        <div class="flex items-end">
          <button class="app-btn app-btn-secondary w-full" @click="clearFilters">Limpiar</button>
        </div>
      </div>
    </div>

    <!-- Resumen por moneda -->
    <div v-if="Object.keys(totalsByCurrency).length" class="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
      <div v-for="(t, currency) in totalsByCurrency" :key="currency" class="app-card !p-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs uppercase tracking-wider text-text-muted truncate">
            {{ t.count }} mov. · {{ currency }}
          </p>
          <span
            class="font-mono text-sm font-semibold tabular-nums truncate"
            :class="(t.income - t.expense) >= 0 ? 'text-success' : 'text-danger'"
          >
            {{ Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(t.income - t.expense) }}
          </span>
        </div>
        <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          <span class="text-success font-mono tabular-nums truncate">
            + {{ Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(t.income) }}
          </span>
          <span class="text-danger font-mono tabular-nums truncate">
            − {{ Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(t.expense) }}
          </span>
        </div>
      </div>
    </div>

    <TransactionList
      :transactions="transactions || []"
      :loading="isLoading"
      @delete="(id) => delTx.mutate(id)"
    />
  </div>
</template>
