// Adapter Twilio WhatsApp

export interface TwilioIncoming {
  MessageSid: string
  From: string       // "whatsapp:+5491122334455"
  To: string
  Body: string
  ProfileName?: string
}

/**
 * Parsea el application/x-www-form-urlencoded que manda Twilio.
 */
export function parseTwilioBody(formData: FormData): TwilioIncoming {
  return {
    MessageSid: String(formData.get('MessageSid') ?? ''),
    From: String(formData.get('From') ?? ''),
    To: String(formData.get('To') ?? ''),
    Body: String(formData.get('Body') ?? ''),
    ProfileName: formData.get('ProfileName') ? String(formData.get('ProfileName')) : undefined,
  }
}

/**
 * Envía un WhatsApp con la API de Twilio.
 */
export async function sendTwilioMessage(to: string, body: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_NUMBER')
  if (!sid || !token || !from) throw new Error('Twilio env vars missing')

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
  const auth = btoa(`${sid}:${token}`)

  const form = new URLSearchParams()
  form.set('From', from)
  form.set('To', to)
  form.set('Body', body)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })

  if (!res.ok) {
    const t = await res.text()
    console.error('Twilio send error:', res.status, t)
  }
}

/**
 * Renderiza una respuesta TwiML (alternativa a usar la API).
 */
export function twimlReply(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${escaped}</Message></Response>`
}
