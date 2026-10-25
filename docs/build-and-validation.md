# Build e validacao

O projeto continua estatico e nao exige bundler para rodar localmente. A etapa atual adiciona uma barreira de validacao sem dependencias externas para reduzir regressao em paginas, assets e scripts.

## Comandos locais

Execute antes de abrir PR ou publicar alteracoes:

```bash
npm run verify
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

O comando também pode ser chamado com `node tools/verify.mjs`, a mesma entrada usada na integração contínua. Para executar só as verificações estáticas, use `npm run check`; para testes sem emuladores, `npm test`. Os testes de isolamento Firebase continuam separados (`npm run test:security`, com Java 21). Veja [CONTRIBUTING.md](../CONTRIBUTING.md).

Para conferir ajustes por item com IA (seleção múltipla, aprovação parcial, prévia, desfazer, falhas, edição concorrente, troca de conta e restauração):

```bash
node tools/check-responsive-layout.mjs 'auth:plataforma/mapa-mental-builder.html?new=1' 'auth:plataforma/debate-guiado-builder.html?new=1'
```

Para os demais editores, defina `EDUCARIA_AUDIT_REFINEMENTS=1` e passe suas páginas com prefixo `auth:`. Isso inclui `slides-builder.html`, `quiz-builder.html`, `folha-atividades-builder.html` e `criar-aula.html`. O teste do quiz seleciona questões 3, 5 e 8 em formatos diferentes; o de slides seleciona o terceiro slide e confere preservação dos campos de imagem/cor. A folha percorre os quatro tipos e a aula testa isolamento entre blocos.

Essa jornada intercepta a resposta da IA com dados fictícios, sem gastar créditos. Execute em 1366 × 768 e 390 × 844 usando `EDUCARIA_AUDIT_WIDTH` e `EDUCARIA_AUDIT_HEIGHT`. `EDUCARIA_AUDIT_SCREENSHOT_DIR` guarda também a prévia do ajuste. As respostas simuladas verificam o fluxo e o isolamento dos campos; qualidade pedagógica deve ser conferida separadamente com pedidos reais.

Para conferir as ajudas contextuais, defina `EDUCARIA_AUDIT_HELP=1` e execute as páginas `auth:plataforma/slides-builder.html?new=1`, `auth:plataforma/index.html` e `auth:plataforma/folha-atividades-builder.html?new=1`. Use `EDUCARIA_AUDIT_DISABLE_DASHBOARD_TOUR=1` para a ajuda não competir com o guia de primeiro acesso. A jornada verifica mouse, teclado, clique, Escape, posicionamento, atualização das explicações e preservação dos valores/avisos. Repita em 1366 × 768 e 390 × 844; a geração usa dados locais, sem consumir IA.

## O que cada check cobre

Para validar a geração de ilustração de um slide existente, defina `EDUCARIA_AUDIT_SLIDE_ILLUSTRATION=1` e execute `node tools/check-responsive-layout.mjs 'auth:plataforma/slides-builder.html?new=1'`. A jornada simula apenas o retorno do provedor: confere contexto enviado, prévia, aplicação isolada, edição posterior, cancelamento, falhas, respostas atrasadas e recarga do rascunho. Rode em 1366 × 768 e 390 × 844; `EDUCARIA_AUDIT_SCREENSHOT_DIR` salva o diálogo para revisão visual. Nenhum crédito real é consumido.

- `tools/check-i18n.mjs`: verifica se as chaves usadas em HTML/JS existem em `pt-BR`, `en-US` e `es-ES`.
- `tools/check-assets.mjs`: percorre HTML e CSS e falha quando encontra referencia local para arquivo inexistente.
- `tools/check-firebase-config.mjs`: confirma que um dispositivo novo recebe a configuração de produção sem depender de arquivo local ou dados salvos no navegador.
- `tools/check-js-syntax.mjs`: valida sintaxe dos scripts browser/CommonJS e dos módulos ESM de backend, ferramentas e testes sem executar a aplicação. O inventário compartilhado em `tools/project-files.mjs` exclui dependências instaladas, arquivos locais e saídas privadas.
- `npm test`: executa as suítes de `ai-service/tests/` e `tools/tests/`, sem chamadas reais à IA.
- `node --check ai-service/server.js`: valida sintaxe do backend ESM de IA.
- `node --check service-worker.js`: valida a sintaxe da camada de cache offline.
- `npm test --prefix ai-service`: inicia o backend em ambiente isolado e verifica health check, autenticacao obrigatoria, protecao da geracao, CORS e bloqueio de configuracao insegura.
- `tools/check-responsive-layout.mjs`: abre telas publicas e internas com emulacao de viewport movel pelo protocolo do Chrome, aguarda o carregamento real da pagina, falha quando o documento fica mais largo que a tela, verifica a abertura do menu lateral compacto, exige a acao de impressao/PDF nas apresentacoes e testa metadados, autosave e recuperacao nos builders chamados com o prefixo `auth:`.

## Confiabilidade em sala

O `service-worker.js` usa rede primeiro para paginas HTML e cache com atualizacao em segundo plano para arquivos estaticos do proprio projeto. API, Firebase Auth, configuracao Firebase, requisicoes com `Authorization`, dominios externos e qualquer metodo diferente de `GET` ficam fora do cache. Assim, materiais ja visitados podem continuar abrindo durante uma oscilacao de rede sem reutilizar respostas autenticadas ou operacoes de IA.

O navegador mostra um aviso acessivel quando perde a conexao e confirma quando a internet retorna. O modo apresentacao oferece `Imprimir / PDF`; a folha de impressao remove navegacao e controles, preserva cores e usa orientacao paisagem.

## Deploy Pages

O workflow `.github/workflows/deploy-pages.yml` roda as validações e publica o artefato no GitHub Pages. A configuração Web pública do Firebase já acompanha o frontend; dados e operações continuam protegidos por Firebase Auth e pelas regras de Firestore/Storage.

## Proxima evolucao

Quando o projeto migrar para Vite, Parcel ou outro bundler, mantenha estes checks como camada rapida de regressao e adicione:

- bundle CSS por pagina a partir dos modulos em `assets/css/`;
- manifest de scripts por pagina para lazy loading dos editores;
- otimizacao de imagens no pipeline;
- relatorio de tamanho de bundle para evitar crescimento silencioso.
