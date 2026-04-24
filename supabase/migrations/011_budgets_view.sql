-- ============================================================
-- Vista auxiliar para calcular el "gastado" de cada presupuesto
-- en el período activo (mes, semana, año).
-- ============================================================

CREATE OR REPLACE VIEW public.budget_status AS
SELECT
  b.id AS budget_id,
  b.user_id,
  b.category_id,
  b.name,
  b.period,
  b.amount,
  b.currency,
  b.starts_at,
  b.ends_at,
  -- Calcular el inicio del período actual según el tipo
  CASE
    WHEN b.period = 'weekly'  THEN date_trunc('week', now())::date
    WHEN b.period = 'monthly' THEN date_trunc('month', now())::date
    WHEN b.period = 'yearly'  THEN date_trunc('year', now())::date
  END AS period_start,
  CASE
    WHEN b.period = 'weekly'  THEN (date_trunc('week', now()) + interval '1 week')::date
    WHEN b.period = 'monthly' THEN (date_trunc('month', now()) + interval '1 month')::date
    WHEN b.period = 'yearly'  THEN (date_trunc('year', now()) + interval '1 year')::date
  END AS period_end,
  -- Gasto actual en ese período, en la misma moneda del presupuesto
  COALESCE((
    SELECT SUM(t.amount)
    FROM transactions t
    WHERE t.user_id = b.user_id
      AND t.type = 'expense'
      AND t.deleted_at IS NULL
      AND t.currency = b.currency
      AND (b.category_id IS NULL OR t.category_id = b.category_id)
      AND t.occurred_at >= (
        CASE
          WHEN b.period = 'weekly'  THEN date_trunc('week', now())
          WHEN b.period = 'monthly' THEN date_trunc('month', now())
          WHEN b.period = 'yearly'  THEN date_trunc('year', now())
        END
      )
      AND t.occurred_at < (
        CASE
          WHEN b.period = 'weekly'  THEN date_trunc('week', now()) + interval '1 week'
          WHEN b.period = 'monthly' THEN date_trunc('month', now()) + interval '1 month'
          WHEN b.period = 'yearly'  THEN date_trunc('year', now()) + interval '1 year'
        END
      )
  ), 0) AS spent
FROM budgets b
WHERE (b.ends_at IS NULL OR b.ends_at >= CURRENT_DATE);

GRANT SELECT ON public.budget_status TO authenticated;
