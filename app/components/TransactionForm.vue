<script setup lang="ts">
import { TrendingDown, TrendingUp } from 'lucide-vue-next'
import { useAccounts } from '~/composables/useAccounts'
import { useCategories } from '~/composables/useCategories'
import { useCreateTransaction } from '~/composables/useTransactions'
import type { CategoryKind } from '~/types/database'

const emit = defineEmits<{ (e: 'created'): void }>()

const { data: accounts } = useAccounts()
const { data: categories } = useCategories()
const createTx = useCreateTransaction()

const form = reactive({
  type: 'expense' as 'expense' | 'income',
  amount: '',
  account_id: '',
  category_id: '',
  description: '',
  occurred_at: new Date().toISOString().slice(0, 16),
})

const selectedAccount = computed(() => accounts.value?.find(a => a.id === form.account_id))

const filteredCategories = computed(() => {
  if (!categories.value) return []
  const kind: CategoryKind = form.type
  return categories.value.filter(c => c.kind === kind || c.kind === 'both')
})

watchEffect(() => {
  if (!form.account_id && accounts.value?.length) form.account_id = accounts.value[0].id
})

const error = ref<string | null>(null)

async function submit() {
  error.value = null
  const amt = Number(form.amount)
  if (!amt || amt <= 0) { error.value = 'Monto inválido'; return }
  if (!form.account_id) { error.value = 'Elegí una cuenta'; return }
  try {
    await createTx.mutateAsync({
      type: form.type,
      amount: amt,
      account_id: form.account_id,
      category_id: form.category_id || null,
      currency: selectedAccount.value?.currency || 'ARS',
      description: form.description || null,
      occurred_at: new Date(form.occurred_at).toISOString(),
    })
    form.amount = ''; form.description = ''; form.category_id = ''
    emit('created')
  } catch (e: any) {
    error.value = e.message ?? 'Error al guardar'
  }
}
</script>

<template>
  <form class="app-card space-y-5" @submit.prevent="submit">
    <!-- Type switcher -->
    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        class="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition"
        :class="form.type === 'expense'
          ? 'bg-danger-bg text-danger ring-1 ring-danger/30'
          : 'bg-elevated text-text-soft hover:bg-border-soft'"
        @click="form.type = 'expense'; form.category_id = ''"
      >
        <TrendingDown :size="16" /> Gasto
      </button>
      <button
        type="button"
        class="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition"
        :class="form.type === 'income'
          ? 'bg-success-bg text-success ring-1 ring-success/30'
          : 'bg-elevated text-text-soft hover:bg-border-soft'"
        @click="form.type = 'income'; form.category_id = ''"
      >
        <TrendingUp :size="16" /> Ingreso
      </button>
    </div>

    <!-- Monto grande -->
    <div>
      <label class="app-label">Monto</label>
      <div class="relative">
        <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-2xl text-text-muted">
          {{ selectedAccount?.currency === 'USD' ? '$' : '$' }}
        </span>
        <input
          v-model="form.amount"
          type="number"
          min="0"
          step="0.01"
          required
          placeholder="0.00"
          class="app-input !py-4 !pl-10 font-mono text-2xl tabular-nums"
        />
        <span v-if="selectedAccount" class="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-text-muted">
          {{ selectedAccount.currency }}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="app-label">Cuenta</label>
        <select v-model="form.account_id" class="app-input" required>
          <option v-for="a in accounts || []" :key="a.id" :value="a.id">
            {{ a.icon }} {{ a.name }} ({{ a.currency }})
          </option>
        </select>
      </div>
      <div>
        <label class="app-label">Categoría</label>
        <select v-model="form.category_id" class="app-input">
          <option value="">Sin categoría</option>
          <option v-for="c in filteredCategories" :key="c.id" :value="c.id">
            {{ c.icon }} {{ c.name }}
          </option>
        </select>
      </div>
    </div>

    <div>
      <label class="app-label">Descripción</label>
      <input v-model="form.description" type="text" class="app-input" placeholder="Opcional" />
    </div>

    <div>
      <label class="app-label">Fecha</label>
      <input v-model="form.occurred_at" type="datetime-local" class="app-input" />
    </div>

    <p v-if="error" class="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{{ error }}</p>

    <button type="submit" :disabled="createTx.isPending.value" class="app-btn app-btn-primary w-full !py-3">
      {{ createTx.isPending.value ? 'Guardando…' : 'Guardar' }}
    </button>
  </form>
</template>
