-- Habilitar Realtime en budgets para que la UI se actualice al instante
-- cuando se crea/edita/borra un presupuesto desde otro device o tab.
ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets;
