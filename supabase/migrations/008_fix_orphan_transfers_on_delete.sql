-- ============================================================
-- Bug fix: al eliminar una cuenta que participaba en transferencias,
-- la transacción "par" (en otra cuenta) quedaba huérfana y dejaba de
-- contar en el balance, causando que la otra cuenta "ganara" o "perdiera"
-- plata artificialmente.
--
-- Solución: antes de borrar la cuenta, convertir las tx-par en
-- income/expense normales para que sigan afectando el balance correctamente.
-- ============================================================

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

  -- === Paso 1: convertir tx "par" de transferencias en income/expense normales ===

  -- Caso A: la tx de la cuenta eliminada era el "from" del transfer.
  -- Su par "to" está en OTRA cuenta y era una entrada (llegó plata allí).
  -- La convertimos en income para que siga sumando al balance.
  UPDATE public.transactions t
  SET
    type = 'income',
    description = COALESCE(t.description, 'Transferencia recibida (cuenta origen eliminada)'),
    source_metadata = COALESCE(t.source_metadata, '{}'::jsonb) || jsonb_build_object(
      'ex_transfer', true,
      'reason', 'source_account_deleted'
    )
  FROM public.transfers tr
  WHERE tr.to_transaction_id = t.id
    AND tr.user_id = v_user
    AND tr.from_transaction_id IN (
      SELECT id FROM public.transactions
      WHERE account_id = p_account_id AND user_id = v_user
    )
    AND t.account_id != p_account_id;

  -- Caso B: la tx de la cuenta eliminada era el "to" del transfer.
  -- Su par "from" está en OTRA cuenta y era una salida (se fue plata de allí).
  -- La convertimos en expense para que siga restando al balance.
  UPDATE public.transactions t
  SET
    type = 'expense',
    description = COALESCE(t.description, 'Transferencia enviada (cuenta destino eliminada)'),
    source_metadata = COALESCE(t.source_metadata, '{}'::jsonb) || jsonb_build_object(
      'ex_transfer', true,
      'reason', 'target_account_deleted'
    )
  FROM public.transfers tr
  WHERE tr.from_transaction_id = t.id
    AND tr.user_id = v_user
    AND tr.to_transaction_id IN (
      SELECT id FROM public.transactions
      WHERE account_id = p_account_id AND user_id = v_user
    )
    AND t.account_id != p_account_id;

  -- === Paso 2: borrar las transacciones de la cuenta ===
  -- Los transfers relacionados caen por FK ON DELETE CASCADE.
  WITH d AS (
    DELETE FROM public.transactions
    WHERE account_id = p_account_id AND user_id = v_user
    RETURNING id
  )
  SELECT COUNT(*) INTO v_tx_count FROM d;

  -- === Paso 3: borrar la cuenta ===
  DELETE FROM public.accounts WHERE id = p_account_id AND user_id = v_user;

  RETURN QUERY SELECT p_account_id, v_tx_count;
END;
$$;
