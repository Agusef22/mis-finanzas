-- ============================================================
-- mis-finanzas — schema inicial
-- ============================================================
-- Single-user por ahora. Multi-moneda, offline-tolerante (client_uuid).

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES — extiende auth.users
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  default_currency text NOT NULL DEFAULT 'ARS',
  default_rate_type text NOT NULL DEFAULT 'blue' CHECK (default_rate_type IN ('oficial','blue','mep','ccl','tarjeta','mayorista')),
  locale text NOT NULL DEFAULT 'es-AR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger: cuando se crea un user en auth.users, crear su profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ACCOUNTS — cuentas (efectivo, banco, tarjeta, etc.)
-- ============================================================
CREATE TYPE public.account_type AS ENUM ('cash','bank','credit_card','savings','investment','wallet','other');

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.account_type NOT NULL DEFAULT 'cash',
  currency text NOT NULL DEFAULT 'ARS',
  initial_balance numeric(18,2) NOT NULL DEFAULT 0,
  icon text,
  color text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_user ON public.accounts (user_id) WHERE archived_at IS NULL;

-- ============================================================
-- CATEGORIES — categorías jerárquicas
-- ============================================================
CREATE TYPE public.category_kind AS ENUM ('expense','income','both');

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  icon text,
  color text,
  kind public.category_kind NOT NULL DEFAULT 'expense',
  is_system boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_user ON public.categories (user_id) WHERE archived_at IS NULL;
CREATE INDEX idx_categories_parent ON public.categories (parent_id);

-- ============================================================
-- TRANSACTIONS — tabla central
-- ============================================================
CREATE TYPE public.transaction_type AS ENUM ('expense','income','transfer');
CREATE TYPE public.transaction_source AS ENUM ('manual','whatsapp','telegram','import','recurring','api');

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  type public.transaction_type NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL, -- snapshot, heredado de la account al crearse
  exchange_rate_to_ars numeric(18,6), -- rate al momento, nullable si currency = ARS
  occurred_at timestamptz NOT NULL DEFAULT now(),
  description text,
  notes text,
  source public.transaction_source NOT NULL DEFAULT 'manual',
  source_metadata jsonb, -- id del mensaje WA/TG, raw text, confidence
  client_uuid uuid, -- generado en cliente para dedup / offline
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_uuid)
);

CREATE INDEX idx_transactions_user_date ON public.transactions (user_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_user_category ON public.transactions (user_id, category_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_user_account ON public.transactions (user_id, account_id, occurred_at DESC) WHERE deleted_at IS NULL;

-- ============================================================
-- TRANSFERS — vincula dos transactions (expense + income) entre cuentas
-- ============================================================
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  to_transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  exchange_rate numeric(18,6), -- si las cuentas tienen monedas distintas
  fee numeric(18,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_transaction_id),
  UNIQUE (to_transaction_id)
);

CREATE INDEX idx_transfers_user ON public.transfers (user_id);

-- ============================================================
-- BUDGETS — presupuestos por categoría
-- ============================================================
CREATE TYPE public.budget_period AS ENUM ('weekly','monthly','yearly');

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  name text,
  period public.budget_period NOT NULL DEFAULT 'monthly',
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'ARS',
  starts_at date NOT NULL DEFAULT CURRENT_DATE,
  ends_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_budgets_user ON public.budgets (user_id);

-- ============================================================
-- EXCHANGE_RATES — cache de cotizaciones
-- ============================================================
CREATE TABLE public.exchange_rates (
  date date NOT NULL,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate_type text NOT NULL DEFAULT 'oficial',
  rate numeric(18,6) NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, from_currency, to_currency, rate_type)
);

CREATE INDEX idx_rates_currency_date ON public.exchange_rates (from_currency, to_currency, date DESC);

-- ============================================================
-- CHAT_IDENTITIES — vinculación WhatsApp / Telegram a users
-- ============================================================
CREATE TYPE public.chat_provider AS ENUM ('whatsapp','telegram');

CREATE TABLE public.chat_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.chat_provider NOT NULL,
  external_id text NOT NULL, -- phone (whatsapp:+549...) o chat_id de Telegram
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  UNIQUE (provider, external_id)
);

CREATE INDEX idx_chat_identities_user ON public.chat_identities (user_id);

-- ============================================================
-- LINK_CODES — códigos temporales para vincular chat identity
-- ============================================================
CREATE TABLE public.link_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.chat_provider NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_link_codes_user ON public.link_codes (user_id);

-- ============================================================
-- CHAT_MESSAGES — log de mensajes procesados (WA + TG)
-- ============================================================
CREATE TYPE public.chat_message_status AS ENUM ('pending','parsed','auto_confirmed','confirmed','rejected','failed_parse','ignored');

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- null si no matcheamos identidad
  identity_id uuid REFERENCES public.chat_identities(id) ON DELETE SET NULL,
  provider public.chat_provider NOT NULL,
  provider_message_id text NOT NULL,
  external_sender text NOT NULL, -- phone o chat_id
  raw_text text NOT NULL,
  parsed jsonb,
  confidence numeric(3,2),
  status public.chat_message_status NOT NULL DEFAULT 'pending',
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, provider_message_id)
);

CREATE INDEX idx_chat_messages_user ON public.chat_messages (user_id, received_at DESC);
CREATE INDEX idx_chat_messages_status ON public.chat_messages (status) WHERE status IN ('pending','parsed');

-- ============================================================
-- updated_at trigger (reusable)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_budgets_updated BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
