export function monthRange(ref: Date = new Date()): { start: string; end: string; label: string } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 0, 0, 0, 0)
  const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(start)
  return { start: start.toISOString(), end: end.toISOString(), label }
}

export function shiftMonth(ref: Date, by: number): Date {
  return new Date(ref.getFullYear(), ref.getMonth() + by, 1)
}
