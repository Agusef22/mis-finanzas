// Core: recibe un IncomingMessage, hace todo (auth, parse, save, reply).
import { getServiceClient } from './supabase.ts'
import { parseMessage } from './parser.ts'
import type { IncomingMessage, OutgoingMessage } from './types.ts'

type Supabase = ReturnType<typeof getServiceClient>

export async function processMessage(msg: IncomingMessage): Promise<OutgoingMessage> {
  const supabase = getServiceClient()

  // ============================================================
  // 1. LOCK ATÓMICO — previene duplicados por reintento de Telegram
  // ============================================================
  const { data: lockRow, error: lockErr } = await supabase
    .from('chat_messages')
    .insert({
      provider: msg.provider,
      provider_message_id: msg.providerMessageId,
      external_sender: msg.externalSenderId,
      raw_text: msg.text,
      status: 'pending',
      received_at: msg.receivedAt.toISOString(),
    })
    .select('id')
    .single()

  if (lockErr) {
    if (lockErr.code === '23505') {
      console.log('[processor] mensaje ya procesado, skip:', msg.providerMessageId)
      return { text: '' }
    }
    throw lockErr
  }

  const chatMsgId = lockRow.id
  const finalize = async (update: Record<string, unknown>) => {
    await supabase
      .from('chat_messages')
      .update({ ...update, processed_at: new Date().toISOString() })
      .eq('id', chatMsgId)
  }

  // ============================================================
  // 2. Identity lookup
  // ============================================================
  const { data: identity } = await supabase
    .from('chat_identities')
    .select('id, user_id, is_active')
    .eq('provider', msg.provider)
    .eq('external_id', msg.externalSenderId)
    .maybeSingle()

  if (!identity) {
    const reply = await handleUnlinked(msg, supabase)
    await finalize({ status: 'ignored' })
    return reply
  }

  if (!identity.is_active) {
    await finalize({ status: 'ignored', error_message: 'identity inactive' })
    return { text: 'Esta cuenta está desactivada. Podés reactivarla desde la app web.' }
  }

  await supabase.from('chat_messages').update({
    user_id: identity.user_id,
    identity_id: identity.id,
  }).eq('id', chatMsgId)

  // ============================================================
  // 3. Router de comandos
  // ============================================================
  const rawText = msg.text.trim()
  const lower = rawText.toLowerCase()
  const userId = identity.user_id

  // 3.1 — Comandos simples
  if (['/start', '/help', '/ayuda', 'start', 'ayuda', 'help', 'comandos', 'menu', 'menú'].includes(lower)) {
    await finalize({ status: 'ignored' })
    return replyMenu()
  }

  // 3.2 — Saludos puros (hola, buenas, buen día) → menú
  if (/^(hola|holis|buenas|buen\s+d[ií]a|buenas\s+(tardes|noches)|hello|hi|hey|wena+|ola)\b[!.¿?\s]*$/i.test(rawText)) {
    await finalize({ status: 'ignored' })
    return replyMenu()
  }

  if (lower === 'saldo' || lower === '/saldo') {
    await finalize({ status: 'ignored' })
    return replySaldo(userId, supabase)
  }

  if (lower === 'resumen' || lower === '/resumen') {
    await finalize({ status: 'ignored' })
    return replyResumen(userId, supabase)
  }

  if (lower === 'deshacer' || lower === '/deshacer' || lower === 'undo' || lower === '/undo') {
    const reply = await handleUndo(userId, supabase)
    await finalize({ status: 'ignored' })
    return reply
  }

  // 3.3 — Crear cuenta: "crear cuenta <nombre> <moneda> [balance]"
  const crearCuenta = rawText.match(/^(?:crear\s+cuenta|nueva\s+cuenta|\/crear)\s+(.+)$/i)
  if (crearCuenta) {
    const reply = await handleCreateAccount(crearCuenta[1], userId, supabase)
    await finalize({ status: 'ignored' })
    return reply
  }

  // 3.4 — Transferir: "transferir 50000 de efectivo a ahorros"
  const transfer = rawText.match(/^(?:transferir|transfer[ií]|pasar|mover)\s+(.+?)\s+de\s+(.+?)\s+a\s+(.+?)$/i)
  if (transfer) {
    const reply = await handleTransfer(transfer[1], transfer[2], transfer[3], userId, supabase)
    await finalize({ status: 'ignored' })
    return reply
  }

  // ============================================================
  // 4. Parseo de transacción
  // ============================================================
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, kind')
    .eq('user_id', userId)
    .is('archived_at', null)

  const { data: allAccounts } = await supabase
    .from('accounts')
    .select('id, name, currency')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })

  const parsed = await parseMessage(rawText, categories ?? [], allAccounts ?? [])

  if (!parsed.amount || !parsed.type) {
    await finalize({
      status: 'failed_parse',
      parsed: parsed as any,
      confidence: parsed.confidence,
      error_message: 'No se pudo extraer monto/tipo',
    })
    // Mensaje útil: menu resumido
    return { text: replyDidntUnderstand() }
  }

  // 5. Elegir cuenta destino
  const currency = parsed.currency || 'ARS'

  let account: { id: string; name: string; currency: string } | undefined

  if (parsed.accountId) {
    // El user mencionó una cuenta específica en el texto
    const match = (allAccounts ?? []).find(a => a.id === parsed.accountId)
    if (match) {
      if (match.currency !== currency) {
        // La cuenta mencionada es de otra moneda — respeta la moneda de la cuenta
        account = match
        parsed.currency = match.currency
      } else {
        account = match
      }
    }
  }

  if (!account) {
    const filtered = (allAccounts ?? []).filter(a => a.currency === currency)
    if (filtered.length > 0) account = filtered[0]
  }

  if (!account) {
    await finalize({
      status: 'failed_parse',
      parsed: parsed as any,
      confidence: parsed.confidence,
      error_message: `No hay cuentas en ${currency}`,
    })
    return {
      text: `❌ No tenés cuentas en ${currency}.\n\nCreá una mandando:\ncrear cuenta <nombre> ${currency}\n\nEjemplo:\ncrear cuenta Dólares USD 100`,
    }
  }

  // 6. Insert transaction
  const occurredAt = parsed.occurredAt ?? msg.receivedAt
  const txPayload = {
    user_id: userId,
    account_id: account.id,
    category_id: parsed.category_id,
    type: parsed.type,
    amount: parsed.amount,
    currency: account.currency,
    description: parsed.description,
    occurred_at: occurredAt.toISOString(),
    source: msg.provider,
    source_metadata: {
      provider_message_id: msg.providerMessageId,
      raw_text: msg.text,
      confidence: parsed.confidence,
      parsed,
    } as any,
  }

  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .insert(txPayload)
    .select('id')
    .single()

  if (txErr) {
    console.error('Insert tx failed:', txErr)
    await finalize({
      status: 'failed_parse',
      parsed: parsed as any,
      confidence: parsed.confidence,
      error_message: txErr.message,
    })
    return { text: `❌ Error al guardar: ${txErr.message}` }
  }

  // 7. Finalize + actualizar última actividad
  await finalize({
    status: parsed.confidence >= 0.8 ? 'auto_confirmed' : 'parsed',
    parsed: parsed as any,
    confidence: parsed.confidence,
    transaction_id: tx.id,
  })

  await supabase
    .from('chat_identities')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', identity.id)

  // 8. Respuesta
  const emoji = parsed.type === 'expense' ? '💸' : '💰'
  const sign = parsed.type === 'expense' ? '-' : '+'
  const amountStr = fmtMoney(parsed.amount, account.currency)

  const categoryStr = parsed.category_id
    ? categories?.find(c => c.id === parsed.category_id)?.name
    : null

  let replyText = `${emoji} Guardado: ${sign}${amountStr}`
  if (categoryStr) replyText += `\n📁 ${categoryStr}`
  if (parsed.description) replyText += `\n📝 ${parsed.description}`
  replyText += `\n🏦 ${account.name}`

  if (parsed.occurredAt) {
    replyText += `\n📅 ${fmtDate(parsed.occurredAt)}`
  }

  replyText += `\n\nEnvía "deshacer" si te equivocaste.`

  return { text: replyText }
}

// ============================================================
// HANDLERS
// ============================================================

async function handleUnlinked(msg: IncomingMessage, supabase: Supabase): Promise<OutgoingMessage> {
  const codeMatch = msg.text.trim().match(/^(?:vincular|link)\s+(\d{6})$/i)
  if (!codeMatch) {
    return {
      text: '👋 Hola. No estás vinculado todavía.\n\nEntrá a la app web → Ajustes → Vincular, generá un código y mandame:\n\nvincular 123456',
    }
  }
  const code = codeMatch[1]

  const { data: linkCode } = await supabase
    .from('link_codes')
    .select('*')
    .eq('code', code)
    .eq('provider', msg.provider)
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!linkCode) {
    return { text: '❌ Código inválido o vencido. Generá uno nuevo en la web.' }
  }

  const { error: idErr } = await supabase.from('chat_identities').insert({
    user_id: linkCode.user_id,
    provider: msg.provider,
    external_id: msg.externalSenderId,
    display_name: msg.senderName ?? null,
  })

  if (idErr && !idErr.message.includes('duplicate')) {
    return { text: `❌ Error al vincular: ${idErr.message}` }
  }

  await supabase
    .from('link_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code)

  return {
    text: '✅ Vinculado! Podés empezar a usar el bot.\n\n' + replyMenu().text,
  }
}

/**
 * Crear cuenta: "crear cuenta <nombre> <moneda> [balance]"
 * Ejemplos válidos:
 *   crear cuenta Efectivo ARS
 *   crear cuenta Banco USD 500
 *   crear cuenta Mercado Pago ARS 15000
 */
async function handleCreateAccount(argsText: string, userId: string, supabase: Supabase): Promise<OutgoingMessage> {
  // El último token que sea una moneda conocida se toma como currency.
  // Antes de eso va el nombre. Si hay un número al final, es el balance inicial.
  const parts = argsText.trim().split(/\s+/)
  if (parts.length < 2) {
    return {
      text: 'Formato: crear cuenta <nombre> <moneda> [balance]\n\nEjemplos:\n• crear cuenta Efectivo ARS\n• crear cuenta Banco USD 500',
    }
  }

  // Último token puede ser balance numérico
  let balance = 0
  const last = parts[parts.length - 1]
  const maybeBalance = parseFloat(last.replace(/\./g, '').replace(',', '.'))
  let endIdx = parts.length
  if (!Number.isNaN(maybeBalance) && /^-?\d+([.,]\d+)?$/.test(last)) {
    balance = maybeBalance
    endIdx = parts.length - 1
  }

  // La moneda es el token antes del balance (o el último si no hay balance)
  const currencyToken = parts[endIdx - 1]?.toUpperCase() ?? ''
  const validCurrencies = ['ARS', 'USD', 'EUR', 'BRL', 'UYU', 'CLP']
  if (!validCurrencies.includes(currencyToken)) {
    return {
      text: `Moneda "${currencyToken}" no reconocida.\n\nMonedas disponibles: ${validCurrencies.join(', ')}`,
    }
  }

  const name = parts.slice(0, endIdx - 1).join(' ').trim()
  if (!name) {
    return { text: 'Falta el nombre. Formato: crear cuenta <nombre> <moneda> [balance]' }
  }

  // Emojis por moneda como ícono default
  const iconByCurrency: Record<string, string> = {
    ARS: '💵', USD: '💵', EUR: '💶', BRL: '🇧🇷', UYU: '🇺🇾', CLP: '🇨🇱',
  }

  const { data: inserted, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name,
      type: 'other',
      currency: currencyToken,
      initial_balance: balance,
      icon: iconByCurrency[currencyToken] ?? '💰',
      color: '#2563eb',
    })
    .select()
    .single()

  if (error) {
    return { text: `❌ No se pudo crear la cuenta: ${error.message}` }
  }

  let text = `✅ Cuenta creada: ${inserted.name} (${inserted.currency})`
  if (balance > 0) text += `\nSaldo inicial: ${fmtMoney(balance, currencyToken)}`
  text += '\n\nYa podés cargar movimientos en esta cuenta.'
  return { text }
}

/**
 * Transferir: "transferir <monto> de <cuenta1> a <cuenta2>"
 */
async function handleTransfer(amountStr: string, fromStr: string, toStr: string, userId: string, supabase: Supabase): Promise<OutgoingMessage> {
  const amount = parseFloat(amountStr.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'))
  if (!amount || amount <= 0) return { text: '❌ Monto inválido.' }

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, currency')
    .eq('user_id', userId)
    .is('archived_at', null)

  const from = (accounts ?? []).find(a => a.name.toLowerCase().includes(fromStr.trim().toLowerCase()))
  const to = (accounts ?? []).find(a => a.name.toLowerCase().includes(toStr.trim().toLowerCase()))

  if (!from) return { text: `❌ No encontré la cuenta origen: "${fromStr.trim()}"` }
  if (!to) return { text: `❌ No encontré la cuenta destino: "${toStr.trim()}"` }
  if (from.id === to.id) return { text: '❌ No podés transferir a la misma cuenta.' }

  if (from.currency !== to.currency) {
    return {
      text: `❌ Las cuentas tienen monedas distintas (${from.currency} vs ${to.currency}). Por ahora no puedo hacer transferencias con cambio de moneda desde Telegram. Usá la app web.`,
    }
  }

  const { error } = await supabase.rpc('create_transfer', {
    p_from_account: from.id,
    p_to_account: to.id,
    p_amount: amount,
    p_occurred_at: new Date().toISOString(),
    p_description: null,
    p_exchange_rate: null,
    p_fee: 0,
  })

  if (error) return { text: `❌ Error: ${error.message}` }

  return {
    text: `🔁 Transferencia OK\n${fmtMoney(amount, from.currency)}\n${from.name} → ${to.name}`,
  }
}

/**
 * Deshacer: borra la última transacción cargada por este canal.
 * No usa el RPC porque auth.uid() es null desde service role — hacemos
 * soft-delete directo filtrando por user_id para garantizar ownership.
 */
async function handleUndo(userId: string, supabase: Supabase): Promise<OutgoingMessage> {
  const { data: last } = await supabase
    .from('transactions')
    .select('id, amount, currency, type, description, account:accounts(name)')
    .eq('user_id', userId)
    .in('source', ['telegram', 'whatsapp'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!last) {
    return { text: 'No hay movimientos recientes cargados por chat para deshacer.' }
  }

  // Si la tx es parte de un transfer, borrar ambas patas para no descuadrar saldos
  const { data: transfer } = await supabase
    .from('transfers')
    .select('id, from_transaction_id, to_transaction_id')
    .or(`from_transaction_id.eq.${last.id},to_transaction_id.eq.${last.id}`)
    .eq('user_id', userId)
    .maybeSingle()

  const nowIso = new Date().toISOString()
  const idsToDelete = transfer
    ? [transfer.from_transaction_id, transfer.to_transaction_id]
    : [last.id]

  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: nowIso })
    .in('id', idsToDelete)
    .eq('user_id', userId)

  if (error) return { text: `❌ Error al deshacer: ${error.message}` }

  const sign = last.type === 'expense' ? '-' : last.type === 'income' ? '+' : ''
  const accountName = (last as any).account?.name ?? ''
  const label = transfer
    ? `transferencia ${fmtMoney(Number(last.amount), last.currency)}`
    : `${sign}${fmtMoney(Number(last.amount), last.currency)}${last.description ? ` · ${last.description}` : ''}${accountName ? ` · ${accountName}` : ''}`

  return { text: `↩ Deshecho: ${label}` }
}

/**
 * Resumen del mes actual.
 */
async function replyResumen(userId: string, supabase: Supabase): Promise<OutgoingMessage> {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const { data: txs } = await supabase
    .from('transactions')
    .select('type, amount, currency, category:categories(name)')
    .eq('user_id', userId)
    .gte('occurred_at', start.toISOString())
    .lt('occurred_at', end.toISOString())
    .is('deleted_at', null)

  if (!txs?.length) {
    return { text: '📊 No hay movimientos este mes todavía.' }
  }

  // Totales por moneda + categoría
  const totals: Record<string, { income: number; expense: number }> = {}
  const byCategory: Record<string, { total: number; count: number; currency: string }> = {}

  for (const t of txs) {
    if (t.type === 'transfer') continue
    if (!totals[t.currency]) totals[t.currency] = { income: 0, expense: 0 }
    if (t.type === 'income') totals[t.currency].income += Number(t.amount)
    else totals[t.currency].expense += Number(t.amount)

    if (t.type === 'expense') {
      const catName = (t as any).category?.name ?? 'Sin categoría'
      const key = `${catName}-${t.currency}`
      if (!byCategory[key]) byCategory[key] = { total: 0, count: 0, currency: t.currency }
      byCategory[key].total += Number(t.amount)
      byCategory[key].count++
    }
  }

  const monthLabel = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(start)

  let text = `📊 Resumen · ${monthLabel}\n`
  for (const [cur, t] of Object.entries(totals)) {
    const net = t.income - t.expense
    text += `\n${cur}:`
    text += `\n  + ${fmtMoney(t.income, cur)}`
    text += `\n  - ${fmtMoney(t.expense, cur)}`
    text += `\n  = ${net >= 0 ? '+' : ''}${fmtMoney(net, cur)}`
  }

  // Top 3 categorías (ordenadas por total global en ARS convertido no — lo dejamos simple: top total raw)
  const topCats = Object.entries(byCategory)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 3)

  if (topCats.length) {
    text += `\n\nTop categorías:`
    topCats.forEach(([key, info], i) => {
      const [name] = key.split('-')
      text += `\n${i + 1}. ${name}: ${fmtMoney(info.total, info.currency)}`
    })
  }

  return { text }
}

async function replySaldo(userId: string, supabase: Supabase): Promise<OutgoingMessage> {
  const { data: balances } = await supabase
    .from('account_balances')
    .select('*')
    .eq('user_id', userId)

  if (!balances?.length) {
    return { text: 'No tenés cuentas todavía.\n\nCreá una mandando:\ncrear cuenta <nombre> <moneda>\n\nEjemplo:\ncrear cuenta Efectivo ARS' }
  }

  const lines = balances.map(b => `• ${b.name}: ${fmtMoney(Number(b.balance), b.currency)}`)
  return { text: `💰 Saldos:\n\n${lines.join('\n')}` }
}

function replyMenu(): OutgoingMessage {
  return {
    text: `👋 mis-finanzas bot

💸 CARGAR GASTOS / INGRESOS
• gasté 5000 en super
• cobré 300000 sueldo
• 15 lucas taxi
• 200 usd freelance
• ayer gasté 8000 en nafta
• gasté 5000 super desde banco

🔁 TRANSFERIR
• transferir 50000 de efectivo a ahorros

🏦 CUENTAS
• crear cuenta Banco ARS
• crear cuenta Dólares USD 100

📊 CONSULTAS
• saldo  — saldos de cuentas
• resumen  — resumen del mes

🧹 DESHACER
• deshacer  — borra la última transacción

Escribí "ayuda" para ver este menú de nuevo.`,
  }
}

function replyDidntUnderstand(): string {
  return `🤔 No pude entender el mensaje.

Probá:
• gasté 5000 en super
• cobré 300000 sueldo
• saldo
• resumen
• ayuda  (para ver todo)`
}

// ============================================================
// UTILIDADES DE FORMATO
// ============================================================

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(d)
}
