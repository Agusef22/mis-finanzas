-- Bug fix: account_transaction_count debe contar TODAS las filas que bloquean
-- el delete (incluyendo soft-deleted), no solo las activas.

CREATE OR REPLACE FUNCTION public.account_transaction_count(p_account_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FROM transactions
  WHERE account_id = p_account_id
    AND user_id = auth.uid();
$$;
