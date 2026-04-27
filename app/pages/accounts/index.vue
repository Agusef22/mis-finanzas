<script setup lang="ts">
import {
  Plus, Wallet, Landmark, CreditCard, PiggyBank, TrendingUp, Smartphone, Package,
  Archive, ArchiveRestore, Trash2, X as XIcon, AlertTriangle,
} from 'lucide-vue-next'
import {
  useAccountBalances,
  useArchivedAccounts,
  useCreateAccount,
  useArchiveAccount,
  useUnarchiveAccount,
  useDeleteAccountCascade,
  useAccountTxCount,
} from '~/composables/useAccounts'
import { useProfile } from '~/composables/useProfile'
import { formatCurrency, formatDate } from '~/utils/format'

const { data: balances, isLoading } = useAccountBalances()
const { data: archived, isLoading: loadingArchived } = useArchivedAccounts()
const { data: profile } = useProfile()
const createAccount = useCreateAccount()
const archiveAccount = useArchiveAccount()
const unarchiveAccount = useUnarchiveAccount()
const deleteAccountCascade = useDeleteAccountCascade()

const showForm = ref(false)
const showArchived = ref(false)

const form = reactive({
  name: '',
  type: 'cash' as const,
  currency: 'ARS',
  initial_balance: 0,
  icon: '💵',
  color: '#dc6f2e',
})

watch([showForm, profile], ([open, p]) => {
  if (open && p?.default_currency) form.currency = p.default_currency
})

const accountTypes = [
  { value: 'cash', label: 'Efectivo', icon: Wallet },
  { value: 'bank', label: 'Banco', icon: Landmark },
  { value: 'credit_card', label: 'Tarjeta de crédito', icon: CreditCard },
  { value: 'savings', label: 'Ahorros', icon: PiggyBank },
  { value: 'investment', label: 'Inversiones', icon: TrendingUp },
  { value: 'wallet', label: 'Billetera virtual', icon: Smartphone },
  { value: 'other', label: 'Otra', icon: Package },
]

function iconForType(t: string) {
  return accountTypes.find(x => x.value === t)?.icon ?? Wallet
}

async function onSubmit() {
  await createAccount.mutateAsync({ ...form })
  showForm.value = false
  form.name = ''
  form.initial_balance = 0
}

const { confirm: showConfirm } = useConfirm()
const { toast } = useToast()

async function onArchive(id: string, name: string) {
  const ok = await showConfirm({
    title: `¿Archivar "${name}"?`,
    description: 'La cuenta se oculta pero sus movimientos se conservan. Podés desarchivarla en cualquier momento.',
    confirmText: 'Archivar',
  })
  if (!ok) return
  archiveAccount.mutate(id)
}

const deleteTarget = ref<{ id: string; name: string } | null>(null)
const deleteTargetId = computed(() => deleteTarget.value?.id ?? null)
const { data: txCount, isLoading: loadingCount } = useAccountTxCount(deleteTargetId)
const confirmText = ref('')
const confirmRequired = computed(() => (txCount.value ?? 0) > 0)
const canConfirm = computed(() => {
  if (!confirmRequired.value) return true
  return confirmText.value.trim() === deleteTarget.value?.name
})

function openDeleteDialog(id: string, name: string) {
  deleteTarget.value = { id, name }
  confirmText.value = ''
}
function closeDialog() { deleteTarget.value = null; confirmText.value = '' }

async function confirmDelete() {
  if (!deleteTarget.value || !canConfirm.value) return
  const { id, name } = deleteTarget.value
  try {
    await deleteAccountCascade.mutateAsync(id)
    closeDialog()
    toast.success(`"${name}" eliminada`)
  } catch (e: any) {
    toast.error(`No se pudo eliminar: ${e?.message ?? 'error desconocido'}`)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="font-serif text-3xl">Cuentas</h1>
      <button class="app-btn app-btn-primary" @click="showForm = !showForm">
        <component :is="showForm ? XIcon : Plus" :size="16" />
        {{ showForm ? 'Cerrar' : 'Nueva' }}
      </button>
    </div>

    <!-- Form de nueva cuenta -->
    <form v-if="showForm" class="app-card space-y-4 animate-fade-in" @submit.prevent="onSubmit">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="app-label">Nombre</label>
          <input v-model="form.name" class="app-input" required placeholder="Mi cuenta" />
        </div>
        <div>
          <label class="app-label">Tipo</label>
          <select v-model="form.type" class="app-input">
            <option v-for="t in accountTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div>
          <label class="app-label">Moneda</label>
          <select v-model="form.currency" class="app-input">
            <option value="ARS">ARS · Peso argentino</option>
            <option value="USD">USD · Dólar</option>
            <option value="EUR">EUR · Euro</option>
            <option value="BRL">BRL · Real brasilero</option>
            <option value="UYU">UYU · Peso uruguayo</option>
            <option value="CLP">CLP · Peso chileno</option>
          </select>
        </div>
        <div>
          <label class="app-label">Balance inicial</label>
          <input v-model.number="form.initial_balance" type="number" step="0.01" class="app-input font-mono" />
        </div>
        <div>
          <label class="app-label">Ícono</label>
          <input v-model="form.icon" class="app-input" placeholder="Emoji" maxlength="2" />
        </div>
        <div>
          <label class="app-label">Color</label>
          <input v-model="form.color" type="color" class="app-input h-10 !p-1 cursor-pointer" />
        </div>
      </div>
      <button class="app-btn app-btn-primary w-full !py-3" type="submit" :disabled="createAccount.isPending.value">
        {{ createAccount.isPending.value ? 'Creando…' : 'Crear cuenta' }}
      </button>
    </form>

    <!-- Activas -->
    <section>
      <h2 class="mb-3 text-sm font-medium text-text-soft">Activas</h2>

      <div v-if="isLoading" class="app-card text-sm text-text-muted">Cargando…</div>

      <div v-else-if="!balances?.length" class="app-card text-center text-sm text-text-muted">
        No tenés cuentas activas. Creá una arriba.
      </div>

      <div v-else class="grid-cards">
        <div v-for="b in balances" :key="b.account_id" class="group relative overflow-hidden app-card">
          <div class="flex items-start gap-4">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              :style="{ backgroundColor: 'rgb(var(--color-accent-soft))', color: 'rgb(var(--color-accent))' }"
            >
              <component :is="iconForType(b.type)" :size="22" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-base font-medium">{{ b.name }}</p>
              <p class="text-xs text-text-muted capitalize">{{ b.type.replace('_', ' ') }} · {{ b.currency }}</p>
              <p class="mt-3 truncate font-mono text-xl sm:text-2xl font-semibold tabular-nums">
                {{ formatCurrency(Number(b.balance), b.currency) }}
              </p>
            </div>
          </div>
          <div class="mt-3 flex justify-end gap-2 border-t border-border pt-3">
            <button class="app-btn app-btn-ghost !py-1 text-xs" @click="onArchive(b.account_id, b.name)">
              <Archive :size="14" /> Archivar
            </button>
            <button class="app-btn app-btn-ghost !py-1 text-xs text-danger" @click="openDeleteDialog(b.account_id, b.name)">
              <Trash2 :size="14" /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Archivadas -->
    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-medium text-text-soft">
          Archivadas
          <span v-if="archived?.length" class="ml-1 inline-flex items-center rounded-full bg-elevated px-2 py-0.5 text-xs text-text-muted">
            {{ archived.length }}
          </span>
        </h2>
        <button
          v-if="archived?.length"
          class="text-xs text-accent hover:underline"
          @click="showArchived = !showArchived"
        >
          {{ showArchived ? 'Ocultar' : 'Mostrar' }}
        </button>
      </div>

      <div v-if="loadingArchived" class="app-card text-sm text-text-muted">Cargando…</div>
      <p v-else-if="!archived?.length" class="text-xs text-text-muted">Ninguna cuenta archivada.</p>

      <div v-else-if="showArchived" class="grid-cards animate-fade-in">
        <div v-for="a in archived" :key="a.id" class="app-card flex items-center gap-3 opacity-70 grayscale">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-elevated">
            <component :is="iconForType(a.type)" :size="18" class="text-text-muted" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium line-through">{{ a.name }}</p>
            <p class="text-xs text-text-muted">
              {{ a.currency }} · archivada {{ formatDate(a.archived_at!) }}
            </p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <button class="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline" @click="unarchiveAccount.mutate(a.id)">
              <ArchiveRestore :size="14" /> Desarchivar
            </button>
            <button class="text-xs text-text-muted hover:text-danger" @click="openDeleteDialog(a.id, a.name)">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Delete dialog -->
    <AppDialog :open="!!deleteTarget" @close="closeDialog">
      <template v-if="deleteTarget">
        <h3 class="font-serif text-xl leading-tight">
          Eliminar "{{ deleteTarget.name }}"
        </h3>

        <p v-if="loadingCount" class="mt-3 text-sm text-text-muted">Verificando…</p>

        <template v-else>
          <p v-if="(txCount ?? 0) === 0" class="mt-3 text-sm text-text-soft">
            La cuenta no tiene movimientos. Se va a eliminar definitivamente.
          </p>

          <div v-else class="mt-3 space-y-4">
            <div class="flex gap-3 rounded-lg bg-danger-bg p-3 text-sm">
              <AlertTriangle :size="20" class="shrink-0 text-danger mt-0.5" />
              <div>
                <p class="font-medium text-danger">Acción destructiva</p>
                <p class="mt-1 text-text-soft">
                  Esta cuenta tiene <strong class="text-text">{{ txCount }} movimiento{{ (txCount ?? 0) === 1 ? '' : 's' }}</strong>.
                  Al eliminarla se van a borrar todos, incluyendo las transferencias donde participe.
                  <strong>No se puede deshacer.</strong>
                </p>
              </div>
            </div>

            <p class="text-sm text-text-soft">
              Si preferís conservar los datos, usá <strong class="text-text">Archivar</strong>.
            </p>

            <div>
              <label class="app-label">Para confirmar, escribí el nombre exacto:</label>
              <input v-model="confirmText" class="app-input font-mono" :placeholder="deleteTarget.name" />
            </div>
          </div>
        </template>

        <div class="mt-5 flex justify-end gap-2">
          <button class="app-btn app-btn-secondary" @click="closeDialog">Cancelar</button>
          <button
            class="app-btn app-btn-danger"
            :disabled="!canConfirm || loadingCount || deleteAccountCascade.isPending.value"
            @click="confirmDelete"
          >
            {{ deleteAccountCascade.isPending.value ? 'Eliminando…' : 'Eliminar' }}
          </button>
        </div>
      </template>
    </AppDialog>
  </div>
</template>
