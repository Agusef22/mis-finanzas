// Cliente LLM con fallback en cascada: Groq → OpenRouter.
// (Nombre histórico "openrouter.ts" se mantiene para no romper imports.)
//
// Groq ofrece free tier más generoso y latencia muy baja. Si falla todo Groq,
// cae a OpenRouter como respaldo. Si ambos fallan, el parser usa regex+keywords.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Chain Groq — modelos free/preview, ordenados por calidad y velocidad.
 * Actualizado 2026-04. Revisá en: https://console.groq.com/docs/models
 */
const GROQ_MODEL_CHAIN = [
  'llama-3.3-70b-versatile',                     // Top calidad, 280 T/s
  'openai/gpt-oss-120b',                         // Alta calidad, 500 T/s
  'openai/gpt-oss-20b',                          // Ultra rápido, 1000 T/s
  'llama-3.1-8b-instant',                        // Respaldo rápido, 560 T/s
  'meta-llama/llama-4-scout-17b-16e-instruct',  // Preview
  'qwen/qwen3-32b',                              // Bueno en español (preview)
]

/**
 * Chain OpenRouter — respaldo si Groq cae entero.
 * Actualizado 2026-04 basado en https://openrouter.ai/models?max_price=0
 * Los nombres de :free cambian cada unos meses. Si devuelve 404, ver esa URL.
 */
const OPENROUTER_MODEL_CHAIN = [
  'openrouter/free',                         // meta-modelo: OR rutea al mejor free disponible
  'google/gemma-4-31b-it:free',              // Google, 31B, 262k context
  'nvidia/nemotron-3-super-120b-a12b:free',  // NVIDIA, 120B activos
  'minimax/minimax-m2.5:free',               // Alternativa distinta
]

export const DEFAULT_MODEL_CHAIN = GROQ_MODEL_CHAIN // mantenido por compatibilidad

export interface LLMCallOptions {
  temperature?: number
  maxTokens?: number
  responseFormatJson?: boolean
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Intenta cada proveedor + modelo en orden. El primero que responda gana.
 */
export async function callLLM(messages: LLMMessage[], opts: LLMCallOptions = {}): Promise<string> {
  const errors: string[] = []

  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (groqKey) {
    for (const model of GROQ_MODEL_CHAIN) {
      try {
        const content = await callOpenAICompat(GROQ_URL, groqKey, model, messages, opts, 'groq')
        return content
      } catch (e) {
        const msg = (e as Error).message.slice(0, 100)
        console.warn(`[llm] groq/${model} falló: ${msg}`)
        errors.push(`groq/${model}: ${msg}`)
      }
    }
  } else {
    console.warn('[llm] GROQ_API_KEY no seteada — salteando Groq')
  }

  const orKey = Deno.env.get('OPENROUTER_API_KEY')
  if (orKey) {
    for (const model of OPENROUTER_MODEL_CHAIN) {
      try {
        const content = await callOpenAICompat(OPENROUTER_URL, orKey, model, messages, opts, 'openrouter')
        return content
      } catch (e) {
        const msg = (e as Error).message.slice(0, 100)
        console.warn(`[llm] openrouter/${model} falló: ${msg}`)
        errors.push(`or/${model}: ${msg}`)
      }
    }
  } else {
    console.warn('[llm] OPENROUTER_API_KEY no seteada — salteando OpenRouter')
  }

  throw new Error(`Todos los proveedores fallaron.\n${errors.join('\n')}`)
}

async function callOpenAICompat(
  url: string,
  apiKey: string,
  model: string,
  messages: LLMMessage[],
  opts: LLMCallOptions,
  providerTag: 'groq' | 'openrouter',
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.maxTokens ?? 300,
  }

  // OpenRouter permite configurar no-training + speed preference
  if (providerTag === 'openrouter') {
    body.provider = { data_collection: 'deny', sort: 'throughput' }
  }

  if (opts.responseFormatJson) {
    body.response_format = { type: 'json_object' }
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (providerTag === 'openrouter') {
    headers['HTTP-Referer'] = 'https://mis-finanzas.app'
    headers['X-Title'] = 'mis-finanzas'
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text.slice(0, 200)}`)
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message: string }
    model?: string
  }

  if (json.error) throw new Error(json.error.message)

  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('empty response')

  console.log(`[llm] ✓ ${providerTag}/${json.model ?? model}`)
  return content
}
