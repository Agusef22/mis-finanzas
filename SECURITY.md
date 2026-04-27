# Security conventions — mis-finanzas

Resumen de las decisiones y reglas de seguridad del proyecto. Lectura obligatoria antes de tocar la DB o auth.

## Modelo de seguridad

- **Single tenant por user**: cada user solo accede a SUS datos.
- **RLS en todas las tablas con datos de user** (`user_id = auth.uid()`).
- **Edge functions usan `service_role`** (bypass RLS) pero filtran manualmente por `user_id`.
- **Frontend usa publishable key** + cookies/JWT. Nunca toca service_role.

## Reglas obligatorias al agregar nuevas tablas

1. **Habilitar RLS**: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
2. **Crear policy** con `user_id = auth.uid()` para `FOR ALL`.
3. **DEFAULT auth.uid()** en la columna `user_id` para evitar bugs en cliente.
4. **Si hace falta exponerla por realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE x;`.

```sql
CREATE TABLE public.mi_tabla (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ... otros campos
);

ALTER TABLE public.mi_tabla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mi_tabla_all_own" ON public.mi_tabla
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

## ⚠️ Reglas críticas para VIEWS

**Las vistas en Postgres BYPASS RLS por default**. Hay que activar `security_invoker = true`:

```sql
CREATE VIEW public.mi_vista AS SELECT ...;
ALTER VIEW public.mi_vista SET (security_invoker = true);
GRANT SELECT ON public.mi_vista TO authenticated;
```

Sin esto, **cualquier user autenticado puede leer data de TODOS los demás users a través de la vista**. Bug encontrado en migration 017.

## Reglas para funciones SECURITY DEFINER

1. **Siempre** `SET search_path = public` (previene search_path injection).
2. **Validar `auth.uid()`** al inicio:
   ```sql
   IF auth.uid() IS NULL THEN
     RAISE EXCEPTION 'not authenticated';
   END IF;
   ```
3. **Filtrar por `user_id = auth.uid()`** en TODAS las queries dentro de la función.
4. **Si recibe `p_user_id` como parámetro**: validar `auth.uid() = p_user_id` antes de proceder.
5. **Triggers no deberían tener EXECUTE para `authenticated`**:
   ```sql
   REVOKE EXECUTE ON FUNCTION public.mi_trigger_fn FROM PUBLIC, authenticated, anon;
   ```

## Edge functions

- Las edge functions usan `SUPABASE_SERVICE_ROLE_KEY` que **bypass RLS**.
- Por eso es **obligatorio filtrar por `user_id` manualmente** en cada query.
- **Nunca confiar en data del cliente** para identificar al user. Usar la vinculación via `chat_identities` (telegram/whatsapp) o el JWT.

## Frontend

- **Solo usar `useSupabaseClient()`** del módulo `@nuxtjs/supabase`. Es el cliente autenticado.
- **No instanciar manualmente** `createClient()` con service_role.
- **No filtrar manualmente por `user_id`** (no hace falta, RLS lo hace), pero tampoco está mal hacerlo como defensa en profundidad.
- **Limpiar cache al cambiar de user**: el plugin `auth-cache-cleanup.client.ts` lo hace automáticamente.

## Secrets management

| Secret | Dónde vive | Acceso |
|---|---|---|
| `SUPABASE_URL` | `app/.env`, Vercel env | Público |
| `SUPABASE_KEY` (publishable) | `app/.env`, Vercel env | Público (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo Supabase secrets | Solo edge functions |
| `GROQ_API_KEY` | Solo Supabase secrets | Solo edge functions |
| `OPENROUTER_API_KEY` | Solo Supabase secrets | Solo edge functions |
| `TELEGRAM_BOT_TOKEN` | Solo Supabase secrets | Solo edge functions |
| `TELEGRAM_WEBHOOK_SECRET` | Solo Supabase secrets | Solo edge functions |

`.env` y `app/.env` están en `.gitignore`. **NUNCA commitear**.

## Audit automatizado

Correr periódicamente:

```bash
bash scripts/security-audit.sh
```

Verifica:
1. Vistas con `security_invoker = true`
2. RLS habilitado en todas las tablas
3. SECURITY DEFINER con `search_path` seteado
4. service_role NO está en frontend
5. Funciones de trigger no ejecutables por authenticated
6. `.env` reales no commiteados
7. No hay API keys hardcodeadas

## Issues históricos resueltos

| Migration | Bug |
|---|---|
| `005` | `user_id` sin `DEFAULT auth.uid()` permitía bugs de inserción |
| `010` | Link codes 6 dígitos sin rate limit |
| `016` | `create_transfer` permitía self-transfer |
| **`017`** | **🚨 GRAVE: vistas SQL bypasseaban RLS, exponiendo data de otros users** |
| `018` | `seed_default_categories(p_user_id)` no validaba ownership |

## Antes de cada release

- [ ] Correr `bash scripts/security-audit.sh` y revisar que todo esté ✅
- [ ] Si agregaste tablas nuevas: tienen RLS + policy?
- [ ] Si agregaste vistas: `security_invoker = true`?
- [ ] Si agregaste funciones SECURITY DEFINER: `search_path` + validan `auth.uid()`?
- [ ] Si agregaste edge functions: filtran por `user_id` explícito?
- [ ] `.env` no se commiteó?
