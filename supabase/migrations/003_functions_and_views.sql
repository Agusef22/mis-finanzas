-- ============================================================
-- Funciones RPC + vistas para reportes
-- ============================================================

-- ------------------------------------------------------------
-- Vista: saldo actual por cuenta
-- balance = initial_balance + sum(incomes) - sum(expenses)
-- Transfers ya se modelan como expense (from) + income (to), así que no hacen falta aparte.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.account_balances AS
SELECT
  a.id AS account_id,
  a.user_id,
  a.name,
  a.currency,
  a.type,
  a.initial_balance
    + COALESCE(SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.type = 'transfer' AND tr.from_transaction_id = t.id THEN t.amount ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN t.type = 'transfer' AND tr.to_transaction_id   = t.id THEN t.amount ELSE 0 END), 0)
    AS balance
FROM public.accounts a
LEFT JOIN public.transactions t
  ON t.account_id = a.id AND t.deleted_at IS NULL
LEFT JOIN public.transfers tr
  ON tr.from_transaction_id = t.id OR tr.to_transaction_id = t.id
WHERE a.archived_at IS NULL
GROUP BY a.id, a.user_id, a.name, a.currency, a.type, a.initial_balance;

-- ------------------------------------------------------------
-- Vista: gastos por categoría por mes
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.monthly_category_summary AS
SELECT
  t.user_id,
  date_trunc('month', t.occurred_at)::date AS month,
  t.category_id,
  c.name AS category_name,
  c.icon AS category_icon,
  c.color AS category_color,
  t.type,
  t.currency,
  SUM(t.amount) AS total,
  COUNT(*) AS count
FROM public.transactions t
LEFT JOIN public.categories c ON c.id = t.category_id
WHERE t.deleted_at IS NULL
  AND t.type IN ('expense','income')
GROUP BY t.user_id, date_trunc('month', t.occurred_at), t.category_id, c.name, c.icon, c.color, t.type, t.currency;

-- ------------------------------------------------------------
-- RPC: transferir entre cuentas de forma atómica
-- ------------------------------------------------------------
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

  -- Verificar ownership
  SELECT currency INTO v_from_currency
    FROM accounts WHERE id = p_from_account AND user_id = v_user AND archived_at IS NULL;
  IF v_from_currency IS NULL THEN
    RAISE EXCEPTION 'from_account not found';
  END IF;

  SELECT currency INTO v_to_currency
    FROM accounts WHERE id = p_to_account AND user_id = v_user AND archived_at IS NULL;
  IF v_to_currency IS NULL THEN
    RAISE EXCEPTION 'to_account not found';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  -- Monto llegado (puede tener conversión + fee)
  v_to_amount := CASE
    WHEN v_from_currency = v_to_currency THEN p_amount - COALESCE(p_fee, 0)
    WHEN p_exchange_rate IS NOT NULL THEN (p_amount * p_exchange_rate) - COALESCE(p_fee, 0)
    ELSE NULL
  END;

  IF v_to_amount IS NULL OR v_to_amount <= 0 THEN
    RAISE EXCEPTION 'invalid exchange_rate or resulting amount';
  END IF;

  -- Insert de ambas transactions + transfer en una sola transacción
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

-- ------------------------------------------------------------
-- RPC: generar link code para vincular chat
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_link_code(p_provider public.chat_provider)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Expira códigos viejos del mismo user+provider
  UPDATE link_codes SET used_at = now()
    WHERE user_id = v_user AND provider = p_provider AND used_at IS NULL;

  -- Código de 6 dígitos, 10 min de vida
  v_code := lpad((floor(random() * 1000000))::text, 6, '0');

  INSERT INTO link_codes (code, user_id, provider, expires_at)
  VALUES (v_code, v_user, p_provider, now() + interval '10 minutes');

  RETURN v_code;
END;
$$;

-- ------------------------------------------------------------
-- RPC: soft delete transaction (y su transfer si corresponde)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_transaction(p_tx_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_transfer_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Si la tx es parte de un transfer, marcar ambas
  SELECT id INTO v_transfer_id FROM transfers
    WHERE (from_transaction_id = p_tx_id OR to_transaction_id = p_tx_id)
      AND user_id = v_user;

  IF v_transfer_id IS NOT NULL THEN
    UPDATE transactions SET deleted_at = now()
      WHERE id IN (
        SELECT from_transaction_id FROM transfers WHERE id = v_transfer_id
        UNION SELECT to_transaction_id FROM transfers WHERE id = v_transfer_id
      ) AND user_id = v_user;
  ELSE
    UPDATE transactions SET deleted_at = now()
      WHERE id = p_tx_id AND user_id = v_user;
  END IF;
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.create_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_link_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_transaction TO authenticated;
GRANT SELECT ON public.account_balances TO authenticated;
GRANT SELECT ON public.monthly_category_summary TO authenticated;
