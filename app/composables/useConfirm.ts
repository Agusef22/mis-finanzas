import type { Component } from 'vue'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  icon?: Component
}

interface ConfirmState {
  open: boolean
  options: ConfirmOptions | null
  resolve: ((value: boolean) => void) | null
}

/**
 * Composable global para pedir confirmación al usuario con un modal custom.
 *
 * Uso:
 *   const { confirm } = useConfirm()
 *
 *   async function onDelete() {
 *     const ok = await confirm({
 *       title: '¿Borrar esto?',
 *       description: 'No se puede deshacer',
 *       variant: 'danger',
 *       confirmText: 'Borrar',
 *     })
 *     if (!ok) return
 *     // borrar...
 *   }
 */
export function useConfirm() {
  const state = useState<ConfirmState>('confirm-dialog', () => ({
    open: false,
    options: null,
    resolve: null,
  }))

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      state.value = { open: true, options, resolve }
    })
  }

  function handleConfirm() {
    if (state.value.resolve) state.value.resolve(true)
    close()
  }

  function handleCancel() {
    if (state.value.resolve) state.value.resolve(false)
    close()
  }

  function close() {
    state.value = { open: false, options: null, resolve: null }
  }

  return {
    confirm,
    state: readonly(state),
    handleConfirm,
    handleCancel,
  }
}
