import type { Currency } from '~/types/database'

export function formatCurrency(amount: number, currency: Currency = 'ARS', locale = 'es-AR'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatNumber(amount: number, locale = 'es-AR'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)
}

export function formatDate(d: string | Date, locale = 'es-AR'): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function formatDateTime(d: string | Date, locale = 'es-AR'): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function formatRelative(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes}m`
  if (hours < 24) return `hace ${hours}h`
  if (days < 7) return `hace ${days}d`
  return formatDate(date)
}
