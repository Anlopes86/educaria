# Build e validacao

O projeto continua estatico e nao exige bundler para rodar localmente. A etapa atual adiciona uma barreira de validacao sem dependencias externas para reduzir regressao em paginas, assets e scripts.

## Comandos locais

Execute antes de abrir PR ou publicar alteracoes:

```bash
node tools/check-i18n.mjs
node tools/check-assets.mjs
node tools/check-js-syntax.mjs
node --check ai-service/server.js
```

## O que cada check cobre

- `tools/check-i18n.mjs`: verifica se as chaves usadas em HTML/JS existem em `pt-BR`, `en-US` e `es-ES`.
- `tools/check-assets.mjs`: percorre HTML e CSS e falha quando encontra referencia local para arquivo inexistente.
- `tools/check-js-syntax.mjs`: valida sintaxe dos scripts browser/CommonJS do front sem executar a aplicacao.
- `node --check ai-service/server.js`: valida sintaxe do backend ESM de IA.

## Deploy Pages

O workflow `.github/workflows/deploy-pages.yml` injeta `assets/js/firebase-config.local.js` a partir de `EDUCARIA_FIREBASE_CONFIG_JSON` e roda as validacoes antes de publicar o artifact no GitHub Pages.

## Proxima evolucao

Quando o projeto migrar para Vite, Parcel ou outro bundler, mantenha estes checks como camada rapida de regressao e adicione:

- bundle CSS por pagina a partir dos modulos em `assets/css/`;
- manifest de scripts por pagina para lazy loading dos editores;
- otimizacao de imagens no pipeline;
- relatorio de tamanho de bundle para evitar crescimento silencioso.
