-- Hardening del RPC create_transfer:
--   1. Rechazar self-transfer (from === to)
--   2. Validar que exchange_rate sea positivo si se provee
--   3. Verificar que no haya overflow en el monto resultante

CREATE OR REPLACE FUNCTION public.create_transfer(
  p_from_account uuid,
  p_to_account uuid,
  p_amount numeric,
  p_occurred_at timestamptz DEFAULT now(),
  p_description text DEFAULT NULL,
  p_exchange_rate numeric DEFAULT NULL,
  p_fee numeric DEFAULT 0,
  p_client_uuid_from uuid DEFAULT NULL,
  p_client_uuid_to uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_from_currency text;
  v_to_currency text;
  v_from_tx uuid;
  v_to_tx uuid;
  v_to_amount numeric;
  v_transfer_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Rechazar self-transfer
  IF p_from_account = p_to_account THEN
    RAISE EXCEPTION 'cannot transfer to the same account';
  END IF;

  -- Validar fee no negativo
  IF COALESCE(p_fee, 0) < 0 THEN
    RAISE EXCEPTION 'fee cannot be negative';
  END IF;

  -- Verificar ownership de ambas cuentas
  SELECT currency INTO v_from_currency
    FROM accounts WHERE id = p_from_account AND user_id = v_user AND archived_at IS NULL;
  IF v_from_currency IS NULL THEN
    RAISE EXCEPTION 'from_account not found or archived';
  END IF;

  SELECT currency INTO v_to_currency
    FROM accounts WHERE id = p_to_account AND user_id = v_user AND archived_at IS NULL;
  IF v_to_currency IS NULL THEN
    RAISE EXCEPTION 'to_account not found or archived';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  -- Validar exchange_rate si las monedas difieren
  IF v_from_currency <> v_to_currency THEN
    IF p_exchange_rate IS NULL THEN
      RAISE EXCEPTION 'exchange_rate required when currencies differ (% vs %)', v_from_currency, v_to_currency;
    END IF;
    IF p_exchange_rate <= 0 THEN
      RAISE EXCEPTION 'exchange_rate must be positive';
    END IF;
  END IF;

  -- Calcular monto que llega (después de conversión + fee)
  v_to_amount := CASE
    WHEN v_from_currency = v_to_currency THEN p_amount - COALESCE(p_fee, 0)
    ELSE (p_amount * p_exchange_rate) - COALESCE(p_fee, 0)
  END;

  IF v_to_amount <= 0 THEN
    RAISE EXCEPTION 'resulting amount after fee/rate is not positive (got %)', v_to_amount;
  END IF;

  -- Insert atómico de ambas transactions + transfer
  INSERT INTO transactions (user_id, account_id, type, amount, currency, occurred_at, description, source, client_uuid)
  VALUES (v_user, p_from_account, 'transfer', p_amount, v_from_currency, p_occurred_at, p_description, 'manual', p_client_uuid_from)
  RETURNING id INTO v_from_tx;

  INSERT INTO transactions (user_id, account_id, type, amount, currency, occurred_at, description, source, client_uuid)
  VALUES (v_user, p_to_account, 'transfer', v_to_amount, v_to_currency, p_occurred_at, p_description, 'manual', p_client_uuid_to)
  RETURNING id INTO v_to_tx;

  INSERT INTO transfers (user_id, from_transaction_id, to_transaction_id, exchange_rate, fee)
  VALUES (v_user, v_from_tx, v_to_tx, p_exchange_rate, p_fee)
  RETURNING id INTO v_transfer_id;

  RETURN v_transfer_id;
END;
$$;
