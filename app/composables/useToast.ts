export type ToastVariant = 'info' | 'success' | 'error' | 'warning'

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
  timeout: number
}

let nextId = 1

/**
 * Toasts globales no bloqueantes.
 *
 * Uso:
 *   const { toast } = useToast()
 *   toast.success('Guardado')
 *   toast.error('No se pudo eliminar')
 *   toast.info('Nuevo dato disponible', 6000) // ms
 */
export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function push(message: string, variant: ToastVariant = 'info', timeout = 3500) {
    const id = nextId++
    const t: Toast = { id, message, variant, timeout }
    toasts.value = [...toasts.value, t]
    if (timeout > 0 && import.meta.client) {
      window.setTimeout(() => dismiss(id), timeout)
    }
    return id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  const toast = {
    info:    (msg: string, ms?: number) => push(msg, 'info', ms),
    success: (msg: string, ms?: number) => push(msg, 'success', ms),
    error:   (msg: string, ms?: number) => push(msg, 'error', ms ?? 5000),
    warning: (msg: string, ms?: number) => push(msg, 'warning', ms),
  }

  return { toast, toasts: readonly(toasts), dismiss }
}
