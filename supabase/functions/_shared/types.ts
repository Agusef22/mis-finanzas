// Tipos compartidos por las edge functions

export type ChatProvider = 'whatsapp' | 'telegram'

export interface IncomingMessage {
  provider: ChatProvider
  externalSenderId: string       // phone para WA, chat_id para Telegram
  text: string
  providerMessageId: string       // para idempotencia
  senderName?: string | null
  receivedAt: Date
}

export interface OutgoingMessage {
  text: string
  quickReplies?: string[]         // Telegram: inline keyboard. WA: se renderiza como texto.
}

export interface ParsedTransaction {
  amount: number | null
  type: 'expense' | 'income' | null
  currency: string | null         // ARS | USD | ...
  category_hint: string | null
  category_id: string | null      // resuelto después del LLM
  description: string | null
  confidence: number              // 0..1
}
