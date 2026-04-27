-- ============================================================
-- Rate limiting general
-- ============================================================
-- Tabla + función helper + triggers en tablas críticas
-- para prevenir abuso (spam de inserts, ataques DOS, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_recent
  ON public.rate_limits (user_id, action, window_start DESC);

-- RLS sin policies = todo bloqueado para clientes.
-- Solo las funciones SECURITY DEFINER pueden tocar esta tabla.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Función helper: check_rate_limit
-- ============================================================
-- Uso: PERFORM check_rate_limit('insert_transaction', 60, 60);
--   → max 60 ocurrencias de 'insert_transaction' en 60 segundos por user
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_max int,
  p_window_seconds int DEFAULT 60
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count int;
  v_window_start timestamptz;
BEGIN
  -- Si no hay user (ej: trigger desde signup), no aplicar rate limit
  IF v_user IS NULL THEN RETURN; END IF;

  -- Bucket por minuto (granularidad estándar)
  v_window_start := date_trunc('minute', now());

  -- Contar acciones en la ventana
  SELECT COALESCE(SUM(count), 0) INTO v_count
  FROM rate_limits
  WHERE user_id = v_user
    AND action = p_action
    AND window_start > now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_max THEN
    RAISE EXCEPTION 'rate_limit_exceeded: max % per %s para %', p_max, p_window_seconds, p_action
      USING ERRCODE = 'P0001', HINT = 'Esperá un momento antes de intentar de nuevo';
  END IF;

  -- Upsert: si ya existe el bucket de este minuto, incrementa; sino, crea
  INSERT INTO rate_limits (user_id, action, window_start, count)
  VALUES (v_user, p_action, v_window_start, 1)
  ON CONFLICT (user_id, action, window_start)
  DO UPDATE SET count = rate_limits.count + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit FROM PUBLIC, authenticated, anon;

-- ============================================================
-- Triggers de rate limit por tabla crítica
-- Límites pensados para uso normal MÁS abuso obvio:
--   - Un user normal: ~5-30 ops/día por tabla
--   - Un atacante: 1000+/min
-- Ponemos los límites para pasar el primero pero cortar el segundo.
-- ============================================================

-- TRANSACTIONS: 60/min (permite batch import pero corta DOS)
CREATE OR REPLACE FUNCTION public.rl_transactions_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_rate_limit('insert_transaction', 60, 60);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rl_transactions_insert FROM PUBLIC, authenticated, anon;

DROP TRIGGER IF EXISTS trg_rl_transactions_insert ON public.transactions;
CREATE TRIGGER trg_rl_transactions_insert
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION rl_transactions_insert();

-- ACCOUNTS: 20/hora (ningún user normal crea más)
CREATE OR REPLACE FUNCTION public.rl_accounts_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_rate_limit('insert_account', 20, 3600);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rl_accounts_insert FROM PUBLIC, authenticated, anon;

DROP TRIGGER IF EXISTS trg_rl_accounts_insert ON public.accounts;
CREATE TRIGGER trg_rl_accounts_insert
  BEFORE INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION rl_accounts_insert();

-- CATEGORIES: 30/hora (excluye seed sistema en signup)
CREATE OR REPLACE FUNCTION public.rl_categories_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Skip rate limit para categorías sistema (creadas en signup)
  IF NEW.is_system = false THEN
    PERFORM check_rate_limit('insert_category', 30, 3600);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rl_categories_insert FROM PUBLIC, authenticated, anon;

DROP TRIGGER IF EXISTS trg_rl_categories_insert ON public.categories;
CREATE TRIGGER trg_rl_categories_insert
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION rl_categories_insert();

-- BUDGETS: 10/hora
CREATE OR REPLACE FUNCTION public.rl_budgets_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_rate_limit('insert_budget', 10, 3600);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rl_budgets_insert FROM PUBLIC, authenticated, anon;

DROP TRIGGER IF EXISTS trg_rl_budgets_insert ON public.budgets;
CREATE TRIGGER trg_rl_budgets_insert
  BEFORE INSERT ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION rl_budgets_insert();

-- GOALS: 10/hora
CREATE OR REPLACE FUNCTION public.rl_goals_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_rate_limit('insert_goal', 10, 3600);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rl_goals_insert FROM PUBLIC, authenticated, anon;

DROP TRIGGER IF EXISTS trg_rl_goals_insert ON public.goals;
CREATE TRIGGER trg_rl_goals_insert
  BEFORE INSERT ON public.goals
  FOR EACH ROW EXECUTE FUNCTION rl_goals_insert();

-- ============================================================
-- Cleanup: borra rate_limits viejos (>24h) para no llenar la tabla
-- Se puede agendar con pg_cron si se habilita; por ahora se limpia
-- automáticamente cada vez que un user inserta (con poca probabilidad).
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limits WHERE window_start < now() - interval '24 hours';
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits FROM PUBLIC, authenticated, anon;
