// Edge function para refrescar cotizaciones ARS desde dolarapi.com
// Ejecutar manualmente o vía pg_cron:
//   SELECT cron.schedule('refresh-rates', '0 10,18 * * *',
//     $$ SELECT net.http_post(url := 'https://<proyecto>.supabase.co/functions/v1/refresh-rates') $$);

import { getServiceClient } from '../_shared/supabase.ts'

interface DolarApiRate {
  moneda: string          // "USD"
  casa: string            // "oficial" | "blue" | "bolsa" (mep) | "contadoconliqui" (ccl) | "tarjeta" | "mayorista"
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

const CASA_TO_TYPE: Record<string, string> = {
  oficial: 'oficial',
  blue: 'blue',
  bolsa: 'mep',
  contadoconliqui: 'ccl',
  tarjeta: 'tarjeta',
  mayorista: 'mayorista',
}

Deno.serve(async () => {
  try {
    const url = Deno.env.get('DOLARAPI_URL') ?? 'https://dolarapi.com/v1/dolares'
    const res = await fetch(url)
    if (!res.ok) throw new Error(`dolarapi error ${res.status}`)

    const rates = await res.json() as DolarApiRate[]
    const today = new Date().toISOString().slice(0, 10)

    const supabase = getServiceClient()
    const rows = rates
      .map(r => ({
        date: today,
        from_currency: 'USD',
        to_currency: 'ARS',
        rate_type: CASA_TO_TYPE[r.casa] ?? r.casa,
        rate: r.venta, // usamos el valor de venta como ref
        fetched_at: new Date().toISOString(),
      }))

    const { error } = await supabase
      .from('exchange_rates')
      .upsert(rows, { onConflict: 'date,from_currency,to_currency,rate_type' })

    if (error) throw error

    return new Response(JSON.stringify({ ok: true, count: rows.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('refresh-rates failed:', e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
