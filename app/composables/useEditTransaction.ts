import type { Transaction } from '~/types/database'

interface EditState {
  open: boolean
  transaction: Transaction | null
}

/**
 * Estado global para el dialog de edición de transacciones.
 * Lo consume <TransactionEditDialog /> (montado una vez en el layout).
 *
 * Uso:
 *   const { edit } = useEditTransaction()
 *   edit(tx)  // abre el dialog
 */
export function useEditTransaction() {
  const state = useState<EditState>('edit-transaction', () => ({
    open: false,
    transaction: null,
  }))

  function edit(tx: Transaction) {
    state.value = { open: true, transaction: tx }
  }

  function close() {
    state.value = { open: false, transaction: null }
  }

  return {
    state: readonly(state),
    edit,
    close,
  }
}
