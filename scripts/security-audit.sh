#!/usr/bin/env bash
# ============================================================
# Security audit script
# ============================================================
# Verifica que la DB cumpla las invariantes de seguridad clave.
# Corre con: bash scripts/security-audit.sh
# ============================================================

set -e
SUPABASE_BIN="${HOME}/.local/bin/supabase"
cd "$(dirname "$0")/.."

echo "=========================================="
echo "  Security Audit — mis-finanzas"
echo "=========================================="
echo ""

# 1. Todas las vistas tienen security_invoker = true
echo "▶ Check 1: vistas con security_invoker = true"
$SUPABASE_BIN db query "
  SELECT
    relname AS view_name,
    CASE WHEN reloptions::text LIKE '%security_invoker=true%' THEN '✅ OK' ELSE '❌ MISSING' END AS status
  FROM pg_class
  WHERE relkind = 'v' AND relnamespace = 'public'::regnamespace
  ORDER BY relname;
" --linked 2>&1 | grep -E "view_name|status|❌" | head -30
echo ""

# 2. Todas las tablas con RLS habilitado
echo "▶ Check 2: tablas con RLS habilitado"
$SUPABASE_BIN db query "
  SELECT
    tablename,
    CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END AS status
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT IN ('exchange_rates')  -- exchange_rates es pública
  ORDER BY tablename;
" --linked 2>&1 | grep -E "tablename|status|❌"
echo ""

# 3. Todas las funciones SECURITY DEFINER tienen search_path seteado
echo "▶ Check 3: SECURITY DEFINER con search_path"
$SUPABASE_BIN db query "
  SELECT
    proname,
    CASE
      WHEN proconfig::text LIKE '%search_path=%' THEN '✅ OK'
      ELSE '❌ MISSING search_path'
    END AS status
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND prosecdef = true
  ORDER BY proname;
" --linked 2>&1 | grep -E "proname|status|❌"
echo ""

# 4. Service role key NUNCA en frontend
echo "▶ Check 4: service_role key NO está en frontend"
if grep -rn "SERVICE_ROLE\|service_role\|sb_secret" app/ --include="*.ts" --include="*.vue" 2>/dev/null | grep -v node_modules > /tmp/sec_audit.txt; then
  if [ -s /tmp/sec_audit.txt ]; then
    echo "❌ FOUND in frontend:"
    cat /tmp/sec_audit.txt
  else
    echo "✅ OK — service_role no aparece en frontend"
  fi
else
  echo "✅ OK — service_role no aparece en frontend"
fi
echo ""

# 5. Funciones de trigger NO ejecutables por authenticated
echo "▶ Check 5: funciones de trigger no ejecutables por authenticated"
$SUPABASE_BIN db query "
  SELECT
    proname,
    CASE
      WHEN has_function_privilege('authenticated', oid, 'EXECUTE')
      THEN '⚠️  authenticated PUEDE ejecutar (verificar si es intencional)'
      ELSE '✅ Bloqueado'
    END AS status
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname IN ('handle_new_user', 'log_account_delete', 'log_chat_identity_change', 'set_updated_at')
  ORDER BY proname;
" --linked 2>&1 | grep -E "proname|status"
echo ""

# 6. .env files reales no están commiteados (excluye .env.example que es template)
echo "▶ Check 6: archivos .env reales no commiteados"
LEAKED=$(git ls-files 2>/dev/null | grep -E "(^|/)\.env($|\.[^e])" | grep -v "\.env\.example" || true)
if [ -n "$LEAKED" ]; then
  echo "❌ ARCHIVOS .env COMMITEADOS:"
  echo "$LEAKED"
else
  echo "✅ OK — solo .env.example (template) está commiteado"
fi
echo ""

# 7. Hardcoded API keys en el código
echo "▶ Check 7: API keys hardcodeadas en el código"
KEYS_FOUND=$(grep -rn -E "(sk-or-v1-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|eyJhbGciO[A-Za-z0-9._-]{50,})" app/ supabase/ 2>/dev/null | grep -v node_modules | grep -v ".nuxt" | grep -v "\.example" || true)
if [ -n "$KEYS_FOUND" ]; then
  echo "❌ KEYS HARDCODEADAS EN CÓDIGO:"
  echo "$KEYS_FOUND" | head -10
else
  echo "✅ OK — no hay keys hardcodeadas"
fi
echo ""

echo "=========================================="
echo "  Audit completo. Revisá ❌ y ⚠️ arriba."
echo "=========================================="
