-- ============================================================
-- Security hardening: funciones SECURITY DEFINER
-- ============================================================
-- Issues encontrados en audit 2026-04-27:
--
-- 1. seed_default_categories(p_user_id) acepta cualquier user_id
--    sin validar que coincida con auth.uid(). Un user autenticado
--    podía crear categorías a otros users.
--
-- 2. Funciones de trigger (handle_new_user, log_*) tenían EXECUTE
--    grantado al rol authenticated. No deberían poder llamarse
--    manualmente desde el cliente.
-- ============================================================

-- ---------------------------------------------------
-- Fix 1: seed_default_categories valida que p_user_id == auth.uid()
-- (excepto cuando se llama desde el trigger handle_new_user con SECURITY
--  DEFINER, donde auth.uid() puede ser null durante el insert de auth.users)
-- ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_categories(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si auth.uid() existe (cliente autenticado), validar ownership
  -- Si auth.uid() es null (llamado desde trigger en signup), permitir
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'cannot seed categories for another user';
  END IF;

  INSERT INTO public.categories (user_id, name, icon, color, kind, is_system) VALUES
    -- Gastos
    (p_user_id, 'Supermercado', '🛒', '#22c55e', 'expense', true),
    (p_user_id, 'Gastronomía', '🍔', '#f59e0b', 'expense', true),
    (p_user_id, 'Transporte', '🚗', '#3b82f6', 'expense', true),
    (p_user_id, 'Combustible', '⛽', '#ef4444', 'expense', true),
    (p_user_id, 'Servicios', '💡', '#8b5cf6', 'expense', true),
    (p_user_id, 'Alquiler', '🏠', '#ec4899', 'expense', true),
    (p_user_id, 'Salud', '🏥', '#10b981', 'expense', true),
    (p_user_id, 'Educación', '📚', '#06b6d4', 'expense', true),
    (p_user_id, 'Entretenimiento', '🎬', '#a855f7', 'expense', true),
    (p_user_id, 'Suscripciones', '📱', '#f97316', 'expense', true),
    (p_user_id, 'Ropa', '👕', '#84cc16', 'expense', true),
    (p_user_id, 'Regalos', '🎁', '#f43f5e', 'expense', true),
    (p_user_id, 'Impuestos', '📄', '#64748b', 'expense', true),
    (p_user_id, 'Otros gastos', '💸', '#94a3b8', 'expense', true),
    -- Ingresos
    (p_user_id, 'Sueldo', '💰', '#22c55e', 'income', true),
    (p_user_id, 'Freelance', '💻', '#3b82f6', 'income', true),
    (p_user_id, 'Inversiones', '📈', '#a855f7', 'income', true),
    (p_user_id, 'Regalos recibidos', '🎁', '#ec4899', 'income', true),
    (p_user_id, 'Reintegros', '↩️', '#10b981', 'income', true),
    (p_user_id, 'Otros ingresos', '💵', '#94a3b8', 'income', true);
END;
$$;

-- ---------------------------------------------------
-- Fix 2: revocar EXECUTE de funciones de trigger
-- Estas funciones NO deberían ser invocables desde el cliente.
-- Los triggers las llaman directamente, que no requiere EXECUTE grant.
-- ---------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user           FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.log_account_delete        FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.log_chat_identity_change  FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at            FROM PUBLIC, authenticated, anon;

-- Los triggers siguen funcionando porque corren como SECURITY DEFINER
-- (heredan el privilegio del owner, postgres).
