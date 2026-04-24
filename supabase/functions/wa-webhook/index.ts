// Webhook de WhatsApp (Twilio Sandbox)
// Twilio manda application/x-www-form-urlencoded.
// Respondemos con TwiML (más simple que llamar a su API para mandar).

import { processMessage } from '../_shared/processor.ts'
import { parseTwilioBody, twimlReply } from '../_shared/twilio.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // TODO: validar firma Twilio con X-Twilio-Signature + HMAC. Para sandbox es opcional.

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return new Response('Invalid form body', { status: 400 })
  }

  const twilioMsg = parseTwilioBody(formData)
  if (!twilioMsg.MessageSid || !twilioMsg.Body || !twilioMsg.From) {
    return new Response('Missing fields', { status: 400 })
  }

  let replyText = '❌ Error interno'
  try {
    const result = await processMessage({
      provider: 'whatsapp',
      externalSenderId: twilioMsg.From,    // "whatsapp:+5491122334455"
      text: twilioMsg.Body,
      providerMessageId: twilioMsg.MessageSid,
      senderName: twilioMsg.ProfileName ?? null,
      receivedAt: new Date(),
    })
    replyText = result.text
  } catch (e) {
    console.error('Error processing whatsapp message:', e)
  }

  return new Response(twimlReply(replyText), {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
})
