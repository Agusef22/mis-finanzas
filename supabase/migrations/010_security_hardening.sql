-- ============================================================
-- Security hardening:
--   1. link_codes de 8 dígitos (antes 6) + TTL 5min (antes 10)
--   2. Rate limiting en generate_link_code
--   3. Tabla audit_log para acciones sensibles
-- ============================================================

-- ------------------------------------------------------------
-- 1) Link codes más largos + más efímeros
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
  v_recent_count int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Rate limit: máximo 5 códigos por hora por user
  SELECT COUNT(*) INTO v_recent_count
    FROM link_codes
    WHERE user_id = v_user
      AND created_at > now() - interval '1 hour';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'rate_limit: máximo 5 códigos por hora';
  END IF;

  -- Expira códigos viejos del mismo user+provider
  UPDATE link_codes SET used_at = now()
    WHERE user_id = v_user AND provider = p_provider AND used_at IS NULL;

  -- Código de 8 dígitos, 5 min de vida
  v_code := lpad((floor(random() * 100000000))::text, 8, '0');

  INSERT INTO link_codes (code, user_id, provider, expires_at)
  VALUES (v_code, v_user, p_provider, now() + interval '5 minutes');

  RETURN v_code;
END;
$$;

-- ------------------------------------------------------------
-- 2) Audit log — registro inmutable de acciones sensibles
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,            -- 'account.delete', 'chat.linked', 'chat.unlinked', 'tx.bulk_delete', etc
  entity_type text,                 -- 'account', 'transaction', 'chat_identity', etc
  entity_id uuid,
  details jsonb,                    -- info adicional contextual
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_date ON public.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log (user_id, action);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- El user puede leer sus propios logs (para una futura página "Actividad de cuenta")
CREATE POLICY "audit_log_select_own" ON public.audit_log
  FOR SELECT USING (user_id = auth.uid());

-- Solo se inserta desde service role (edge functions o triggers) — no desde cliente
-- No se permite UPDATE ni DELETE (append-only)

-- ------------------------------------------------------------
-- 3) Trigger: cuando se vincula una chat_identity, loguear evento
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_chat_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (
      NEW.user_id, 'chat.linked', 'chat_identity', NEW.id,
      jsonb_build_object(
        'provider', NEW.provider,
        'external_id', NEW.external_id,
        'display_name', NEW.display_name
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (
      OLD.user_id, 'chat.unlinked', 'chat_identity', OLD.id,
      jsonb_build_object(
        'provider', OLD.provider,
        'external_id', OLD.external_id
      )
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_identity_audit ON public.chat_identities;
CREATE TRIGGER trg_chat_identity_audit
  AFTER INSERT OR DELETE ON public.chat_identities
  FOR EACH ROW EXECUTE FUNCTION public.log_chat_identity_change();

-- ------------------------------------------------------------
-- 4) Trigger: cuando se elimina un account, auditar
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_account_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    OLD.user_id, 'account.delete', 'account', OLD.id,
    jsonb_build_object(
      'name', OLD.name,
      'currency', OLD.currency,
      'type', OLD.type,
      'initial_balance', OLD.initial_balance
    )
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_delete_audit ON public.accounts;
CREATE TRIGGER trg_account_delete_audit
  AFTER DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.log_account_delete();
