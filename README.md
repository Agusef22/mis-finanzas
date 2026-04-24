# mis-finanzas

App de finanzas personales multi-moneda con ingreso rápido por Telegram.

## Features

### Frontend (Nuxt 3)
- 💰 CRUD de cuentas (archivar, eliminar cascade, desarchivar)
- 📂 Categorías personalizables (20 seed default argentinas)
- 💸 Transacciones con filtros avanzados y búsqueda de texto
- 🔁 Transferencias entre cuentas (con conversión multi-moneda)
- 🎯 Metas de ahorro (linkeadas a cuenta con conversión automática)
- 📊 Presupuestos por categoría (semanal/mensual/anual) con alertas
- 📈 Dashboard + Stats con gráficos donut y tendencias
- 🌓 Dark/light toggle con persistencia
- 📱 Mobile-first con bottom nav + sidebar desktop
- ⚡ Realtime sync (los cambios se propagan al toque)
- 🔔 Toasts globales + dialogs de confirmación

### Bot de Telegram
- Cargar gastos/ingresos en lenguaje natural
- Comandos: `saldo`, `resumen`, `deshacer`, `ayuda`
- Crear cuenta desde el chat: `crear cuenta Banco ARS 50000`
- Transferir: `transferir 50000 de efectivo a ahorros`
- Selección de cuenta: `gasté 5000 super desde banco`
- Fechas relativas: `ayer`, `anteayer`, `hace 3 días`, `el lunes`, `DD/MM`
- Parseo híbrido: regex rápido + LLM con fallback (Groq + OpenRouter)
- ~80 keywords para categorización automática

### Seguridad
- RLS en todas las tablas con policy `user_id = auth.uid()`
- Idempotencia atómica via UNIQUE constraint en chat_messages
- Rate limiting en generación de link codes (5/hora)
- Audit log de acciones sensibles (vincular chat, eliminar cuenta)
- Link codes de 8 dígitos con TTL 5 min, single-use
- Validación HMAC de webhooks Telegram
- SECURITY DEFINER con `SET search_path` en todas las funciones

## Stack

- **Frontend**: Nuxt 3 + TypeScript + TailwindCSS + TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **LLM**: Groq (primario) + OpenRouter (fallback)
- **Bot**: Telegram Bot API
- **Exchange rates**: dolarapi.com
- **Deploy**: Vercel (frontend) + Supabase (DB + functions)

## Estructura

```
mis-finanzas/
├── app/                          Nuxt app
│   ├── assets/css/               Tailwind + design tokens
│   ├── components/               UI components
│   ├── composables/              data layer
│   ├── layouts/                  default + auth
│   ├── pages/                    rutas
│   ├── plugins/                  vue-query, realtime
│   ├── public/                   favicon, static
│   ├── types/                    tipos DB
│   └── utils/                    format, month
└── supabase/
    ├── migrations/               16 migraciones versionadas
    └── functions/
        ├── _shared/              parser, processor, openrouter, telegram, twilio
        ├── tg-webhook/           Telegram bot
        ├── wa-webhook/           WhatsApp (preparado, no deployado)
        └── refresh-rates/        cron de cotizaciones
```

## Setup local

### Requisitos
- Node 20+
- pnpm (`npm i -g pnpm`)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Cuenta en: [Supabase](https://supabase.com), [Groq](https://console.groq.com), [@BotFather](https://t.me/BotFather)

### 1. Clonar y configurar env

```bash
cd mis-finanzas
cp .env.example .env
cp .env.example app/.env
```

Completá ambos `.env` con tus credenciales:

**`.env` (raíz)** — para edge functions y CLI:
```
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
```

**`app/.env`** — para Nuxt:
```
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_KEY=sb_publishable_xxx
```

### 2. Linkear Supabase + aplicar migraciones

```bash
supabase login
supabase link --project-ref TU_REF
supabase db push        # aplica las 16 migraciones
```

### 3. Correr la app

```bash
cd app
pnpm install
pnpm dev                # http://localhost:3000
```

### 4. Setear secrets de Supabase (edge functions)

Desde el dashboard <https://supabase.com/dashboard/project/TU_REF/settings/functions> o CLI:

```bash
supabase secrets set GROQ_API_KEY=gsk_xxx
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxx
supabase secrets set TELEGRAM_BOT_TOKEN=123:ABC
supabase secrets set TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

### 5. Deploy edge functions

```bash
supabase functions deploy tg-webhook
supabase functions deploy refresh-rates
```

### 6. Registrar webhook en Telegram

```bash
export TG_TOKEN="tu_token"
export TG_SECRET="tu_webhook_secret"
curl -X POST "https://api.telegram.org/bot${TG_TOKEN}/setWebhook" \
  -d "url=https://TU_REF.supabase.co/functions/v1/tg-webhook" \
  -d "secret_token=${TG_SECRET}"
```

## Deploy a Vercel

### 1. Crear repo en GitHub

```bash
cd ~/Projects/Personal/mis-finanzas
git init
git branch -M main
git add .
git commit -m "Initial commit"
gh repo create mis-finanzas --private --source=. --push
```

### 2. Importar en Vercel

1. Entrar a <https://vercel.com/new>
2. **Import Git Repository** → seleccioná `mis-finanzas`
3. **Root Directory**: `app`
4. **Framework**: Nuxt.js (detección automática)
5. **Environment Variables**:
   - `SUPABASE_URL` = tu URL de proyecto
   - `SUPABASE_KEY` = tu publishable key
6. Click **Deploy**

Vercel detecta `vercel.json` en `/app` y aplica la config automáticamente (framework, headers de seguridad, etc).

### 3. Configurar Supabase Auth para producción

En el dashboard de Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://tu-dominio.vercel.app`
- **Redirect URLs**: agregar `https://tu-dominio.vercel.app/**`

## Uso por Telegram

1. En la app web → `/settings` → **Vincular Telegram** → copiar código
2. Abrir tu bot → mandar `vincular 12345678`
3. Ya podés mandar mensajes:
   - `gasté 5000 en super`
   - `ayer pagué 12mil de luz`
   - `cobré 300000 sueldo`
   - `200 usd freelance`
   - `saldo` / `resumen` / `ayuda` / `deshacer`

## Decisiones arquitectónicas clave

- **Single user**: sin workspaces compartidos. Migración futura si hace falta.
- **Multi-moneda**: cada `account` tiene moneda fija; `transactions` snapshot currency.
- **Offline mutations**: TanStack Query con `networkMode: offlineFirst` encola cambios hasta que vuelve red.
- **Client-side UUIDs**: `client_uuid` UNIQUE en transactions para dedup.
- **Lógica en DB**: solo integridad, RLS, funciones RPC atómicas, y vistas (`account_balances`, `budget_status`, `goal_status`). Parseo NL y LLM en edge functions.
- **Parser híbrido**: regex fast-path (gratis) + LLM fallback para casos complejos.
- **LLM privacy**: solo proveedores con `data_collection: deny`. Groq primario.

## Migrations aplicadas

| # | Qué hace |
|---|---|
| 001 | Schema inicial (tablas + tipos + triggers) |
| 002 | RLS policies |
| 003 | RPC functions + views (create_transfer, account_balances) |
| 004 | Seed categorías default |
| 005 | DEFAULT auth.uid() en user_id columns |
| 006 | RPC delete_account_cascade |
| 007 | Fix account_transaction_count (incluir soft-deleted) |
| 008 | Fix orphan transfers al eliminar cuenta |
| 009 | Habilitar Realtime en tablas principales |
| 010 | Security hardening (link codes 8 dígitos, rate limit, audit log) |
| 011 | View budget_status |
| 012 | Tabla goals + view goal_status |
| 013 | Fix budget_status (agregar created_at) |
| 014 | goal_status con account_currency para conversión cliente |
| 015 | Habilitar Realtime en budgets |
| 016 | Hardening create_transfer (reject self-transfer, validaciones) |

## Roadmap futuro

- [ ] Deploy del frontend a Vercel
- [ ] WhatsApp (Twilio sandbox) — código listo, falta deploy
- [ ] PWA + persistencia IndexedDB (con `<ClientOnly>` en páginas con queries)
- [ ] Transacciones recurrentes (sueldo, alquiler)
- [ ] Importar CSV de bancos
- [ ] Confirmación inline en Telegram con botones
- [ ] Exportar a CSV/PDF
- [ ] Tauri wrapper para desktop

## Troubleshooting

- **Hydration warnings en dev**: warnings benignos por cache de TanStack Query vs SSR. No afectan producción.
- **Sesión se pierde al refresh**: verificar que `ssr: true` en nuxt.config (necesario para cookies Supabase).
- **Parser LLM falla**: revisar logs en Supabase → Edge Functions → tg-webhook. Rotar keys si hit rate limit.
- **Realtime no sincroniza**: chequear que las tablas estén en `supabase_realtime` publication (migración 009 + 015).
# mis-finanzas
