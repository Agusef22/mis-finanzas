<script setup lang="ts">
import { Plus, X as XIcon, Target, AlertTriangle, Trash2, Pencil } from 'lucide-vue-next'
import { useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget, type BudgetWithStatus } from '~/composables/useBudgets'
import { useCategories } from '~/composables/useCategories'
import { useProfile } from '~/composables/useProfile'
import { formatCurrency, formatDate } from '~/utils/format'

const { data: budgets, isLoading } = useBudgets()
const { data: categories } = useCategories()
const { data: profile } = useProfile()
const createBudget = useCreateBudget()
const updateBudget = useUpdateBudget()
const deleteBudget = useDeleteBudget()

const { confirm } = useConfirm()
const { toast } = useToast()

const showForm = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  name: '',
  category_id: '' as string | null,
  period: 'monthly' as 'weekly' | 'monthly' | 'yearly',
  amount: 0,
  currency: 'ARS',
})

watch([showForm, profile], ([open, p]) => {
  if (open && p?.default_currency && !editingId.value) {
    form.currency = p.default_currency
  }
})

const expenseCategories = computed(() =>
  (categories.value ?? []).filter(c => c.kind === 'expense' || c.kind === 'both'),
)

function openNew() {
  editingId.value = null
  form.name = ''
  form.category_id = ''
  form.period = 'monthly'
  form.amount = 0
  form.currency = profile.value?.default_currency ?? 'ARS'
  showForm.value = true
}

function openEdit(b: BudgetWithStatus) {
  editingId.value = b.id
  form.name = b.name ?? ''
  form.category_id = b.category_id ?? ''
  form.period = b.period
  form.amount = Number(b.amount)
  form.currency = b.currency
  showForm.value = true
}

async function onSubmit() {
  const payload = {
    name: form.name || null,
    category_id: form.category_id || null,
    period: form.period,
    amount: form.amount,
    currency: form.currency,
  }
  try {
    if (editingId.value) {
      await updateBudget.mutateAsync({ id: editingId.value, patch: payload })
      toast.success('Presupuesto actualizado')
    } else {
      await createBudget.mutateAsync(payload)
      toast.success('Presupuesto creado')
    }
    showForm.value = false
    editingId.value = null
  } catch (e: any) {
    toast.error(e?.message ?? 'Error al guardar')
  }
}

async function onDelete(b: BudgetWithStatus) {
  const label = b.name || (b as any).category?.name || 'este presupuesto'
  const ok = await confirm({
    title: `¿Borrar "${label}"?`,
    description: 'Se elimina solo el presupuesto, las transacciones siguen intactas.',
    confirmText: 'Borrar',
    variant: 'danger',
  })
  if (!ok) return
  try {
    await deleteBudget.mutateAsync(b.id)
    toast.success('Presupuesto eliminado')
  } catch (e: any) {
    toast.error(e?.message ?? 'Error al borrar')
  }
}

function categoryName(catId: string | null) {
  if (!catId) return 'Todos los gastos'
  return categories.value?.find(c => c.id === catId)?.name ?? 'Categoría'
}

function categoryIcon(catId: string | null) {
  if (!catId) return '💰'
  return categories.value?.find(c => c.id === catId)?.icon ?? '○'
}

function categoryColor(catId: string | null) {
  if (!catId) return 'rgb(var(--color-accent))'
  return categories.value?.find(c => c.id === catId)?.color ?? 'rgb(var(--color-accent))'
}

function progressOf(b: BudgetWithStatus) {
  const pct = b.amount > 0 ? (Number(b.spent) / Number(b.amount)) * 100 : 0
  return Math.min(100, pct)
}

function statusOf(b: BudgetWithStatus): 'ok' | 'warn' | 'over' {
  const pct = b.amount > 0 ? (Number(b.spent) / Number(b.amount)) * 100 : 0
  if (pct >= 100) return 'over'
  if (pct >= 80) return 'warn'
  return 'ok'
}

const periodLabels: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual',
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight">Presupuestos</h1>
      <button class="app-btn app-btn-primary" @click="showForm ? (showForm = false) : openNew()">
        <component :is="showForm ? XIcon : Plus" :size="16" />
        {{ showForm ? 'Cerrar' : 'Nuevo' }}
      </button>
    </div>

    <!-- Form -->
    <form v-if="showForm" class="app-card space-y-4 animate-fade-in" @submit.prevent="onSubmit">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">
          <label class="app-label">Nombre (opcional)</label>
          <input v-model="form.name" class="app-input" placeholder="Ej: Limite gastronomía" />
        </div>
        <div>
          <label class="app-label">Categoría</label>
          <select v-model="form.category_id" class="app-input">
            <option value="">Todos los gastos</option>
            <option v-for="c in expenseCategories" :key="c.id" :value="c.id">
              {{ c.icon }} {{ c.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="app-label">Período</label>
          <select v-model="form.period" class="app-input">
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
            <option value="yearly">Anual</option>
          </select>
        </div>
        <div>
          <label class="app-label">Monto</label>
          <input v-model.number="form.amount" type="number" min="1" step="0.01" class="app-input font-mono" required />
        </div>
        <div>
          <label class="app-label">Moneda</label>
          <select v-model="form.currency" class="app-input">
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="UYU">UYU</option>
            <option value="BRL">BRL</option>
          </select>
        </div>
      </div>
      <button class="app-btn app-btn-primary w-full" type="submit" :disabled="createBudget.isPending.value || updateBudget.isPending.value">
        {{ editingId ? 'Guardar cambios' : 'Crear presupuesto' }}
      </button>
    </form>

    <!-- Lista -->
    <div v-if="isLoading" class="app-card text-sm text-text-muted">Cargando…</div>

    <div v-else-if="!budgets?.length" class="app-card text-center">
      <Target :size="32" class="mx-auto mb-2 text-text-muted" />
      <p class="text-sm text-text-soft">Aún no tenés presupuestos.</p>
      <p class="mt-1 text-xs text-text-muted">
        Definí un límite de gasto por categoría (o global) y te avisamos cuando te acercás.
      </p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="b in budgets"
        :key="b.budget_id"
        class="app-card group"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
            :style="{ backgroundColor: categoryColor(b.category_id) + '22', color: categoryColor(b.category_id) }"
          >
            {{ categoryIcon(b.category_id) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">
                  {{ b.name || categoryName(b.category_id) }}
                </p>
                <p class="text-xs text-text-muted">
                  {{ periodLabels[b.period] }} · {{ b.currency }}
                  <span v-if="b.name"> · {{ categoryName(b.category_id) }}</span>
                </p>
              </div>
              <div class="flex items-center gap-1">
                <AlertTriangle v-if="statusOf(b) === 'over'" :size="16" class="text-danger" />
                <AlertTriangle v-else-if="statusOf(b) === 'warn'" :size="16" class="text-warning" />
                <button class="app-btn app-btn-ghost !p-1 opacity-0 group-hover:opacity-100" @click="openEdit(b)">
                  <Pencil :size="14" />
                </button>
                <button class="app-btn app-btn-ghost !p-1 text-danger opacity-0 group-hover:opacity-100" @click="onDelete(b)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <div class="mt-3 space-y-1.5">
              <div class="flex items-baseline justify-between text-xs">
                <span class="font-mono tabular-nums"
                      :class="{
                        'text-danger font-semibold': statusOf(b) === 'over',
                        'text-warning font-semibold': statusOf(b) === 'warn',
                      }">
                  {{ formatCurrency(Number(b.spent), b.currency) }}
                </span>
                <span class="text-text-muted font-mono tabular-nums">
                  de {{ formatCurrency(Number(b.amount), b.currency) }}
                </span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-elevated">
                <div
                  class="h-full rounded-full transition-all"
                  :class="{
                    'bg-success': statusOf(b) === 'ok',
                    'bg-warning': statusOf(b) === 'warn',
                    'bg-danger': statusOf(b) === 'over',
                  }"
                  :style="{ width: progressOf(b) + '%' }"
                />
              </div>
              <p v-if="statusOf(b) === 'over'" class="text-xs text-danger">
                Superaste el presupuesto por {{ formatCurrency(Number(b.spent) - Number(b.amount), b.currency) }}
              </p>
              <p v-else class="text-xs text-text-muted tabular-nums">
                Te quedan {{ formatCurrency(Math.max(0, Number(b.amount) - Number(b.spent)), b.currency) }}
                · {{ formatDate(b.period_end) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
