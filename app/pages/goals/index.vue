<script setup lang="ts">
import { Plus, X as XIcon, Trophy, Trash2, Pencil, CheckCircle2 } from 'lucide-vue-next'
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, type GoalStatus } from '~/composables/useGoals'
import { useAccounts } from '~/composables/useAccounts'
import { useProfile } from '~/composables/useProfile'
import { formatCurrency, formatDate } from '~/utils/format'

const { data: goals, isLoading } = useGoals()
const { data: accounts } = useAccounts()
const { data: profile } = useProfile()
const createGoal = useCreateGoal()
const updateGoal = useUpdateGoal()
const deleteGoal = useDeleteGoal()

const { confirm } = useConfirm()
const { toast } = useToast()

const showForm = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  name: '',
  description: '',
  target_amount: 0,
  currency: 'ARS',
  account_id: '' as string | null,
  manual_progress: 0,
  icon: '🎯',
  color: '#2563eb',
  deadline: '',
})

watch([showForm, profile], ([open, p]) => {
  if (open && p?.default_currency && !editingId.value) {
    form.currency = p.default_currency
  }
})

// Auto-ajuste de moneda: solo en modo CREATE. Si elegís una cuenta, la meta
// hereda su moneda. En EDIT preservamos la moneda original (el user puede
// tener meta USD con cuenta ARS linkeada → queremos que se convierta).
const userChangedAccount = ref(false)
function onAccountChange() {
  userChangedAccount.value = true
}
watch(() => form.account_id, (accId) => {
  if (editingId.value) return            // en edit, no auto-cambiar
  if (!userChangedAccount.value) return   // solo si fue el user, no programático
  userChangedAccount.value = false
  if (!accId) return
  const acc = accounts.value?.find(a => a.id === accId)
  if (acc && acc.currency !== form.currency) {
    form.currency = acc.currency
  }
})

function openNew() {
  editingId.value = null
  form.name = ''
  form.description = ''
  form.target_amount = 0
  form.currency = profile.value?.default_currency ?? 'ARS'
  form.account_id = ''
  form.manual_progress = 0
  form.icon = '🎯'
  form.color = '#2563eb'
  form.deadline = ''
  showForm.value = true
}

function openEdit(g: GoalStatus) {
  editingId.value = g.goal_id
  form.name = g.name
  form.description = g.description ?? ''
  form.target_amount = Number(g.target_amount)
  form.currency = g.currency
  form.account_id = g.account_id ?? ''
  form.manual_progress = Number(g.manual_progress ?? 0)
  form.icon = g.icon ?? '🎯'
  form.color = g.color ?? '#2563eb'
  form.deadline = g.deadline ?? ''
  showForm.value = true
}

async function onSubmit() {
  if (!form.name.trim()) { toast.error('Ponele un nombre a la meta'); return }
  if (form.target_amount <= 0) { toast.error('Monto objetivo inválido'); return }

  const payload = {
    name: form.name.trim(),
    description: form.description || null,
    target_amount: form.target_amount,
    currency: form.currency,
    account_id: form.account_id || null,
    manual_progress: form.account_id ? 0 : form.manual_progress,
    icon: form.icon || null,
    color: form.color || null,
    deadline: form.deadline || null,
  }

  try {
    if (editingId.value) {
      await updateGoal.mutateAsync({ id: editingId.value, patch: payload })
      toast.success('Meta actualizada')
    } else {
      await createGoal.mutateAsync(payload)
      toast.success('Meta creada')
    }
    showForm.value = false
    editingId.value = null
  } catch (e: any) {
    toast.error(e?.message ?? 'Error al guardar')
  }
}

async function onDelete(g: GoalStatus) {
  const ok = await confirm({
    title: `¿Borrar "${g.name}"?`,
    description: 'Se elimina solo la meta, los movimientos y cuentas asociadas no se tocan.',
    confirmText: 'Borrar',
    variant: 'danger',
  })
  if (!ok) return
  try {
    await deleteGoal.mutateAsync(g.goal_id)
    toast.success('Meta eliminada')
  } catch (e: any) {
    toast.error(e?.message ?? 'Error al borrar')
  }
}

async function markComplete(g: GoalStatus) {
  try {
    await updateGoal.mutateAsync({
      id: g.goal_id,
      patch: { completed_at: new Date().toISOString() } as any,
    })
    toast.success('¡Meta completada! 🎉')
  } catch (e: any) {
    toast.error(e?.message ?? 'Error')
  }
}

function daysRemaining(deadline: string | null): string | null {
  if (!deadline) return null
  const d = new Date(deadline)
  const now = new Date()
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `hace ${Math.abs(diff)} día${Math.abs(diff) === 1 ? '' : 's'}`
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'mañana'
  if (diff < 30) return `en ${diff} días`
  const months = Math.floor(diff / 30)
  return `en ${months} mes${months === 1 ? '' : 'es'}`
}

const accountName = computed(() => (id: string | null) => {
  if (!id) return null
  return accounts.value?.find(a => a.id === id)?.name ?? null
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight">Metas de ahorro</h1>
      <button class="app-btn app-btn-primary" @click="showForm ? (showForm = false) : openNew()">
        <component :is="showForm ? XIcon : Plus" :size="16" />
        {{ showForm ? 'Cerrar' : 'Nueva' }}
      </button>
    </div>

    <form v-if="showForm" class="app-card space-y-4 animate-fade-in" @submit.prevent="onSubmit">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">
          <label class="app-label">Nombre</label>
          <input v-model="form.name" class="app-input" placeholder="Ej: Compu nueva" required />
        </div>
        <div class="col-span-2">
          <label class="app-label">Descripción (opcional)</label>
          <input v-model="form.description" class="app-input" placeholder="MacBook Air M4" />
        </div>
        <div>
          <label class="app-label">Monto objetivo</label>
          <input v-model.number="form.target_amount" type="number" min="1" step="0.01" class="app-input font-mono" required />
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
        <div class="col-span-2">
          <label class="app-label">Linkear a una cuenta (opcional)</label>
          <select v-model="form.account_id" class="app-input" @change="onAccountChange">
            <option value="">No, llevar manualmente</option>
            <option v-for="a in accounts || []" :key="a.id" :value="a.id">
              {{ a.icon }} {{ a.name }} ({{ a.currency }})
            </option>
          </select>
          <p v-if="!accounts?.length" class="mt-1 text-xs text-warning">
            No tenés cuentas activas. Creá una en /accounts primero.
          </p>
          <p v-else class="mt-1 text-xs text-text-muted">
            Si linkeás una cuenta con distinta moneda (ej: cuenta ARS + meta USD),
            el progreso se convierte usando tu cotización preferida (blue/MEP/etc).
          </p>
        </div>
        <div v-if="!form.account_id" class="col-span-2">
          <label class="app-label">Progreso actual</label>
          <input v-model.number="form.manual_progress" type="number" min="0" step="0.01" class="app-input font-mono" />
        </div>
        <div>
          <label class="app-label">Fecha objetivo (opcional)</label>
          <input v-model="form.deadline" type="date" class="app-input" />
        </div>
        <div>
          <label class="app-label">Ícono</label>
          <input v-model="form.icon" class="app-input" maxlength="2" />
        </div>
      </div>
      <button class="app-btn app-btn-primary w-full" type="submit" :disabled="createGoal.isPending.value || updateGoal.isPending.value">
        {{ editingId ? 'Guardar cambios' : 'Crear meta' }}
      </button>
    </form>

    <div v-if="isLoading" class="app-card text-sm text-text-muted">Cargando…</div>

    <div v-else-if="!goals?.length" class="app-card text-center">
      <Trophy :size="32" class="mx-auto mb-2 text-text-muted" />
      <p class="text-sm text-text-soft">Todavía no pusiste metas.</p>
      <p class="mt-1 text-xs text-text-muted">
        Definí lo que querés juntar y mirá tu progreso en tiempo real.
      </p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="g in goals"
        :key="g.goal_id"
        class="app-card group"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
            :style="{ backgroundColor: (g.color ?? '#2563eb') + '22' }"
          >
            {{ g.icon || '🎯' }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="flex items-center gap-1.5 text-sm font-medium">
                  {{ g.name }}
                  <CheckCircle2 v-if="g.completed_at" :size="14" class="text-success" />
                </p>
                <p v-if="g.description" class="text-xs text-text-muted truncate">
                  {{ g.description }}
                </p>
                <p class="text-xs text-text-muted mt-0.5">
                  <span v-if="g.account_id">🔗 {{ accountName(g.account_id) }} · </span>
                  <span v-if="g.deadline">🗓 {{ daysRemaining(g.deadline) }}</span>
                </p>
              </div>
              <div class="flex items-center gap-1">
                <button
                  v-if="!g.completed_at && Number(g.pct_complete) >= 100"
                  class="app-btn app-btn-ghost !p-1 text-success"
                  title="Marcar completada"
                  @click="markComplete(g)"
                >
                  <CheckCircle2 :size="14" />
                </button>
                <button class="app-btn app-btn-ghost !p-1 opacity-0 group-hover:opacity-100" @click="openEdit(g)">
                  <Pencil :size="14" />
                </button>
                <button class="app-btn app-btn-ghost !p-1 text-danger opacity-0 group-hover:opacity-100" @click="onDelete(g)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <div class="mt-3 space-y-1.5">
              <div class="flex items-baseline justify-between text-xs">
                <span class="font-mono tabular-nums font-medium">
                  {{ formatCurrency(Number(g.current_amount), g.currency) }}
                </span>
                <span class="text-text-muted font-mono tabular-nums">
                  de {{ formatCurrency(Number(g.target_amount), g.currency) }}
                </span>
              </div>
              <p v-if="g.conversion_failed" class="text-xs text-warning">
                ⚠️ No se pudo convertir el saldo de la cuenta. Revisá tu cotización en /settings.
              </p>
              <p v-else-if="g.account_id && (accounts?.find(a => a.id === g.account_id)?.currency) !== g.currency" class="text-xs text-text-muted">
                💱 Saldo convertido desde {{ accounts?.find(a => a.id === g.account_id)?.currency }} con cotización {{ profile?.default_rate_type ?? 'blue' }}
              </p>
              <div class="h-2 overflow-hidden rounded-full bg-elevated">
                <div
                  class="h-full rounded-full transition-all"
                  :class="{
                    'bg-success': Number(g.pct_complete) >= 100,
                    'bg-accent': Number(g.pct_complete) < 100,
                  }"
                  :style="{ width: Math.min(100, Number(g.pct_complete)) + '%' }"
                />
              </div>
              <p class="flex items-baseline justify-between text-xs">
                <span class="font-mono tabular-nums text-text-muted">
                  {{ Number(g.pct_complete).toFixed(1) }}%
                </span>
                <span v-if="Number(g.pct_complete) < 100" class="text-text-muted tabular-nums">
                  Falta {{ formatCurrency(Math.max(0, Number(g.target_amount) - Number(g.current_amount)), g.currency) }}
                </span>
                <span v-else class="text-success font-medium">¡Completado!</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
