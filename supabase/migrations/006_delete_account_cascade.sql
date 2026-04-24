-- ============================================================
-- RPC: eliminar una cuenta + todos sus movimientos (destructivo)
-- ============================================================
-- Los FKs del schema tienen ON DELETE RESTRICT entre transactions y accounts
-- para evitar borrados accidentales. Este RPC hace el cascade explícito
-- dentro de una sola transacción (atómico).

CREATE OR REPLACE FUNCTION public.delete_account_cascade(p_account_id uuid)
RETURNS TABLE (deleted_account uuid, deleted_transactions bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
  v_tx_count bigint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM accounts WHERE id = p_account_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'account not found';
  END IF;
  IF v_owner != v_user THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Borra las transactions de esta cuenta.
  -- Si alguna es parte de un transfer, el transfer se borra en cascade (FK ON DELETE CASCADE).
  -- La tx "pareja" del transfer (en otra cuenta) queda suelta sin transfer, eso es aceptable.
  WITH d AS (
    DELETE FROM transactions
    WHERE account_id = p_account_id AND user_id = v_user
    RETURNING id
  )
  SELECT COUNT(*) INTO v_tx_count FROM d;

  DELETE FROM accounts WHERE id = p_account_id AND user_id = v_user;

  RETURN QUERY SELECT p_account_id, v_tx_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_account_cascade TO authenticated;

-- ------------------------------------------------------------
-- Helper: cantidad de movimientos de una cuenta (para confirmaciones en UI)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_transaction_count(p_account_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FROM transactions
  WHERE account_id = p_account_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.account_transaction_count TO authenticated;
