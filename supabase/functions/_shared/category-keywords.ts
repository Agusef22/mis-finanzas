// Mapa de keywords a nombres de categoría.
// Se usa como fallback cuando el LLM no asigna categoría o cuando el regex resuelve directo.
// El nombre de la categoría tiene que matchear (case-insensitive) con una categoría real del user.

export const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: string }> = [
  // ----- Gastos -----
  {
    keywords: ['nafta', 'combustible', 'gasoil', 'ypf', 'shell', 'axion', 'puma', 'estación de servicio', 'estacion de servicio'],
    category: 'Combustible',
  },
  {
    keywords: ['super', 'supermercado', 'almacen', 'almacén', 'chino', 'kiosko', 'kiosco', 'coto', 'disco', 'jumbo', 'carrefour', 'dia', 'día', 'vea', 'chango', 'walmart'],
    category: 'Supermercado',
  },
  {
    keywords: ['almuerzo', 'cena', 'desayuno', 'café', 'cafe', 'cafeteria', 'cafetería', 'restaurante', 'resto', 'bar', 'delivery', 'pedidosya', 'rappi', 'mcdonalds', 'burger', 'pizza', 'parrilla', 'comida'],
    category: 'Gastronomía',
  },
  {
    keywords: ['uber', 'taxi', 'cabify', 'didi', 'subte', 'bondi', 'colectivo', 'sube', 'tren', 'peaje', 'estacionamiento', 'auto'],
    category: 'Transporte',
  },
  {
    keywords: ['luz', 'edesur', 'edenor', 'agua', 'aysa', 'metrogas', 'gas natural', 'internet', 'wifi', 'fibertel', 'movistar', 'claro', 'personal', 'tuenti', 'abl', 'arba', 'monotributo', 'factura'],
    category: 'Servicios',
  },
  {
    keywords: ['farmacia', 'farmacity', 'medico', 'médico', 'remedios', 'terapia', 'psicologa', 'psicóloga', 'psicologo', 'psicólogo', 'obra social', 'osde', 'swiss medical', 'galeno', 'omint'],
    category: 'Salud',
  },
  {
    keywords: ['alquiler', 'renta', 'expensas'],
    category: 'Alquiler',
  },
  {
    keywords: ['cine', 'teatro', 'concierto', 'recital', 'show', 'entrada'],
    category: 'Entretenimiento',
  },
  {
    keywords: ['spotify', 'netflix', 'youtube premium', 'prime video', 'disney', 'hbo', 'max', 'paramount', 'apple music', 'chatgpt', 'suscripción'],
    category: 'Suscripciones',
  },
  {
    keywords: ['ropa', 'zapatillas', 'zapatos', 'camisa', 'remera', 'pantalon', 'pantalón', 'campera', 'zara', 'h&m'],
    category: 'Ropa',
  },
  {
    keywords: ['curso', 'udemy', 'platzi', 'coursera', 'libro', 'libreria', 'librería', 'universidad', 'facultad', 'colegio'],
    category: 'Educación',
  },
  {
    keywords: ['regalo', 'cumple', 'cumpleaños'],
    category: 'Regalos',
  },
  {
    keywords: ['impuesto', 'afip', 'ganancias', 'iva', 'bienes personales'],
    category: 'Impuestos',
  },

  // ----- Ingresos -----
  {
    keywords: ['sueldo', 'salario'],
    category: 'Sueldo',
  },
  {
    keywords: ['freelance', 'honorarios', 'cliente', 'proyecto', 'factura c'],
    category: 'Freelance',
  },
  {
    keywords: ['inversion', 'inversión', 'dividendo', 'renta pasiva', 'plazo fijo', 'bono', 'cedear', 'accion', 'acción', 'cripto'],
    category: 'Inversiones',
  },
  {
    keywords: ['regalo recibido', 'me regalaron'],
    category: 'Regalos recibidos',
  },
  {
    keywords: ['reintegro', 'reembolso', 'devolucion', 'devolución'],
    category: 'Reintegros',
  },
]

/**
 * Busca una categoría por keywords en un texto.
 * Devuelve el id de la categoría del user o null.
 */
export function guessCategoryFromKeywords(
  text: string,
  categories: Array<{ id: string; name: string; kind: string }>,
): string | null {
  if (!text) return null
  const lowered = text.toLowerCase()

  for (const entry of CATEGORY_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (lowered.includes(kw)) {
        const match = categories.find(c => c.name.toLowerCase() === entry.category.toLowerCase())
        if (match) return match.id
      }
    }
  }
  return null
}
