<script setup lang="ts">
import { X } from 'lucide-vue-next'

type Mode = 'tx' | 'transfer'
const mode = ref<Mode>('tx')

async function onCreated() {
  await navigateTo('/transactions')
}
</script>

<template>
  <div class="mx-auto max-w-lg space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="font-serif text-3xl">Nuevo movimiento</h1>
      <NuxtLink to="/transactions" class="app-btn app-btn-ghost !p-2" aria-label="Cancelar">
        <X :size="18" />
      </NuxtLink>
    </div>

    <div class="flex gap-1 rounded-lg bg-elevated p-1">
      <button
        type="button"
        class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition"
        :class="mode === 'tx' ? 'bg-surface text-text shadow-sm' : 'text-text-soft'"
        @click="mode = 'tx'"
      >
        Gasto / Ingreso
      </button>
      <button
        type="button"
        class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition"
        :class="mode === 'transfer' ? 'bg-surface text-text shadow-sm' : 'text-text-soft'"
        @click="mode = 'transfer'"
      >
        Transferencia
      </button>
    </div>

    <TransactionForm v-if="mode === 'tx'" @created="onCreated" />
    <TransferForm v-else @created="onCreated" />
  </div>
</template>
