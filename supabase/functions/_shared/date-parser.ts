// Parser de fechas relativas en español rioplatense.

/**
 * Busca una expresión de fecha al principio del texto.
 * Si encuentra, devuelve { date, remaining } con el texto sin esa parte.
 * Si no, devuelve null (el caller usa "ahora" como default).
 */
export function parseRelativeDate(text: string): { date: Date; remaining: string } | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()
  const now = new Date()

  // ===== Palabras simples al principio =====
  const simpleMap: Array<[RegExp, number]> = [
    [/^hoy\b/, 0],
    [/^ayer\b/, -1],
    [/^anteayer\b/, -2],
  ]
  for (const [re, days] of simpleMap) {
    if (re.test(lower)) {
      const d = new Date(now)
      d.setDate(d.getDate() + days)
      return { date: d, remaining: stripMatch(trimmed, re) }
    }
  }

  // ===== "hace N días" =====
  const hace = lower.match(/^hace\s+(\d+)\s+d[ií]as?\b/)
  if (hace) {
    const d = new Date(now)
    d.setDate(d.getDate() - parseInt(hace[1], 10))
    return { date: d, remaining: stripMatch(trimmed, /^hace\s+\d+\s+d[ií]as?\b/) }
  }

  // ===== "el lunes" / "el martes" / etc. =====
  const weekdays: Record<string, number> = {
    domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
    jueves: 4, viernes: 5, sábado: 6, sabado: 6,
  }
  const weekdayMatch = lower.match(/^(?:el\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/)
  if (weekdayMatch) {
    const targetDow = weekdays[weekdayMatch[1].toLowerCase().replace('á','a').replace('é','e')]
    const d = new Date(now)
    // "el lunes" → lunes pasado (últimos 7 días)
    const currentDow = d.getDay()
    let diff = currentDow - targetDow
    if (diff <= 0) diff += 7
    d.setDate(d.getDate() - diff)
    return { date: d, remaining: stripMatch(trimmed, /^(?:el\s+)?(?:domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/) }
  }

  // ===== DD/MM o DD-MM (opcional /YYYY) =====
  const dateMatch = lower.match(/^(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/)
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10)
    const month = parseInt(dateMatch[2], 10)
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear()
    if (year < 100) year += 2000
    const d = new Date(year, month - 1, day, now.getHours(), now.getMinutes())
    if (!Number.isNaN(d.getTime()) && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { date: d, remaining: stripMatch(trimmed, /^\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?\b/) }
    }
  }

  return null
}

function stripMatch(original: string, re: RegExp): string {
  return original.replace(re, '').trim().replace(/^[,.\s]+/, '')
}
