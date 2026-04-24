<script setup lang="ts">
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Trash2, Pencil } from 'lucide-vue-next'
import type { Transaction } from '~/types/database'
import { formatCurrency, formatRelative } from '~/utils/format'

defineProps<{
  transactions: Transaction[]
  loading?: boolean
}>()

const emit = defineEmits<{ (e: 'delete', id: string): void }>()
const { confirm } = useConfirm()
const { edit } = useEditTransaction()

async function onDelete(id: string, desc: string | null) {
  const ok = await confirm({
    title: '¿Borrar este movimiento?',
    description: desc ? `"${desc}" se va a eliminar. No se puede deshacer.` : 'No se puede deshacer.',
    confirmText: 'Borrar',
    variant: 'danger',
  })
  if (!ok) return
  emit('delete', id)
}

function onEdit(tx: Transaction) {
  edit(tx)
}
</script>

<template>
  <div class="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
    <div v-if="loading && !transactions.length" class="px-3 py-4 text-sm text-text-muted">
      Cargando…
    </div>

    <div v-if="!loading && !transactions.length" class="px-3 py-6 text-center text-sm text-text-muted">
      No hay movimientos todavía.
    </div>

    <div
      v-for="tx in transactions"
      :key="tx.id"
      class="group flex items-center gap-2.5 px-3 py-2 transition hover:bg-elevated"
    >
      <!-- Icon -->
      <div
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
        :style="{
          backgroundColor: ((tx as any).category?.color ?? '#b4a088') + '22',
          color: (tx as any).category?.color ?? undefined,
        }"
      >
        <template v-if="(tx as any).category?.icon">
          {{ (tx as any).category.icon }}
        </template>
        <template v-else>
          <ArrowUpRight v-if="tx.type === 'income'" :size="14" />
          <ArrowLeftRight v-else-if="tx.type === 'transfer'" :size="14" />
          <ArrowDownLeft v-else :size="14" />
        </template>
      </div>

      <!-- Info -->
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <p class="truncate text-sm font-medium leading-tight">
            {{ tx.description || (tx as any).category?.name || (tx.type === 'income' ? 'Ingreso' : tx.type === 'transfer' ? 'Transferencia' : 'Gasto') }}
          </p>
          <span v-if="tx.source !== 'manual'" class="shrink-0 rounded-full bg-elevated px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-text-muted">
            {{ tx.source }}
          </span>
        </div>
        <p class="truncate text-[11px] text-text-muted leading-tight">
          <span v-if="(tx as any).account">{{ (tx as any).account.name }}</span>
          <span v-if="(tx as any).category"> · {{ (tx as any).category.name }}</span>
          · {{ formatRelative(tx.occurred_at) }}
        </p>
      </div>

      <!-- Amount + actions -->
      <div class="flex shrink-0 items-center gap-0.5">
        <p
          class="font-mono text-sm font-semibold tabular-nums"
          :class="{
            'text-success': tx.type === 'income',
            'text-danger': tx.type === 'expense',
            'text-text-soft': tx.type === 'transfer',
          }"
        >
          {{ tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : '' }}
          {{ formatCurrency(Number(tx.amount), tx.currency) }}
        </p>
        <button
          class="ml-1 rounded p-1 opacity-0 transition group-hover:opacity-100 text-text-muted hover:bg-border-soft hover:text-accent"
          :aria-label="'Editar ' + (tx.description || '')"
          title="Editar"
          @click="onEdit(tx)"
        >
          <Pencil :size="13" />
        </button>
        <button
          class="rounded p-1 opacity-0 transition group-hover:opacity-100 text-text-muted hover:bg-border-soft hover:text-danger"
          :aria-label="'Borrar ' + (tx.description || '')"
          title="Borrar"
          @click="onDelete(tx.id, tx.description)"
        >
          <Trash2 :size="13" />
        </button>
      </div>
    </div>
  </div>
</template>
