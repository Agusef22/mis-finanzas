// Parser híbrido: regex primero, LLM como fallback.
import { callLLM } from './openrouter.ts'
import { guessCategoryFromKeywords } from './category-keywords.ts'
import { parseRelativeDate } from './date-parser.ts'
import type { ParsedTransaction } from './types.ts'

// ------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------

function cleanDescription(text: string | null | undefined): string | null {
  if (!text) return null
  let s = text.trim()
  s = s.replace(/^[,.;:!?\-–—\s]+/, '')
  s = s.replace(/[,.;:!?\-–—\s]+$/, '') // también al final
  s = s.replace(/^(?:ree?ci[eé]n(?:\s+que)?\s+|acabo\s+de\s+|che\s+|ya\s+|hoy\s+|ayer\s+|ahora\s+)+/i, '')
  s = s.replace(/\s+/g, ' ').trim()
  // Comas dobles o patrones tipo ", es "
  s = s.replace(/\s*,\s*/g, ', ').replace(/,\s*,/g, ',')

  // Si quedó trivial o solo stopwords → null
  if (!s) return null
  const stopwordsRegex = /^(?:el|la|los|las|un|una|uno|de|del|es|fue|sea|era|para|por|con|en|cuenta|categor[ií]a|ingreso|gasto|movimiento|[,.\s-]+)+$/i
  if (s.length < 3 || stopwordsRegex.test(s)) return null

  // Capitalizar primera letra
  s = s[0].toUpperCase() + s.slice(1)
  return s
}

function parseAmountToken(raw: string): number | null {
  const s = raw.toLowerCase().trim()
  const palosMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*palos?$/)
  if (palosMatch) return parseFloat(palosMatch[1].replace(',', '.')) * 1_000_000
  const lucasMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*lucas?$/)
  if (lucasMatch) return parseFloat(lucasMatch[1].replace(',', '.')) * 1000
  const kmatch = s.match(/^(\d+(?:[.,]\d+)?)\s*(k|mil)$/)
  if (kmatch) return parseFloat(kmatch[1].replace(',', '.')) * 1000

  // Formato latino: "1.700.000", "1.700.000,50"
  // Si tiene múltiples puntos → son separadores de miles
  const dots = (s.match(/\./g) || []).length
  const commas = (s.match(/,/g) || []).length
  let normalized = s
  if (dots > 1) {
    // múltiples puntos = separadores de miles → quitarlos
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (commas > 1) {
    normalized = s.replace(/,/g, '')
  } else if (dots === 1 && commas === 1) {
    // "1,700.50" o "1.700,50" → el segundo es decimal
    if (s.indexOf('.') < s.indexOf(',')) normalized = s.replace(/\./g, '').replace(',', '.')
    else normalized = s.replace(/,/g, '')
  } else {
    normalized = s.replace(',', '.')
  }

  const num = parseFloat(normalized)
  if (!Number.isNaN(num)) return num
  return null
}

const EXPENSE_KW = /(?:gast[eé]|pagu[eé]|compr[eé]|me\s+clav[eé]|sali[oó]|pag[oó])/i
const INCOME_KW = /(?:cobr[eé]|recib[ií]|ingres[oó]|me\s+pagaron|entr[oó]|gan[eé])/i
const CURRENCY_RE = /\b(usd|u\$s|d[oó]lares?|verde|verdes|eur|euros?|ars|pesos?)\b/i

function detectCurrency(text: string): string | null {
  const m = text.match(CURRENCY_RE)
  if (!m) return null
  const w = m[1].toLowerCase()
  if (/^(usd|u\$s|d[oó]lares?|verde|verdes)$/i.test(w)) return 'USD'
  if (/^(eur|euros?)$/i.test(w)) return 'EUR'
  if (/^(ars|pesos?)$/i.test(w)) return 'ARS'
  return null
}

/**
 * Busca una cuenta mencionada en el texto por nombre (fuzzy match).
 * Retorna { accountId, remaining } o null si no encuentra.
 * Busca patrones como "desde X", "con X", "en X" al final, y también nombres sueltos.
 */
interface AccountForMatch { id: string; name: string; currency: string }
export function extractAccountFromText(
  text: string,
  accounts: AccountForMatch[],
): { accountId: string; remaining: string } | null {
  const lower = text.toLowerCase()

  // Patrones explícitos: "desde|con|a través de <nombre>"
  const explicitMatch = text.match(/\b(desde|con|usando|a\s+trav[eé]s\s+de)\s+(.+?)$/i)
  if (explicitMatch) {
    const candidate = explicitMatch[2].trim().toLowerCase()
    const found = accounts.find(a => candidate.includes(a.name.toLowerCase()))
    if (found) {
      return {
        accountId: found.id,
        remaining: text.slice(0, explicitMatch.index).trim(),
      }
    }
  }

  // Match libre: alguna palabra al final del texto coincide con un nombre de cuenta
  const words = text.split(/\s+/).slice(-3).join(' ').toLowerCase()
  for (const a of accounts) {
    const n = a.name.toLowerCase()
    // Solo si el nombre es distintivo (no genérico tipo "cuenta")
    if (n.length >= 4 && words.includes(n)) {
      const idx = text.toLowerCase().lastIndexOf(n)
      return {
        accountId: a.id,
        remaining: (text.slice(0, idx) + text.slice(idx + n.length)).replace(/\s+/g, ' ').trim(),
      }
    }
  }

  return null
}

// ------------------------------------------------------------
// REGEX PATH
// ------------------------------------------------------------

export interface ParseContext {
  text: string
  occurredAt?: Date
  accountId?: string
}

export function parseWithRegex(text: string): ParsedTransaction | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  // ===== Intento 1: regex estricto "<verbo> <monto> ..."
  const main = trimmed.match(
    /^(?:(gast[eé]|pagu[eé]|compr[eé]|cobr[eé]|recib[ií]|ingres[oó]|me\s+pagaron|me\s+clav[eé]|gan[eé])\s+)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?:\s*(k|mil|lucas?|palos?))?\s*(?:(usd|u\$s|d[oó]lares?|eur|euros?|ars|pesos?)\s+)?(?:(?:en|de|por|para)\s+)?(.+)?$/i,
  )

  if (main) {
    const [, verb, amountRaw, multiplier, currencyRaw, rest] = main
    const rawAmount = multiplier ? `${amountRaw} ${multiplier}` : amountRaw
    const amount = parseAmountToken(rawAmount.trim())
    if (!amount || amount <= 0) return null

    let type: 'expense' | 'income' | null = null
    if (verb && EXPENSE_KW.test(verb)) type = 'expense'
    else if (verb && INCOME_KW.test(verb)) type = 'income'
    else type = 'expense'

    let currency: string | null = null
    if (currencyRaw) {
      const w = currencyRaw.toLowerCase()
      if (/^(usd|u\$s|d[oó]lares?|verde|verdes)$/i.test(w)) currency = 'USD'
      else if (/^(eur|euros?)$/i.test(w)) currency = 'EUR'
      else if (/^(ars|pesos?)$/i.test(w)) currency = 'ARS'
    }
    if (!currency && rest) currency = detectCurrency(rest)

    const description = cleanDescription(rest)

    return {
      amount, type, currency,
      category_hint: description,
      category_id: null,
      description,
      confidence: description ? 0.6 : 0.9,
    }
  }

  // ===== Intento 2: regex flexible — busca el número en cualquier lugar
  // y deduce el tipo (expense/income) por palabras del contexto.
  return parseFlexibleRegex(trimmed)
}

/**
 * Fallback para mensajes como "agregame un ingreso en sueldo de 1.700.000".
 * El número no viene al principio: lo buscamos en cualquier parte.
 */
function parseFlexibleRegex(text: string): ParsedTransaction | null {
  const lower = text.toLowerCase()

  // Buscar un monto en el texto (formato latino 1.700.000 o simple 1700)
  const numMatch = text.match(/\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?:\s*(k|mil|lucas?|palos?))?\b/i)
  if (!numMatch) return null

  const rawAmount = numMatch[2] ? `${numMatch[1]} ${numMatch[2]}` : numMatch[1]
  const amount = parseAmountToken(rawAmount)
  if (!amount || amount <= 0) return null

  // Detectar tipo por palabras en todo el texto (no solo al principio)
  let type: 'expense' | 'income' | null = null

  const hasIncomeKeywords = /\b(ingreso|cobr[eé]|recib[ií]|me\s+pagaron|sueldo|salario|entr[oó]|gan[eé]|hono?rarios?|freelance|cobranza|honorario)\b/i.test(lower)
  const hasExpenseKeywords = /\b(gast[eé]|pagu[eé]|compr[eé]|me\s+clav[eé]|pag[oó]|gasto\b|salid[aó])\b/i.test(lower)

  if (hasIncomeKeywords && !hasExpenseKeywords) type = 'income'
  else if (hasExpenseKeywords && !hasIncomeKeywords) type = 'expense'
  else if (hasIncomeKeywords && hasExpenseKeywords) return null // ambiguo, que vaya al LLM
  else return null // no hay pistas de tipo

  // Currency
  const currency = detectCurrency(text)

  // Descripción: sacar el número + palabras de "andamiaje" + stopwords
  const description = cleanDescription(
    text
      .replace(numMatch[0], ' ')
      // Verbos y frases de acción
      .replace(/\b(agreg[aá]me?|agreg[aá]r|sum[aá]me?|sumar|pone?me?|poner|cargar?me?|a[ñn]ad[íi]r?me?|registr[aá]r?me?|anot[aá]r?me?)\b/gi, ' ')
      // Palabras de tipo (el verbo ya se usa para detectar tipo, acá no aportan a la descripción)
      .replace(/\b(ingreso|gasto|movimiento|tr[aá]nsacci[oó]n|nuev[oa])\b/gi, ' ')
      // "entrada", "de entrada", "uno" (típico cuando el user aclara cuota o nro)
      .replace(/\b(entrada|de\s+entrada|uno|primer[oa])\b/gi, ' ')
      // "cuenta X" / "categoría X" — el nombre ya se extrae por separado si matchea
      .replace(/\bcuenta\b|\bcategor[ií]a\b/gi, ' ')
      // Verbos copulativos y conectores vacíos
      .replace(/\b(es|fue|son|sean|era|está|esta|están|estan)\b/gi, ' ')
      // Artículos y preposiciones
      .replace(/\b(un|una|unos|unas|el|la|los|las|de|del|en|con|por|para|mi|mis|tu|tus|su|sus|lo)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )

  return {
    amount, type, currency,
    category_hint: description,
    category_id: null,
    description,
    confidence: 0.55, // más bajo para que el LLM refinar si puede
  }
}

// ------------------------------------------------------------
// LLM PATH
// ------------------------------------------------------------

interface CategoryForLLM {
  id: string
  name: string
  kind: 'expense' | 'income' | 'both'
}

export async function parseWithLLM(text: string, categories: CategoryForLLM[]): Promise<ParsedTransaction | null> {
  const categoryList = categories
    .map(c => `- ${c.id} (${c.kind}): ${c.name}`)
    .join('\n')

  const system = `Sos un parser de transacciones financieras en español rioplatense de Argentina.
Tu trabajo es leer un mensaje informal y devolver un JSON estructurado.

## Reglas de parseo

Montos:
- "5mil", "5k", "5 lucas" = 5000
- "palo" = 1.000.000
- "luca" = 1000

Monedas:
- "verde", "dólares", "USD", "u$s" → currency: "USD"
- "pesos", "ARS" → currency: "ARS"
- Sin mención explícita → asumí "ARS"

Tipo:
- gasté, pagué, compré, me clavé, saqué, me fui (+monto) → "expense"
- cobré, recibí, me pagaron, ingresó, gané, sueldo, honorarios → "income"
- "agregame un ingreso", "sumame", "agregar ingreso", "nuevo ingreso" → "income"
- "agregame un gasto", "cargar gasto", "nuevo gasto" → "expense"
- Sin verbo pero con palabra clave ("sueldo", "freelance", "cobranza") → "income"
- Sin ninguna pista clara: asumí "expense"

Ejemplos:
- "agregame un ingreso en sueldo de 1700000" → type=income, amount=1700000, categoría=Sueldo, desc=null
- "agregame de ingreso 1700000 en la cuenta sueldo, es el sueldo de entrada uno" → type=income, amount=1700000, categoría=Sueldo, desc="Sueldo (entrada 1)"
- "sumale 50mil a freelance" → type=income, amount=50000, categoría=Freelance, desc=null
- "cargame 8500 en luz" → type=expense, amount=8500, categoría=Servicios, desc="Luz"
- "ingreso 300mil mi sueldo de abril" → type=income, amount=300000, categoría=Sueldo, desc="Sueldo abril"
- "gasté 5000 ayer en super" → type=expense, amount=5000, categoría=Supermercado, desc=null
- "acabo de cobrar 15k de un cliente" → type=income, amount=15000, categoría=Freelance, desc="Cobro cliente"

IMPORTANTE sobre la descripción:
- Si el mensaje solo describe la transacción con palabras redundantes (como "cuenta sueldo, es el sueldo") → devolvé null. La categoría ya informa.
- NO copies palabras como "ingreso", "gasto", "cuenta", "movimiento" — son ruido.
- La descripción debe agregar info que no esté ya en la categoría (ej: "cliente Juan", "cuota 1 de 3", "abril", "cumpleaños").
- Si no hay nada útil que agregar → null.

## Descripción — LIMPIALA bien

- NO copies literal. Reescribí prolija y corta.
- Sacá muletillas: "recién", "che", "ya", "ahora", "acabo de", "hoy", "ayer"
- Sacá comas o puntos iniciales.
- Capitalizá la primera letra.
- Máximo 5-6 palabras. Si no hay info útil, devolvé null.

## Categorización — ESFORZATE en encontrar la correcta

Elegí el id de la categoría más relevante de la lista. Pistas comunes:
- nafta, combustible, gasoil, YPF → Combustible
- super, chino, kiosko, coto → Supermercado
- resto, almuerzo, café, delivery, pedidosya, rappi → Gastronomía
- uber, taxi, subte, bondi, colectivo → Transporte
- luz, agua, gas, internet, wifi, expensas, abl → Servicios
- farmacia, médico, remedios → Salud
- spotify, netflix, youtube → Suscripciones
- alquiler → Alquiler
- sueldo → Sueldo
- freelance → Freelance
Si nada aplica → category_id: null

## Confianza
- 0.9+: si todo está claro
- 0.7-0.9: si falta categoría
- <0.7: si hay ambigüedad en monto o tipo

## Categorías disponibles:

${categoryList}

## Respuesta

Respondé SOLO JSON (sin markdown) con esta forma exacta:
{
  "amount": number,
  "type": "expense" | "income",
  "currency": "ARS" | "USD" | "EUR",
  "category_id": "<uuid>" | null,
  "category_hint": string | null,
  "description": string | null,
  "confidence": number
}`

  const raw = await callLLM(
    [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ],
    { responseFormatJson: true, temperature: 0.1, maxTokens: 300 },
  )

  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
    const parsed = JSON.parse(cleaned) as ParsedTransaction
    if (parsed.description) parsed.description = cleanDescription(parsed.description)
    return parsed
  } catch (e) {
    console.error('Failed to parse LLM JSON:', raw, e)
    return null
  }
}

// ------------------------------------------------------------
// ORQUESTACIÓN
// ------------------------------------------------------------

function validateCategoryId(parsed: ParsedTransaction, categories: CategoryForLLM[]): ParsedTransaction {
  if (parsed.category_id && !categories.some(c => c.id === parsed.category_id)) {
    console.warn('[parser] LLM returned invalid category_id:', parsed.category_id)
    parsed.category_id = null
  }
  return parsed
}

function fillCategoryFromKeywords(
  parsed: ParsedTransaction,
  categories: CategoryForLLM[],
  originalText: string,
): ParsedTransaction {
  if (parsed.category_id) return parsed
  const fromDesc = parsed.description ? guessCategoryFromKeywords(parsed.description, categories) : null
  if (fromDesc) { parsed.category_id = fromDesc; return parsed }
  const fromRaw = guessCategoryFromKeywords(originalText, categories)
  if (fromRaw) parsed.category_id = fromRaw
  return parsed
}

export interface ParseResult extends ParsedTransaction {
  occurredAt?: Date       // fecha extraída si se mencionó (ayer, 10/04, etc)
  accountId?: string | null  // cuenta mencionada en el texto si la encontramos
}

/**
 * Parser completo con fechas + cuenta extraídas del texto.
 */
export async function parseMessage(
  rawText: string,
  categories: CategoryForLLM[],
  accounts: AccountForMatch[] = [],
): Promise<ParseResult> {
  let text = rawText
  let occurredAt: Date | undefined

  const dateExtract = parseRelativeDate(text)
  if (dateExtract) {
    occurredAt = dateExtract.date
    text = dateExtract.remaining
  }

  let accountId: string | null = null
  if (accounts.length > 0) {
    const acctExtract = extractAccountFromText(text, accounts)
    if (acctExtract) {
      accountId = acctExtract.accountId
      text = acctExtract.remaining
    }
  }

  const fast = parseWithRegex(text)

  let parsed: ParsedTransaction

  if (fast && fast.amount && (!fast.description || fast.description.length < 2)) {
    console.log('[parser] regex resolvió sin descripción — sin LLM')
    parsed = fillCategoryFromKeywords({ ...fast, confidence: 0.9 }, categories, text)
  }
  else if (fast && fast.amount) {
    console.log('[parser] regex + descripción → llamando LLM para refinar')
    try {
      const llm = await parseWithLLM(text, categories)
      if (llm && llm.amount) {
        console.log('[parser] LLM respondió OK:', { amount: llm.amount, category_id: llm.category_id, description: llm.description })
        const validated = validateCategoryId(llm, categories)
        parsed = fillCategoryFromKeywords(validated, categories, text)
      } else {
        console.warn('[parser] LLM devolvió null/sin amount — usando regex con confidence baja')
        parsed = fillCategoryFromKeywords({ ...fast, confidence: 0.5 }, categories, text)
      }
    } catch (e) {
      console.error('[parser] LLM parse error:', (e as Error).message)
      parsed = fillCategoryFromKeywords({ ...fast, confidence: 0.5 }, categories, text)
    }
  }
  else {
    console.log('[parser] regex no encontró monto → llamando LLM de último recurso')
    try {
      const llm = await parseWithLLM(text, categories)
      if (llm && llm.amount) {
        const validated = validateCategoryId(llm, categories)
        parsed = fillCategoryFromKeywords(validated, categories, text)
      } else {
        parsed = {
          amount: null, type: null, currency: null,
          category_hint: null, category_id: null, description: null, confidence: 0,
        }
      }
    } catch (e) {
      console.error('[parser] LLM parse error:', (e as Error).message)
      parsed = {
        amount: null, type: null, currency: null,
        category_hint: null, category_id: null, description: null, confidence: 0,
      }
    }
  }

  return { ...parsed, occurredAt, accountId }
}
