-- ============================================================
-- Hardening: user_id DEFAULT auth.uid() en tablas owned by user.
-- Previene bugs silenciosos si el cliente se olvida de mandar user_id.
-- RLS sigue siendo la última palabra (WITH CHECK user_id = auth.uid()).
-- ============================================================

ALTER TABLE public.accounts         ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.categories       ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.transactions     ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.transfers        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.budgets          ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.chat_identities  ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.link_codes       ALTER COLUMN user_id SET DEFAULT auth.uid();
