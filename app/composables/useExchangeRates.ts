import { useQuery } from '@tanstack/vue-query'
import type { RateType } from '~/types/database'

export interface DolarRate {
  casa: string              // 'oficial' | 'blue' | 'bolsa' | 'contadoconliqui' | 'tarjeta' | 'mayorista'
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

// dolarapi.com usa 'bolsa' y 'contadoconliqui' en la API; los mapeamos a 'mep' y 'ccl' para consistencia con la DB.
const CASA_TO_TYPE: Record<string, RateType> = {
  oficial: 'oficial',
  blue: 'blue',
  bolsa: 'mep',
  contadoconliqui: 'ccl',
  tarjeta: 'tarjeta',
  mayorista: 'mayorista',
}

export type RateMap = Partial<Record<RateType, { compra: number; venta: number; updatedAt: string }>>

/**
 * Fetcha cotizaciones USD/ARS desde dolarapi.com.
 * Cachea 30 min (staleTime) y mantiene el dato 24h en memoria (gcTime).
 */
export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates', 'usd-ars'],
    staleTime: 1000 * 60 * 30,         // 30 min antes de re-fetch automático
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    queryFn: async (): Promise<RateMap> => {
      const res = await fetch('https://dolarapi.com/v1/dolares')
      if (!res.ok) throw new Error(`dolarapi ${res.status}`)
      const data = await res.json() as DolarRate[]
      const out: RateMap = {}
      for (const r of data) {
        const k = CASA_TO_TYPE[r.casa]
        if (k) out[k] = { compra: r.compra, venta: r.venta, updatedAt: r.fechaActualizacion }
      }
      return out
    },
  })
}

/**
 * Convierte un monto de una moneda a otra usando el RateMap.
 * Por ahora solo maneja pares ARS ↔ USD.
 * Retorna null si no se puede convertir (moneda desconocida o rate no disponible).
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: RateMap | undefined,
  rateType: RateType = 'blue',
): number | null {
  if (!rates) return null
  if (from === to) return amount

  const rate = rates[rateType]
  if (!rate) return null

  // Usamos 'venta' como rate de referencia para conversión consolidada.
  const usdToArs = rate.venta

  if (from === 'USD' && to === 'ARS') return amount * usdToArs
  if (from === 'ARS' && to === 'USD') return amount / usdToArs

  return null
}
