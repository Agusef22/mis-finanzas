-- ============================================================
-- CRITICAL SECURITY FIX
-- ============================================================
-- BUG ENCONTRADO 2026-04-27:
-- Las vistas (account_balances, monthly_category_summary, budget_status,
-- goal_status) BYPASSEABAN RLS de las tablas subyacentes porque por default
-- en Postgres las vistas se ejecutan con permisos del creador (postgres),
-- no del usuario que las consulta.
--
-- Resultado: cualquier usuario autenticado podía leer balances, stats,
-- presupuestos y metas de TODOS los demás usuarios.
--
-- FIX: setear security_invoker=true en todas las vistas para que respeten
-- RLS de las tablas que usan internamente (Postgres 15+).
-- ============================================================

ALTER VIEW public.account_balances           SET (security_invoker = true);
ALTER VIEW public.monthly_category_summary   SET (security_invoker = true);
ALTER VIEW public.budget_status              SET (security_invoker = true);
ALTER VIEW public.goal_status                SET (security_invoker = true);
