<script setup lang="ts">
import { Pencil, ArrowLeftRight, Info } from 'lucide-vue-next'
import { useAccounts } from '~/composables/useAccounts'
import { useCategories } from '~/composables/useCategories'
import { useUpdateTransaction } from '~/composables/useTransactions'
import type { CategoryKind } from '~/types/database'

const { state, close } = useEditTransaction()
const { data: accounts } = useAccounts()
const { data: categories } = useCategories()
const updateTx = useUpdateTransaction()
const { toast } = useToast()

const tx = computed(() => state.value.transaction)
const isTransfer = computed(() => tx.value?.type === 'transfer')

// Form local
const form = reactive({
  amount: '',
  account_id: '',
  category_id: '',
  description: '',
  notes: '',
  occurred_at: '',
})

const error = ref<string | null>(null)

// Cuando se abre con una tx nueva, poblar el form
watch(
  () => state.value.open,
  (open) => {
    if (!open || !tx.value) return
    form.amount = String(tx.value.amount)
    form.account_id = tx.value.account_id
    form.category_id = tx.value.category_id ?? ''
    form.description = tx.value.description ?? ''
    form.notes = tx.value.notes ?? ''
    form.occurred_at = tx.value.occurred_at.slice(0, 16)
    error.value = null
  },
)

// Categorías filtradas por tipo (solo para expense/income)
const filteredCategories = computed(() => {
  if (!categories.value || !tx.value) return []
  const kind = tx.value.type as CategoryKind
  return categories.value.filter(c => c.kind === kind || c.kind === 'both')
})

const selectedAccount = computed(() =>
  accounts.value?.find(a => a.id === form.account_id),
)

async function submit() {
  if (!tx.value) return
  error.value = null

  const patch: Record<string, any> = {
    description: form.description || null,
    notes: form.notes || null,
    occurred_at: new Date(form.occurred_at).toISOString(),
  }

  if (!isTransfer.value) {
    const amt = Number(form.amount)
    if (!amt || amt <= 0) { error.value = 'Monto inválido'; return }
    if (!form.account_id) { error.value = 'Elegí una cuenta'; return }

    patch.amount = amt
    patch.account_id = form.account_id
    patch.category_id = form.category_id || null
    // Si cambió la cuenta, actualizar también la moneda snapshot
    if (selectedAccount.value && selectedAccount.value.currency !== tx.value.currency) {
      patch.currency = selectedAccount.value.currency
    }
  }

  try {
    await updateTx.mutateAsync({ id: tx.value.id, patch })
    toast.success('Movimiento actualizado')
    close()
  } catch (e: any) {
    error.value = e?.message ?? 'Error al actualizar'
  }
}
</script>

<template>
  <AppDialog :open="state.open" @close="close">
    <template v-if="tx">
      <div class="flex items-center gap-3 mb-4">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Pencil :size="18" />
        </div>
        <div>
          <h3 class="font-serif text-xl leading-tight">Editar movimiento</h3>
          <p class="text-xs text-text-muted capitalize">
            {{ tx.type }}
          </p>
        </div>
      </div>

      <div v-if="isTransfer" class="mb-4 flex gap-2 rounded-lg bg-warning-bg/50 p-3 text-xs text-warning">
        <Info :size="14" class="mt-0.5 shrink-0" />
        <p>
          Esta es una transferencia. Podés editar descripción, notas y fecha.
          Para cambiar el monto o las cuentas, borrala y creá una nueva.
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div v-if="!isTransfer">
          <label class="app-label">Monto</label>
          <div class="relative">
            <input
              v-model="form.amount"
              type="number"
              min="0"
              step="0.01"
              required
              class="app-input !pr-14 font-mono text-lg tabular-nums"
            />
            <span v-if="selectedAccount" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-text-muted">
              {{ selectedAccount.currency }}
            </span>
          </div>
        </div>

        <div v-if="!isTransfer" class="grid grid-cols-2 gap-3">
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
          <input v-model="form.description" type="text" class="app-input" />
        </div>

        <div>
          <label class="app-label">Fecha</label>
          <input v-model="form.occurred_at" type="datetime-local" class="app-input" />
        </div>

        <div>
          <label class="app-label">Notas</label>
          <textarea v-model="form.notes" rows="2" class="app-input" placeholder="Opcional" />
        </div>

        <p v-if="error" class="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{{ error }}</p>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="app-btn app-btn-secondary" @click="close">
            Cancelar
          </button>
          <button
            type="submit"
            class="app-btn app-btn-primary"
            :disabled="updateTx.isPending.value"
          >
            {{ updateTx.isPending.value ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </template>
  </AppDialog>
</template>
