# EducarIA

Plataforma para professores criarem, organizarem e apresentarem materiais didáticos com apoio de IA.

## Começar a trabalhar no código

Leia [CONTRIBUTING.md](CONTRIBUTING.md) para preparar o ambiente e [o mapa da arquitetura](docs/architecture.md) para localizar cada funcionalidade. Para incluir ferramentas, siga [o roteiro de novas atividades](docs/adding-activities.md).

```bash
npm ci --prefix ai-service
npm run verify
```

O comando verifica sintaxe, referências, traduções, configuração pública e testes de frontend/API sem consumir IA. Os testes de isolamento Firebase são uma etapa separada e exigem Java 21; veja o guia de contribuição.

## Configuracao local

1. Configure o Firebase seguindo `docs/firebase-setup.md`.
2. Configure o servico de IA copiando `ai-service/.env.example` para `ai-service/.env`.
3. Nunca commite arquivos `.env` ou configuracoes locais com chaves reais.

## Documentacao

- Firebase e regras de seguranca: `docs/firebase-setup.md`
- Deploy Firebase sem config no GitHub: `docs/deploy-firebase-config.md`
- Build e validacao estatica: `docs/build-and-validation.md`
- Servico de IA e creditos: `docs/ia-materials-setup.md`
- Organizacao gradual do CSS: `docs/css-architecture.md`
- Internacionalizacao: `docs/i18n.md`
- Regressao de i18n: `docs/i18n-regression.md`
- Checkout e plano Pro: `docs/billing-checkout.md`
- Checklists de regressao: `docs/regressao-filtros-fluxos.md`

## Plano Pro

A pagina de configuracoes mostra o link de pagamento quando `window.EDUCARIA_BILLING_CHECKOUT_URL` ou `localStorage["educaria:billing:checkout-url"]` estiver definido. A confirmacao do pagamento ainda deve ser feita por backend/webhook antes de alterar `plan` para `pro`.

## Validacao rapida

```bash
npm run verify
```

Com o Google Chrome instalado, valide tambem as telas publicas e o shell autenticado em viewport movel real:

```bash
node tools/check-responsive-layout.mjs
```

Defina `CHROME_PATH` quando o executavel nao estiver no caminho padrao do Windows.
