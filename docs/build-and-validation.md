# Build e validacao

O projeto continua estatico e nao exige bundler para rodar localmente. A etapa atual adiciona uma barreira de validacao sem dependencias externas para reduzir regressao em paginas, assets e scripts.

## Comandos locais

Execute antes de abrir PR ou publicar alteracoes:

```bash
node tools/check-i18n.mjs
node tools/check-assets.mjs
node tools/check-js-syntax.mjs
node --check ai-service/server.js
node --check service-worker.js
npm test --prefix ai-service
```

Para verificar overflow horizontal em 390 px nas telas publicas, com o Google Chrome instalado:

```bash
node tools/check-responsive-layout.mjs
```

Para auditar todas as ferramentas no modo apresentacao e confirmar tambem a presenca da acao de impressao/PDF:

```bash
node tools/check-responsive-layout.mjs plataforma/apresentacao.html plataforma/quiz-aplicacao.html plataforma/flashcards-apresentacao.html plataforma/jogo-memoria-apresentacao.html plataforma/roleta-apresentacao.html plataforma/ligar-pontos-apresentacao.html plataforma/mapa-mental-apresentacao.html plataforma/debate-guiado-apresentacao.html plataforma/caca-palavras-apresentacao.html plataforma/palavras-cruzadas-apresentacao.html plataforma/forca-apresentacao.html
```

Para validar as jornadas autenticadas de Quiz, Slides, Flashcards, Jogo da Memoria, Forca, Roleta e Ligar Pontos, incluindo criacao nova, metadados pedagogicos, autosave e recuperacao depois de recarregar a pagina:

```bash
node tools/check-responsive-layout.mjs 'auth:plataforma/quiz-builder.html?new=1' 'auth:plataforma/slides-builder.html?new=1' 'auth:plataforma/flashcards-builder.html?new=1' 'auth:plataforma/jogo-memoria-builder.html?new=1' 'auth:plataforma/forca-builder.html?new=1' 'auth:plataforma/roleta-builder.html?new=1' 'auth:plataforma/ligar-pontos-builder.html?new=1'
```

## O que cada check cobre

- `tools/check-i18n.mjs`: verifica se as chaves usadas em HTML/JS existem em `pt-BR`, `en-US` e `es-ES`.
- `tools/check-assets.mjs`: percorre HTML e CSS e falha quando encontra referencia local para arquivo inexistente.
- `tools/check-js-syntax.mjs`: valida sintaxe dos scripts browser/CommonJS do front sem executar a aplicacao.
- `node --check ai-service/server.js`: valida sintaxe do backend ESM de IA.
- `node --check service-worker.js`: valida a sintaxe da camada de cache offline.
- `npm test --prefix ai-service`: inicia o backend em ambiente isolado e verifica health check, autenticacao obrigatoria, protecao da geracao, CORS e bloqueio de configuracao insegura.
- `tools/check-responsive-layout.mjs`: abre telas publicas e internas com emulacao de viewport movel pelo protocolo do Chrome, aguarda o carregamento real da pagina, falha quando o documento fica mais largo que a tela, verifica a abertura do menu lateral compacto, exige a acao de impressao/PDF nas apresentacoes e testa metadados, autosave e recuperacao nos builders chamados com o prefixo `auth:`.

## Confiabilidade em sala

O `service-worker.js` usa rede primeiro para paginas HTML e cache com atualizacao em segundo plano para arquivos estaticos do proprio projeto. API, Firebase Auth, configuracao Firebase, requisicoes com `Authorization`, dominios externos e qualquer metodo diferente de `GET` ficam fora do cache. Assim, materiais ja visitados podem continuar abrindo durante uma oscilacao de rede sem reutilizar respostas autenticadas ou operacoes de IA.

O navegador mostra um aviso acessivel quando perde a conexao e confirma quando a internet retorna. O modo apresentacao oferece `Imprimir / PDF`; a folha de impressao remove navegacao e controles, preserva cores e usa orientacao paisagem.

## Deploy Pages

O workflow `.github/workflows/deploy-pages.yml` injeta `assets/js/firebase-config.local.js` a partir de `EDUCARIA_FIREBASE_CONFIG_JSON` e roda as validacoes antes de publicar o artifact no GitHub Pages.

## Proxima evolucao

Quando o projeto migrar para Vite, Parcel ou outro bundler, mantenha estes checks como camada rapida de regressao e adicione:

- bundle CSS por pagina a partir dos modulos em `assets/css/`;
- manifest de scripts por pagina para lazy loading dos editores;
- otimizacao de imagens no pipeline;
- relatorio de tamanho de bundle para evitar crescimento silencioso.
