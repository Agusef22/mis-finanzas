<script setup lang="ts">
import { ArrowDown, ArrowLeftRight } from 'lucide-vue-next'
import { useAccounts } from '~/composables/useAccounts'
import { useCreateTransfer } from '~/composables/useTransactions'
import { useExchangeRates } from '~/composables/useExchangeRates'
import { useProfile } from '~/composables/useProfile'

const emit = defineEmits<{ (e: 'created'): void }>()

const { data: accounts } = useAccounts()
const { data: rates } = useExchangeRates()
const { data: profile } = useProfile()
const createTransfer = useCreateTransfer()

const form = reactive({
  from_account: '',
  to_account: '',
  amount: '',
  occurred_at: new Date().toISOString().slice(0, 16),
  description: '',
  exchange_rate: '',
  fee: '',
})

const fromAccount = computed(() => accounts.value?.find(a => a.id === form.from_account))
const toAccount = computed(() => accounts.value?.find(a => a.id === form.to_account))

const sameCurrency = computed(() => {
  if (!fromAccount.value || !toAccount.value) return true
  return fromAccount.value.currency === toAccount.value.currency
})

const suggestedRate = computed<number | null>(() => {
  if (sameCurrency.value || !fromAccount.value || !toAccount.value) return null
  const rateType = (profile.value?.default_rate_type ?? 'blue') as keyof NonNullable<typeof rates.value>
  const r = rates.value?.[rateType]
  if (!r) return null
  const from = fromAccount.value.currency
  const to = toAccount.value.currency
  if (from === 'USD' && to === 'ARS') return r.venta
  if (from === 'ARS' && to === 'USD') return 1 / r.venta
  return null
})

watchEffect(() => {
  if (!form.exchange_rate && suggestedRate.value) {
    form.exchange_rate = String(suggestedRate.value.toFixed(4))
  }
})

const arrivalPreview = computed(() => {
  const amt = Number(form.amount)
  if (!amt || amt <= 0) return null
  const fee = Number(form.fee) || 0
  if (sameCurrency.value) return amt - fee
  const rate = Number(form.exchange_rate) || 0
  if (!rate) return null
  return amt * rate - fee
})

const error = ref<string | null>(null)

async function submit() {
  error.value = null
  const amt = Number(form.amount)
  if (!form.from_account || !form.to_account) { error.value = 'Elegí origen y destino'; return }
  if (form.from_account === form.to_account) { error.value = 'No podés transferir a la misma cuenta'; return }
  if (!amt || amt <= 0) { error.value = 'Monto inválido'; return }
  if (!sameCurrency.value) {
    const rate = Number(form.exchange_rate)
    if (!rate || rate <= 0) { error.value = 'Ingresá el tipo de cambio'; return }
  }
  try {
    await createTransfer.mutateAsync({
      from_account: form.from_account,
      to_account: form.to_account,
      amount: amt,
      occurred_at: new Date(form.occurred_at).toISOString(),
      description: form.description || undefined,
      exchange_rate: sameCurrency.value ? undefined : Number(form.exchange_rate),
      fee: Number(form.fee) || 0,
    })
    emit('created')
  } catch (e: any) {
    error.value = e?.message ?? 'Error al transferir'
  }
}
</script>

<template>
  <form class="app-card space-y-5" @submit.prevent="submit">
    <!-- Desde → Hacia con ícono sugestivo -->
    <div class="space-y-3">
      <div>
        <label class="app-label">Desde</label>
        <select v-model="form.from_account" class="app-input" required>
          <option value="">Elegí cuenta origen</option>
          <option v-for="a in accounts || []" :key="a.id" :value="a.id">
            {{ a.icon }} {{ a.name }} ({{ a.currency }})
          </option>
        </select>
      </div>

      <div class="flex justify-center">
        <div class="rounded-full bg-elevated p-2 text-text-muted">
          <ArrowDown :size="16" />
        </div>
      </div>

      <div>
        <label class="app-label">Hacia</label>
        <select v-model="form.to_account" class="app-input" required>
          <option value="">Elegí cuenta destino</option>
          <option
            v-for="a in accounts || []"
            :key="a.id"
            :value="a.id"
            :disabled="a.id === form.from_account"
          >
            {{ a.icon }} {{ a.name }} ({{ a.currency }})
          </option>
        </select>
      </div>
    </div>

    <div>
      <label class="app-label">
        Monto
        <span v-if="fromAccount" class="text-text-muted">({{ fromAccount.currency }})</span>
      </label>
      <input
        v-model="form.amount"
        type="number"
        min="0"
        step="0.01"
        class="app-input !py-3 font-mono text-xl tabular-nums"
        placeholder="0.00"
        required
      />
    </div>

    <!-- Cambio de moneda -->
    <div v-if="!sameCurrency && fromAccount && toAccount" class="rounded-xl bg-warning-bg/50 p-4 ring-1 ring-warning/20">
      <p class="mb-3 flex items-center gap-2 text-sm font-medium text-warning">
        <ArrowLeftRight :size="14" />
        Cambio: {{ fromAccount.currency }} → {{ toAccount.currency }}
      </p>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="app-label">Tipo de cambio</label>
          <input
            v-model="form.exchange_rate"
            type="number"
            step="0.0001"
            class="app-input font-mono"
            :placeholder="suggestedRate ? String(suggestedRate.toFixed(4)) : ''"
            required
          />
          <p v-if="suggestedRate" class="mt-1 text-xs text-text-muted">
            Sugerido: {{ suggestedRate.toFixed(4) }} ({{ profile?.default_rate_type ?? 'blue' }})
          </p>
        </div>
        <div>
          <label class="app-label">Comisión</label>
          <input v-model="form.fee" type="number" step="0.01" class="app-input font-mono" placeholder="0" />
        </div>
      </div>
      <p v-if="arrivalPreview !== null" class="mt-3 text-sm">
        Llegan:
        <span class="font-mono font-semibold">{{ arrivalPreview.toFixed(2) }} {{ toAccount.currency }}</span>
      </p>
    </div>

    <div>
      <label class="app-label">Descripción</label>
      <input v-model="form.description" class="app-input" placeholder="Opcional" />
    </div>

    <div>
      <label class="app-label">Fecha</label>
      <input v-model="form.occurred_at" type="datetime-local" class="app-input" />
    </div>

    <p v-if="error" class="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{{ error }}</p>

    <button type="submit" :disabled="createTransfer.isPending.value" class="app-btn app-btn-primary w-full !py-3">
      <ArrowLeftRight :size="16" />
      {{ createTransfer.isPending.value ? 'Transfiriendo…' : 'Transferir' }}
    </button>
  </form>
</template>
