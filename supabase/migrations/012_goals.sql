-- ============================================================
-- Metas de ahorro (goals)
-- ============================================================
-- Permiten al user trackear progreso hacia un objetivo (ej: "USD 2000 para compu").
-- Se asocian opcionalmente a una cuenta (típicamente una cuenta "Ahorros")
-- y el progreso se calcula automáticamente según el saldo de esa cuenta.
-- También se puede actualizar manualmente.

CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_amount numeric(18,2) NOT NULL CHECK (target_amount > 0),
  currency text NOT NULL DEFAULT 'ARS',
  -- Si linkea una cuenta, el progreso se autocalcula con el saldo
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  -- Si no hay account_id, manual_progress es lo que lleva ahorrado
  manual_progress numeric(18,2) NOT NULL DEFAULT 0,
  icon text,
  color text,
  deadline date,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON public.goals (user_id) WHERE archived_at IS NULL;

CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_all_own" ON public.goals
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Vista con el progreso calculado
CREATE OR REPLACE VIEW public.goal_status AS
SELECT
  g.id AS goal_id,
  g.user_id,
  g.name,
  g.description,
  g.target_amount,
  g.currency,
  g.account_id,
  g.manual_progress,
  g.icon,
  g.color,
  g.deadline,
  g.completed_at,
  g.archived_at,
  g.created_at,
  -- Progreso: si hay cuenta linkeada, usa su saldo. Sino, manual_progress.
  CASE
    WHEN g.account_id IS NOT NULL THEN GREATEST(0, COALESCE(ab.balance, 0))
    ELSE g.manual_progress
  END AS current_amount,
  -- Porcentaje
  CASE
    WHEN g.target_amount > 0 THEN
      LEAST(100, (CASE
        WHEN g.account_id IS NOT NULL THEN GREATEST(0, COALESCE(ab.balance, 0))
        ELSE g.manual_progress
      END) / g.target_amount * 100)
    ELSE 0
  END AS pct_complete
FROM goals g
LEFT JOIN account_balances ab ON ab.account_id = g.account_id
WHERE g.archived_at IS NULL;

GRANT SELECT ON public.goal_status TO authenticated;

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.goals;
