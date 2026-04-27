<script setup lang="ts">
import { Plus, TrendingUp, TrendingDown, ArrowRight } from 'lucide-vue-next'
import { useAccountBalances } from '~/composables/useAccounts'
import { useTransactions, useDeleteTransaction } from '~/composables/useTransactions'
import { useMonthlySummary } from '~/composables/useMonthlySummary'
import { useProfile, useUpdateProfile } from '~/composables/useProfile'
import { useExchangeRates, convertAmount } from '~/composables/useExchangeRates'
import { formatCurrency } from '~/utils/format'
import { monthRange } from '~/utils/month'
import type { RateType } from '~/types/database'

const { start, end, label } = monthRange()

const { data: balances } = useAccountBalances()
const { data: transactions, isLoading: loadingTx } = useTransactions({ start, end, limit: 10 })
const { data: summary } = useMonthlySummary(start.slice(0, 10))
const { data: profile } = useProfile()
const updateProfile = useUpdateProfile()
const { data: rates, isLoading: loadingRates, isError: ratesError } = useExchangeRates()

const delTx = useDeleteTransaction()

const activeRateType = ref<RateType>('blue')
watchEffect(() => {
  if (profile.value?.default_rate_type) activeRateType.value = profile.value.default_rate_type
})

function persistRateType(rt: RateType) {
  activeRateType.value = rt
  if (profile.value && profile.value.default_rate_type !== rt) {
    updateProfile.mutate({ default_rate_type: rt })
  }
}

const defaultCurrency = computed(() => profile.value?.default_currency ?? 'ARS')

function toDefault(amount: number, fromCurrency: string): { value: number; converted: boolean } {
  if (fromCurrency === defaultCurrency.value) return { value: amount, converted: false }
  const conv = convertAmount(amount, fromCurrency, defaultCurrency.value, rates.value, activeRateType.value)
  if (conv === null) return { value: 0, converted: false }
  return { value: conv, converted: true }
}

const balancesByCurrency = computed(() => {
  const out: Record<string, number> = {}
  for (const b of balances.value ?? []) {
    out[b.currency] = (out[b.currency] ?? 0) + Number(b.balance)
  }
  return out
})

const consolidated = computed(() => {
  const target = defaultCurrency.value
  let total = 0
  const unconverted: Record<string, number> = {}
  for (const [currency, amount] of Object.entries(balancesByCurrency.value)) {
    if (currency === target) { total += amount; continue }
    const c = convertAmount(amount, currency, target, rates.value, activeRateType.value)
    if (c === null) unconverted[currency] = (unconverted[currency] ?? 0) + amount
    else total += c
  }
  return { total, target, unconverted }
})

const hasMultipleOrDifferentCurrencies = computed(() => {
  const currencies = Object.keys(balancesByCurrency.value)
  if (currencies.length === 0) return false
  if (currencies.length > 1) return true
  return currencies[0] !== defaultCurrency.value
})

const rateInfo = computed(() => {
  const r = rates.value?.[activeRateType.value]
  return r ? { value: r.venta, updatedAt: r.updatedAt } : null
})

const monthTotals = computed(() => {
  let income = 0, expense = 0
  const missing: string[] = []
  for (const s of summary.value ?? []) {
    const { value, converted } = toDefault(Number(s.total), s.currency)
    if (s.currency !== defaultCurrency.value && !converted) {
      if (!missing.includes(s.currency)) missing.push(s.currency)
      continue
    }
    if (s.type === 'income') income += value
    else if (s.type === 'expense') expense += value
  }
  return { income, expense, missing }
})

const topCategories = computed(() => {
  const map = new Map<string, {
    id: string | null; name: string | null; icon: string | null; color: string | null
    count: number; total: number; hasUnconverted: boolean
  }>()
  for (const s of summary.value ?? []) {
    if (s.type !== 'expense') continue
    const key = s.category_id ?? 'none'
    const existing = map.get(key) ?? {
      id: s.category_id, name: s.category_name, icon: s.category_icon, color: s.category_color,
      count: 0, total: 0, hasUnconverted: false,
    }
    const { value, converted } = toDefault(Number(s.total), s.currency)
    if (s.currency !== defaultCurrency.value && !converted) existing.hasUnconverted = true
    else existing.total += value
    existing.count += Number(s.count)
    map.set(key, existing)
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5)
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Buen día'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
})
</script>

<template>
  <div class="space-y-4">
    <!-- Saludo -->
    <header class="flex items-baseline justify-between">
      <div>
        <p class="text-xs text-text-muted">{{ greeting }}</p>
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ profile?.display_name || 'Hola' }}
        </h1>
      </div>
      <span class="text-xs text-text-muted">{{ label }}</span>
    </header>

    <!-- Total consolidado — hero card -->
    <section
      v-if="hasMultipleOrDifferentCurrencies"
      class="app-card-accent"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-[11px] uppercase tracking-widest text-white/70">Total en {{ consolidated.target }}</p>
          <p class="mt-1.5 font-mono text-2xl sm:text-3xl md:text-4xl font-semibold leading-none tracking-tight tabular-nums truncate">
            <template v-if="loadingRates">…</template>
            <template v-else-if="ratesError">
              <span class="text-sm">Cotización no disponible</span>
            </template>
            <template v-else>
              {{ formatCurrency(consolidated.total, consolidated.target) }}
            </template>
          </p>
          <p v-if="rateInfo" class="mt-2 text-[11px] text-white/70 truncate">
            1 USD {{ activeRateType }} = {{ formatCurrency(rateInfo.value, 'ARS') }}
          </p>
        </div>
        <select
          :value="activeRateType"
          class="shrink-0 rounded-lg bg-white/15 px-2 py-1.5 text-xs text-white backdrop-blur hover:bg-white/25 focus:outline-none"
          @change="persistRateType(($event.target as HTMLSelectElement).value as RateType)"
        >
          <option class="text-text" value="blue">Blue</option>
          <option class="text-text" value="oficial">Oficial</option>
          <option class="text-text" value="mep">MEP</option>
          <option class="text-text" value="ccl">CCL</option>
          <option class="text-text" value="tarjeta">Tarjeta</option>
        </select>
      </div>
      <p v-if="Object.keys(consolidated.unconverted).length" class="mt-3 text-[11px] text-white/80 break-words">
        No convertido:
        <span v-for="(amt, cur) in consolidated.unconverted" :key="cur" class="font-mono ml-1">
          {{ formatCurrency(amt, cur) }}
        </span>
      </p>
    </section>

    <!-- Saldos por moneda -->
    <section>
      <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">Saldos</h2>
      <div class="grid-cards-sm">
        <div v-for="(total, currency) in balancesByCurrency" :key="currency" class="app-card !p-3 overflow-hidden">
          <p class="text-[11px] uppercase tracking-wider text-text-muted">{{ currency }}</p>
          <p class="mt-0.5 truncate font-mono text-base sm:text-lg font-semibold tabular-nums">
            {{ formatCurrency(total, currency) }}
          </p>
        </div>
      </div>
    </section>

    <!-- Este mes -->
    <section>
      <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
        Este mes · {{ defaultCurrency }}
      </h2>
      <div class="grid grid-cols-2 gap-2">
        <div class="app-card !p-3 overflow-hidden">
          <div class="flex items-center justify-between">
            <p class="text-[11px] uppercase tracking-wider text-text-muted">Ingresos</p>
            <TrendingUp :size="14" class="text-success" />
          </div>
          <p class="mt-0.5 truncate font-mono text-base sm:text-lg font-semibold tabular-nums text-success">
            {{ formatCurrency(monthTotals.income, defaultCurrency) }}
          </p>
        </div>
        <div class="app-card !p-3 overflow-hidden">
          <div class="flex items-center justify-between">
            <p class="text-[11px] uppercase tracking-wider text-text-muted">Gastos</p>
            <TrendingDown :size="14" class="text-danger" />
          </div>
          <p class="mt-0.5 truncate font-mono text-base sm:text-lg font-semibold tabular-nums text-danger">
            {{ formatCurrency(monthTotals.expense, defaultCurrency) }}
          </p>
        </div>
      </div>
      <p v-if="monthTotals.missing.length" class="mt-1.5 text-xs text-warning">
        Sin convertir: {{ monthTotals.missing.join(', ') }}
      </p>
    </section>

    <!-- Top categorías -->
    <section v-if="topCategories.length">
      <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">Top categorías</h2>
      <div class="app-card space-y-2 !p-3">
        <div
          v-for="c in topCategories"
          :key="c.id ?? 'none'"
          class="flex items-center gap-2.5"
        >
          <div
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm"
            :style="{ backgroundColor: (c.color ?? '#b4a088') + '22', color: c.color ?? 'currentColor' }"
          >
            {{ c.icon || '○' }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm leading-tight">{{ c.name || 'Sin categoría' }}</p>
            <p class="text-[11px] text-text-muted leading-tight">{{ c.count }} mov.</p>
          </div>
          <p class="shrink-0 font-mono text-sm font-semibold tabular-nums truncate max-w-[40%]">
            {{ formatCurrency(c.total, defaultCurrency) }}
          </p>
        </div>
      </div>
    </section>

    <!-- Últimos movimientos -->
    <section>
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-xs font-medium uppercase tracking-wider text-text-muted">Últimos</h2>
        <NuxtLink to="/transactions" class="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          Ver todos <ArrowRight :size="12" />
        </NuxtLink>
      </div>
      <TransactionList
        :transactions="transactions || []"
        :loading="loadingTx"
        @delete="(id) => delTx.mutate(id)"
      />
    </section>

    <!-- FAB -->
    <NuxtLink
      to="/transactions/new"
      class="fixed bottom-16 right-3 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg transition hover:scale-105 active:scale-95 md:bottom-5 md:right-5"
      aria-label="Nueva transacción"
    >
      <Plus :size="22" />
    </NuxtLink>
  </div>
</template>
