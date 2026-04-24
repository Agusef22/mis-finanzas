-- ============================================================
-- RLS policies — cada user solo ve y modifica lo suyo
-- ============================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ACCOUNTS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_all_own" ON public.accounts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CATEGORIES
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_all_own" ON public.categories
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_all_own" ON public.transactions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- TRANSFERS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_all_own" ON public.transfers
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- BUDGETS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_all_own" ON public.budgets
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- EXCHANGE_RATES — lectura pública, escritura solo service role
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rates_select_all_authenticated" ON public.exchange_rates
  FOR SELECT TO authenticated USING (true);

-- CHAT_IDENTITIES
ALTER TABLE public.chat_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_identities_all_own" ON public.chat_identities
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- LINK_CODES
ALTER TABLE public.link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "link_codes_all_own" ON public.link_codes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CHAT_MESSAGES — solo lectura del propio user, escritura vía service role desde edge function
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select_own" ON public.chat_messages
  FOR SELECT USING (user_id = auth.uid());
