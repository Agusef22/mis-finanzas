import { useColorMode, usePreferredDark, useStorage } from '@vueuse/core'

export type ThemeMode = 'light' | 'dark' | 'auto'

/**
 * Maneja el modo light/dark/auto con persistencia en localStorage.
 * Aplica la clase `dark` en <html> cuando corresponde.
 */
export function useTheme() {
  const stored = useStorage<ThemeMode>('mis-finanzas-theme', 'auto')
  const prefersDark = usePreferredDark()

  const resolved = computed<'light' | 'dark'>(() => {
    if (stored.value === 'auto') return prefersDark.value ? 'dark' : 'light'
    return stored.value
  })

  function apply() {
    if (!import.meta.client) return
    const root = document.documentElement
    root.classList.toggle('dark', resolved.value === 'dark')
  }

  watch(resolved, apply, { immediate: true })

  function toggle() {
    // Ciclo: light → dark → auto → light
    stored.value = stored.value === 'light'
      ? 'dark'
      : stored.value === 'dark'
        ? 'auto'
        : 'light'
  }

  function setMode(mode: ThemeMode) {
    stored.value = mode
  }

  return {
    mode: stored,
    resolved,
    toggle,
    setMode,
  }
}
