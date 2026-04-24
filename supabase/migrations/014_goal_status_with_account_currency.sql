-- Fix: goal_status debe exponer la moneda de la cuenta linkeada
-- para que el cliente pueda convertir si es distinta a la meta.

DROP VIEW IF EXISTS public.goal_status;

CREATE VIEW public.goal_status AS
SELECT
  g.id AS goal_id,
  g.user_id,
  g.name,
  g.description,
  g.target_amount,
  g.currency,
  g.account_id,
  ab.currency AS account_currency,      -- moneda real de la cuenta (para convertir)
  g.manual_progress,
  g.icon,
  g.color,
  g.deadline,
  g.completed_at,
  g.archived_at,
  g.created_at,
  -- current_amount en la MONEDA DE LA CUENTA (no convertida todavía)
  -- El cliente la convierte a la moneda de la meta usando el rate.
  CASE
    WHEN g.account_id IS NOT NULL THEN GREATEST(0, COALESCE(ab.balance, 0))
    ELSE g.manual_progress
  END AS current_amount_raw
FROM goals g
LEFT JOIN account_balances ab ON ab.account_id = g.account_id
WHERE g.archived_at IS NULL;

GRANT SELECT ON public.goal_status TO authenticated;
