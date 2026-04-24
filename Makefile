# ---- mis-finanzas ------------------------------------------

.PHONY: help install db-start db-stop db-reset db-studio dev build functions-deploy tg-webhook-set

help:
	@echo "Targets:"
	@echo "  install            - instala deps de la app"
	@echo "  db-start           - arranca Supabase local (Docker)"
	@echo "  db-stop            - detiene Supabase local"
	@echo "  db-reset           - aplica migraciones + seed"
	@echo "  db-studio          - abre Studio local (http://localhost:54323)"
	@echo "  dev                - corre Nuxt en dev"
	@echo "  build              - build Nuxt"
	@echo "  functions-deploy   - deploy de edge functions a tu proyecto Supabase"
	@echo "  tg-webhook-set     - configura el webhook de Telegram (requiere TELEGRAM_BOT_TOKEN y WEBHOOK_URL)"

install:
	cd app && pnpm install

db-start:
	supabase start

db-stop:
	supabase stop

db-reset:
	supabase db reset

db-studio:
	open http://localhost:54323

dev:
	cd app && pnpm dev

build:
	cd app && pnpm build

functions-deploy:
	supabase functions deploy tg-webhook
	supabase functions deploy wa-webhook
	supabase functions deploy refresh-rates

# Uso:
#   WEBHOOK_URL=https://<proyecto>.supabase.co/functions/v1/tg-webhook make tg-webhook-set
tg-webhook-set:
	@if [ -z "$$WEBHOOK_URL" ] || [ -z "$$TELEGRAM_BOT_TOKEN" ]; then \
		echo "ERROR: seteá TELEGRAM_BOT_TOKEN y WEBHOOK_URL"; exit 1; \
	fi
	curl -s -X POST "https://api.telegram.org/bot$$TELEGRAM_BOT_TOKEN/setWebhook" \
		-d "url=$$WEBHOOK_URL" \
		-d "secret_token=$$TELEGRAM_WEBHOOK_SECRET"
	@echo ""
