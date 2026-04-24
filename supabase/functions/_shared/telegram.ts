// Adapter Telegram

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; first_name?: string; username?: string }
    chat: { id: number; type: string; first_name?: string; username?: string }
    date: number
    text?: string
  }
  callback_query?: {
    id: string
    from: { id: number; first_name?: string; username?: string }
    message?: { chat: { id: number }; message_id: number }
    data?: string
  }
}

const TG_API = 'https://api.telegram.org'

function getToken(): string {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')
  return token
}

/**
 * Envía un mensaje al chat de Telegram. Usa texto plano (sin parse_mode)
 * para evitar issues con caracteres especiales.
 */
export async function sendTelegramMessage(chatId: number | string, text: string, quickReplies?: string[]) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  }
  if (quickReplies && quickReplies.length) {
    body.reply_markup = {
      inline_keyboard: [quickReplies.map(q => ({ text: q, callback_data: q }))],
    }
  }
  const res = await fetch(`${TG_API}/bot${getToken()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    console.error('[telegram] send error:', res.status, t)
  }
}

/**
 * Muestra "escribiendo..." en Telegram mientras procesamos.
 * Se auto-cancela después de 5s o cuando mandemos el mensaje real.
 */
export async function sendTypingAction(chatId: number | string) {
  try {
    await fetch(`${TG_API}/bot${getToken()}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    })
  } catch (e) {
    console.error('[telegram] typing error:', e)
  }
}
