<script setup lang="ts">
import { TrendingUp, TrendingDown, Scale, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-vue-next'
import { useMonthlyTrends } from '~/composables/useMonthlyTrends'
import { useProfile } from '~/composables/useProfile'
import { useExchangeRates, convertAmount } from '~/composables/useExchangeRates'
import { formatCurrency } from '~/utils/format'
import type { RateType } from '~/types/database'

const monthsToShow = ref(12)
const { data: trends, isLoading } = useMonthlyTrends(monthsToShow)
const { data: profile } = useProfile()
const { data: rates, isError: ratesError } = useExchangeRates()

const defaultCurrency = computed(() => profile.value?.default_currency ?? 'ARS')
const rateType = computed<RateType>(() => (profile.value?.default_rate_type as RateType) ?? 'blue')

function toDefault(amount: number, fromCurrency: string): number {
  if (fromCurrency === defaultCurrency.value) return amount
  const c = convertAmount(amount, fromCurrency, defaultCurrency.value, rates.value, rateType.value)
  return c ?? 0
}

const monthsData = computed(() => {
  const result: Array<{ key: string; label: string; expense: number; income: number; net: number; txCount: number }> = []
  const now = new Date()
  for (let i = monthsToShow.value - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toISOString().slice(0, 10)
    const label = new Intl.DateTimeFormat('es-AR', { month: 'short', year: '2-digit' }).format(d)
    result.push({ key, label, expense: 0, income: 0, net: 0, txCount: 0 })
  }
  for (const row of trends.value ?? []) {
    const monthKey = String(row.month).slice(0, 10)
    const target = result.find(r => r.key === monthKey)
    if (!target) continue
    const amount = toDefault(Number(row.total), row.currency)
    if (row.type === 'expense') target.expense += amount
    else if (row.type === 'income') target.income += amount
    target.txCount += Number(row.count)
  }
  for (const r of result) r.net = r.income - r.expense
  return result
})

const maxExpense = computed(() => Math.max(1, ...monthsData.value.map(m => m.expense)))
const maxIncome = computed(() => Math.max(1, ...monthsData.value.map(m => m.income)))

const periodTotals = computed(() => {
  const ms = monthsData.value
  const expense = ms.reduce((a, m) => a + m.expense, 0)
  const income = ms.reduce((a, m) => a + m.income, 0)
  const net = income - expense
  const monthsWithActivity = ms.filter(m => m.expense > 0 || m.income > 0).length || 1
  return {
    expense, income, net,
    avgExpensePerMonth: expense / monthsWithActivity,
    avgIncomePerMonth: income / monthsWithActivity,
  }
})

const monthComparison = computed(() => {
  const ms = monthsData.value
  if (ms.length < 2) return null
  const current = ms[ms.length - 1]
  const prev = ms[ms.length - 2]
  const pct = prev.expense > 0 ? ((current.expense - prev.expense) / prev.expense) * 100 : 0
  return { current, prev, pct }
})

const topCategories = computed(() => {
  const map = new Map<string, {
    id: string | null; name: string | null; icon: string | null; color: string | null
    total: number; count: number
  }>()
  for (const row of trends.value ?? []) {
    if (row.type !== 'expense') continue
    const key = row.category_id ?? 'none'
    const existing = map.get(key) ?? {
      id: row.category_id, name: row.category_name, icon: row.category_icon, color: row.category_color,
      total: 0, count: 0,
    }
    existing.total += toDefault(Number(row.total), row.currency)
    existing.count += Number(row.count)
    map.set(key, existing)
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10)
})

const maxCategoryTotal = computed(() => Math.max(1, ...topCategories.value.map(c => c.total)))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="font-serif text-3xl">Estadísticas</h1>
      <select v-model.number="monthsToShow" class="app-input max-w-[200px]">
        <option :value="3">Últimos 3 meses</option>
        <option :value="6">Últimos 6 meses</option>
        <option :value="12">Últimos 12 meses</option>
        <option :value="24">Últimos 24 meses</option>
      </select>
    </div>

    <div v-if="ratesError" class="app-card !bg-warning-bg/50 !border-warning/30 text-sm text-warning">
      Cotizaciones no disponibles. Montos en monedas distintas a {{ defaultCurrency }} pueden no mostrarse correctamente.
    </div>

    <div v-if="isLoading" class="app-card text-sm text-text-muted">Cargando…</div>

    <template v-else>
      <!-- KPIs -->
      <section class="grid-cards-md">
        <MetricCard
          label="Ingresos totales"
          :value="formatCurrency(periodTotals.income, defaultCurrency)"
          :sub="`≈ ${formatCurrency(periodTotals.avgIncomePerMonth, defaultCurrency)}/mes`"
          tone="positive"
        />
        <MetricCard
          label="Gastos totales"
          :value="formatCurrency(periodTotals.expense, defaultCurrency)"
          :sub="`≈ ${formatCurrency(periodTotals.avgExpensePerMonth, defaultCurrency)}/mes`"
          tone="negative"
        />
        <MetricCard
          label="Balance neto"
          :value="(periodTotals.net >= 0 ? '+' : '') + formatCurrency(periodTotals.net, defaultCurrency)"
          sub="Ingresos − Gastos"
          :tone="periodTotals.net >= 0 ? 'positive' : 'negative'"
        />
        <div v-if="monthComparison" class="app-card">
          <p class="text-xs uppercase tracking-wider text-text-muted">Vs mes anterior</p>
          <p
            class="mt-1 flex items-center gap-1 truncate font-mono text-xl sm:text-2xl font-semibold tabular-nums"
            :class="monthComparison.pct > 0 ? 'text-danger' : monthComparison.pct < 0 ? 'text-success' : 'text-text-soft'"
          >
            <ArrowUpRight v-if="monthComparison.pct > 0" :size="18" />
            <ArrowDownRight v-else-if="monthComparison.pct < 0" :size="18" />
            <Minus v-else :size="18" />
            {{ Math.abs(monthComparison.pct).toFixed(1) }}%
          </p>
          <p class="text-xs text-text-muted">gasto</p>
        </div>
      </section>

      <!-- Tendencia mensual gastos -->
      <section class="app-card">
        <div class="mb-4 flex items-center gap-2">
          <TrendingDown :size="16" class="text-danger" />
          <h2 class="text-sm font-medium text-text-soft">Gastos mensuales</h2>
        </div>
        <div class="space-y-2.5">
          <div
            v-for="m in monthsData"
            :key="'e-' + m.key"
            class="text-xs"
          >
            <div class="flex items-baseline justify-between gap-2 mb-1">
              <span class="text-text-muted">{{ m.label }}</span>
              <span class="font-mono font-semibold tabular-nums truncate">
                {{ formatCurrency(m.expense, defaultCurrency) }}
              </span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full bg-danger transition-all"
                :style="{ width: (m.expense / maxExpense * 100) + '%' }"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Tendencia mensual ingresos -->
      <section class="app-card">
        <div class="mb-4 flex items-center gap-2">
          <TrendingUp :size="16" class="text-success" />
          <h2 class="text-sm font-medium text-text-soft">Ingresos mensuales</h2>
        </div>
        <div class="space-y-2.5">
          <div
            v-for="m in monthsData"
            :key="'i-' + m.key"
            class="text-xs"
          >
            <div class="flex items-baseline justify-between gap-2 mb-1">
              <span class="text-text-muted">{{ m.label }}</span>
              <span class="font-mono font-semibold tabular-nums truncate text-success">
                {{ formatCurrency(m.income, defaultCurrency) }}
              </span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full bg-success transition-all"
                :style="{ width: (m.income / maxIncome * 100) + '%' }"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Neto -->
      <section class="app-card">
        <div class="mb-4 flex items-center gap-2">
          <Scale :size="16" class="text-accent" />
          <h2 class="text-sm font-medium text-text-soft">Neto mensual</h2>
        </div>
        <div class="space-y-2.5">
          <div
            v-for="m in monthsData"
            :key="'n-' + m.key"
            class="text-xs"
          >
            <div class="flex items-baseline justify-between gap-2 mb-1">
              <span class="text-text-muted">{{ m.label }}</span>
              <span
                class="font-mono font-semibold tabular-nums truncate"
                :class="m.net >= 0 ? 'text-success' : 'text-danger'"
              >
                {{ m.net >= 0 ? '+' : '' }}{{ formatCurrency(m.net, defaultCurrency) }}
              </span>
            </div>
            <div class="relative flex h-3 items-center rounded-full bg-elevated overflow-hidden">
              <div class="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div class="flex h-full w-1/2 flex-row-reverse">
                <div class="h-full bg-danger/60" :style="{ width: (m.expense / maxExpense * 100) + '%' }" />
              </div>
              <div class="h-full w-1/2">
                <div class="h-full bg-success/60" :style="{ width: (m.income / maxIncome * 100) + '%' }" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Donut por categoría -->
      <section v-if="topCategories.length" class="app-card">
        <h2 class="mb-4 text-sm font-medium text-text-soft">Distribución de gastos</h2>
        <DonutChart
          :data="topCategories.map(c => ({
            label: c.name || 'Sin categoría',
            value: c.total,
            color: c.color || '#94a3b8',
            icon: c.icon,
          }))"
          :currency="defaultCurrency"
          :size="180"
          :thickness="26"
          center-label="Total gastos"
        />
      </section>

      <!-- Top categorías -->
      <section v-if="topCategories.length" class="app-card">
        <h2 class="mb-4 text-sm font-medium text-text-soft">Top categorías del período</h2>
        <div class="space-y-3">
          <div
            v-for="c in topCategories"
            :key="c.id ?? 'none'"
            class="flex items-start gap-2.5"
          >
            <span class="shrink-0 text-lg leading-none mt-0.5">{{ c.icon || '○' }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline justify-between gap-2">
                <p class="truncate text-sm">
                  {{ c.name || 'Sin categoría' }}
                  <span class="text-xs text-text-muted ml-1">{{ c.count }}×</span>
                </p>
                <span class="font-mono text-sm font-semibold tabular-nums truncate">
                  {{ formatCurrency(c.total, defaultCurrency) }}
                </span>
              </div>
              <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                <div
                  class="h-full rounded-full transition-all"
                  :style="{
                    width: (c.total / maxCategoryTotal * 100) + '%',
                    backgroundColor: c.color || 'rgb(var(--color-accent))',
                  }"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
