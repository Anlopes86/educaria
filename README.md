# EducarIA

Plataforma para professores criarem e organizarem materiais didaticos com apoio de IA.

## Configuracao local

1. Configure o Firebase seguindo `docs/firebase-setup.md`.
2. Configure o servico de IA copiando `ai-service/.env.example` para `ai-service/.env`.
3. Nunca commite arquivos `.env` ou configuracoes locais com chaves reais.

## Documentacao

- Firebase e regras de seguranca: `docs/firebase-setup.md`
- Deploy Firebase sem config no GitHub: `docs/deploy-firebase-config.md`
- Servico de IA e creditos: `docs/ia-materials-setup.md`
- Organizacao gradual do CSS: `docs/css-architecture.md`
- Internacionalizacao: `docs/i18n.md`
- Regressao de i18n: `docs/i18n-regression.md`
- Checkout e plano Pro: `docs/billing-checkout.md`
- Checklists de regressao: `docs/regressao-filtros-fluxos.md`

## Plano Pro

A pagina de configuracoes mostra o link de pagamento quando `window.EDUCARIA_BILLING_CHECKOUT_URL` ou `localStorage["educaria:billing:checkout-url"]` estiver definido. A confirmacao do pagamento ainda deve ser feita por backend/webhook antes de alterar `plan` para `pro`.
