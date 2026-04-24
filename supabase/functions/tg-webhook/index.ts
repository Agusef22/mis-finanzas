// Webhook de Telegram
// Setear con:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>&secret_token=<SECRET>"

import { processMessage } from '../_shared/processor.ts'
import { sendTelegramMessage, sendTypingAction, type TelegramUpdate } from '../_shared/telegram.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Validación del secret
  const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (expectedSecret) {
    const receivedSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (receivedSecret !== expectedSecret) {
      console.warn('Invalid webhook secret')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let update: TelegramUpdate
  try {
    update = await req.json() as TelegramUpdate
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const tgMsg = update.message
  if (!tgMsg || !tgMsg.text) {
    // Stickers, fotos, etc — responder al primer sticker con un tip amable
    if (tgMsg && tgMsg.chat?.id) {
      await sendTelegramMessage(tgMsg.chat.id, 'Por ahora solo entiendo mensajes de texto. Escribí "ayuda" para ver qué puedo hacer.')
    }
    return new Response('OK', { status: 200 })
  }

  // Mostrar "escribiendo..." mientras procesamos
  sendTypingAction(tgMsg.chat.id).catch(() => {})

  try {
    const result = await processMessage({
      provider: 'telegram',
      externalSenderId: String(tgMsg.chat.id),
      text: tgMsg.text,
      providerMessageId: String(update.update_id),
      senderName: tgMsg.from?.first_name ?? tgMsg.from?.username ?? null,
      receivedAt: new Date(tgMsg.date * 1000),
    })

    if (result.text && result.text.length > 0) {
      await sendTelegramMessage(tgMsg.chat.id, result.text, result.quickReplies)
    }
  } catch (e) {
    console.error('Error processing telegram message:', e)
    try {
      await sendTelegramMessage(tgMsg.chat.id, '❌ Error interno, intentá de nuevo en un rato.')
    } catch {}
  }

  return new Response('OK', { status: 200 })
})
