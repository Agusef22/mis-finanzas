<script setup lang="ts">
import { Plus, X as XIcon, Archive } from 'lucide-vue-next'
import { useCategories, useCreateCategory, useArchiveCategory } from '~/composables/useCategories'

const { data: categories, isLoading } = useCategories()
const createCategory = useCreateCategory()
const archiveCategory = useArchiveCategory()

const showForm = ref(false)
const form = reactive({
  name: '',
  kind: 'expense' as 'expense' | 'income' | 'both',
  icon: '📁',
  color: '#dc6f2e',
})

const expenseCats = computed(() => (categories.value ?? []).filter(c => c.kind === 'expense' || c.kind === 'both'))
const incomeCats = computed(() => (categories.value ?? []).filter(c => c.kind === 'income' || c.kind === 'both'))

async function onSubmit() {
  await createCategory.mutateAsync({ ...form })
  showForm.value = false
  form.name = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="font-serif text-3xl">Categorías</h1>
      <button class="app-btn app-btn-primary" @click="showForm = !showForm">
        <component :is="showForm ? XIcon : Plus" :size="16" />
        {{ showForm ? 'Cerrar' : 'Nueva' }}
      </button>
    </div>

    <form v-if="showForm" class="app-card space-y-4 animate-fade-in" @submit.prevent="onSubmit">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="app-label">Nombre</label>
          <input v-model="form.name" class="app-input" required />
        </div>
        <div>
          <label class="app-label">Tipo</label>
          <select v-model="form.kind" class="app-input">
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
            <option value="both">Ambos</option>
          </select>
        </div>
        <div>
          <label class="app-label">Ícono</label>
          <input v-model="form.icon" class="app-input" maxlength="2" />
        </div>
        <div>
          <label class="app-label">Color</label>
          <input v-model="form.color" type="color" class="app-input h-10 !p-1 cursor-pointer" />
        </div>
      </div>
      <button class="app-btn app-btn-primary w-full !py-3" type="submit" :disabled="createCategory.isPending.value">
        Crear
      </button>
    </form>

    <div v-if="isLoading" class="app-card text-sm text-text-muted">Cargando…</div>

    <div v-else class="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
      <section>
        <h2 class="mb-3 text-sm font-medium text-text-soft">
          Gastos
          <span class="ml-1 text-xs text-text-muted">({{ expenseCats.length }})</span>
        </h2>
        <div class="space-y-2">
          <div v-for="c in expenseCats" :key="c.id" class="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition hover:border-accent/30">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
              :style="{ backgroundColor: (c.color ?? '#dc6f2e') + '22' }"
            >
              {{ c.icon || '○' }}
            </div>
            <span class="flex-1 text-sm">{{ c.name }}</span>
            <span v-if="c.is_system" class="rounded-full bg-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">sys</span>
            <button
              v-if="!c.is_system"
              class="opacity-0 transition group-hover:opacity-100 text-text-muted hover:text-danger"
              :title="'Archivar ' + c.name"
              @click="archiveCategory.mutate(c.id)"
            >
              <Archive :size="15" />
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 class="mb-3 text-sm font-medium text-text-soft">
          Ingresos
          <span class="ml-1 text-xs text-text-muted">({{ incomeCats.length }})</span>
        </h2>
        <div class="space-y-2">
          <div v-for="c in incomeCats" :key="c.id" class="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition hover:border-accent/30">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
              :style="{ backgroundColor: (c.color ?? '#5c7a3e') + '22' }"
            >
              {{ c.icon || '○' }}
            </div>
            <span class="flex-1 text-sm">{{ c.name }}</span>
            <span v-if="c.is_system" class="rounded-full bg-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">sys</span>
            <button
              v-if="!c.is_system"
              class="opacity-0 transition group-hover:opacity-100 text-text-muted hover:text-danger"
              :title="'Archivar ' + c.name"
              @click="archiveCategory.mutate(c.id)"
            >
              <Archive :size="15" />
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
