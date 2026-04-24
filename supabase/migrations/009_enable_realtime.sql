-- ============================================================
-- Habilitar Realtime para que los clientes reciban notificaciones
-- cuando hay cambios en las tablas (INSERT, UPDATE, DELETE).
--
-- El websocket respeta RLS: cada user solo recibe cambios de SUS filas.
-- Las vistas (account_balances, monthly_category_summary) no necesitan
-- esto porque se refetchean cuando el cliente invalida su query.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_identities;
