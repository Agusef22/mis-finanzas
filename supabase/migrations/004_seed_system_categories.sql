-- ============================================================
-- Seed de categorías por defecto — se insertan para cada user nuevo
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_default_categories(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Hook: al crear el profile, seedear categorías
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  PERFORM public.seed_default_categories(NEW.id);

  -- Cuenta inicial por defecto
  INSERT INTO public.accounts (user_id, name, type, currency, icon, color)
  VALUES (NEW.id, 'Efectivo', 'cash', 'ARS', '💵', '#22c55e');

  RETURN NEW;
END;
$$;
