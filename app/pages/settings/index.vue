<script setup lang="ts">
import {
  User, DollarSign, TrendingUp, MessageCircle, MessageSquare, Copy, Check, Unlink,
} from 'lucide-vue-next'
import { useProfile, useUpdateProfile } from '~/composables/useProfile'
import { useChatIdentities, useGenerateLinkCode, useUnlinkIdentity } from '~/composables/useChatLinking'
import type { ChatProvider } from '~/types/database'

const { data: profile } = useProfile()
const updateProfile = useUpdateProfile()

const { data: identities, isLoading: loadingIds } = useChatIdentities()
const genCode = useGenerateLinkCode()
const unlink = useUnlinkIdentity()

const activeCode = ref<{ provider: ChatProvider; code: string; expiresAt: number } | null>(null)
const countdown = ref(0)
let interval: number | null = null
const copied = ref(false)

async function generate(provider: ChatProvider) {
  const code = await genCode.mutateAsync(provider)
  activeCode.value = { provider, code, expiresAt: Date.now() + 10 * 60 * 1000 }
  if (interval) clearInterval(interval)
  tick()
  interval = window.setInterval(tick, 1000)
}

function tick() {
  if (!activeCode.value) return
  const remaining = Math.max(0, Math.floor((activeCode.value.expiresAt - Date.now()) / 1000))
  countdown.value = remaining
  if (remaining === 0) {
    activeCode.value = null
    if (interval) { clearInterval(interval); interval = null }
  }
}

async function copyCode() {
  if (!activeCode.value || !import.meta.client) return
  await navigator.clipboard.writeText(`vincular ${activeCode.value.code}`)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

onUnmounted(() => { if (interval) clearInterval(interval) })

const displayName = ref('')
const defaultCurrency = ref<'ARS' | 'USD'>('ARS')
const defaultRateType = ref<'oficial' | 'blue' | 'mep' | 'ccl'>('blue')

watchEffect(() => {
  if (profile.value) {
    displayName.value = profile.value.display_name || ''
    defaultCurrency.value = profile.value.default_currency as any
    defaultRateType.value = profile.value.default_rate_type as any
  }
})

const profileStatus = ref<'idle' | 'ok' | 'error'>('idle')
const profileError = ref<string | null>(null)
let statusTimer: number | null = null

async function saveProfile() {
  profileStatus.value = 'idle'
  profileError.value = null
  try {
    await updateProfile.mutateAsync({
      display_name: displayName.value,
      default_currency: defaultCurrency.value,
      default_rate_type: defaultRateType.value,
    })
    profileStatus.value = 'ok'
  } catch (e: any) {
    profileStatus.value = 'error'
    profileError.value = e?.message ?? 'Error desconocido'
  } finally {
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = window.setTimeout(() => { profileStatus.value = 'idle' }, 4000)
  }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="font-serif text-3xl">Ajustes</h1>

    <!-- Profile -->
    <section class="app-card space-y-5">
      <div class="flex items-center gap-2">
        <User :size="18" class="text-accent" />
        <h2 class="text-base font-medium">Perfil</h2>
      </div>

      <div class="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <div>
          <label class="app-label">Nombre</label>
          <input v-model="displayName" class="app-input" />
        </div>

        <div>
          <label class="app-label">Moneda principal</label>
          <select v-model="defaultCurrency" class="app-input">
            <option value="ARS">ARS · Peso</option>
            <option value="USD">USD · Dólar</option>
          </select>
          <p class="mt-1 text-xs text-text-muted">
            Usada para el total consolidado.
          </p>
        </div>

        <div>
          <label class="app-label">Cotización ARS/USD</label>
          <select v-model="defaultRateType" class="app-input">
            <option value="oficial">Oficial</option>
            <option value="blue">Blue</option>
            <option value="mep">MEP</option>
            <option value="ccl">CCL</option>
          </select>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button class="app-btn app-btn-primary" @click="saveProfile" :disabled="updateProfile.isPending.value">
          {{ updateProfile.isPending.value ? 'Guardando…' : 'Guardar' }}
        </button>
        <Transition
          enter-active-class="transition duration-200"
          enter-from-class="opacity-0 translate-x-2"
          enter-to-class="opacity-100 translate-x-0"
        >
          <span
            v-if="profileStatus === 'ok'"
            class="inline-flex items-center gap-1 text-sm text-success"
          >
            <Check :size="14" /> Guardado
          </span>
          <span
            v-else-if="profileStatus === 'error'"
            class="text-sm text-danger"
          >
            ✗ {{ profileError }}
          </span>
        </Transition>
      </div>
    </section>

    <!-- Chat linking -->
    <section class="app-card space-y-5">
      <div class="flex items-center gap-2">
        <MessageCircle :size="18" class="text-olive" />
        <h2 class="text-base font-medium">Canales de ingreso rápido</h2>
      </div>
      <p class="text-sm text-text-soft">
        Vinculá Telegram o WhatsApp para cargar gastos escribiendo por chat.
      </p>

      <div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <button
          type="button"
          class="flex items-center justify-between rounded-xl border border-border bg-elevated/60 p-4 text-left transition hover:border-accent/30 hover:bg-elevated"
          @click="generate('telegram')"
        >
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2AABEE]/15 text-[#2AABEE]">
              <MessageCircle :size="20" />
            </div>
            <div>
              <p class="font-medium">Telegram</p>
              <p class="text-xs text-text-muted">Hablale al bot con un código</p>
            </div>
          </div>
          <span class="text-sm text-accent">Vincular →</span>
        </button>

        <button
          type="button"
          class="flex items-center justify-between rounded-xl border border-border bg-elevated/60 p-4 text-left transition hover:border-accent/30 hover:bg-elevated"
          @click="generate('whatsapp')"
        >
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#25D366]">
              <MessageSquare :size="20" />
            </div>
            <div>
              <p class="font-medium">WhatsApp</p>
              <p class="text-xs text-text-muted">Escribí al sandbox de Twilio</p>
            </div>
          </div>
          <span class="text-sm text-accent">Vincular →</span>
        </button>
      </div>

      <!-- Código activo -->
      <div
        v-if="activeCode"
        class="rounded-xl border border-accent/30 bg-accent-soft/60 p-5 text-center animate-fade-in"
      >
        <p class="text-xs uppercase tracking-widest text-accent">
          Mandá este mensaje por {{ activeCode.provider }}
        </p>
        <div class="my-3 flex items-center justify-center gap-2">
          <p class="font-mono text-2xl font-semibold tracking-wide text-text">
            vincular {{ activeCode.code }}
          </p>
          <button
            class="app-btn app-btn-ghost !p-2"
            :title="copied ? 'Copiado' : 'Copiar'"
            @click="copyCode"
          >
            <Check v-if="copied" :size="16" class="text-success" />
            <Copy v-else :size="16" />
          </button>
        </div>
        <p class="text-xs text-text-muted">Expira en {{ countdown }}s</p>
      </div>

      <!-- Identidades vinculadas -->
      <div v-if="!loadingIds && identities?.length">
        <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">Vinculados</h3>
        <div class="space-y-2">
          <div
            v-for="id in identities"
            :key="id.id"
            class="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <component
              :is="id.provider === 'telegram' ? MessageCircle : MessageSquare"
              :size="18"
              class="shrink-0 text-text-soft"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ id.display_name || id.external_id }}</p>
              <p class="text-xs text-text-muted truncate">{{ id.provider }} · {{ id.external_id }}</p>
            </div>
            <button
              class="app-btn app-btn-ghost !p-1.5 text-danger"
              :title="'Desvincular ' + id.provider"
              @click="unlink.mutate(id.id)"
            >
              <Unlink :size="15" />
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
