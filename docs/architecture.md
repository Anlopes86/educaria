# Mapa do código

O EducarIA tem frontend estático, uma API Node/Express e dados protegidos por Firebase. Não há bundler nem framework de componentes no frontend. A organização abaixo descreve o que existe, sem pressupor uma migração de tecnologia.

## Camadas

| Local | Responsabilidade |
| --- | --- |
| HTML na raiz | Landing page, acesso e páginas legais |
| `plataforma/` | Painel autenticado, turmas, biblioteca, editores e apresentações |
| `assets/js/` | Comportamento das páginas e contratos compartilhados do navegador |
| `assets/css/` | Tokens, componentes, layouts e estilos por página |
| `ai-service/` | Autenticação da API, geração, cotas, administração e exclusão de conta |
| `firebase/` | Regras de Firestore/Storage e testes de isolamento |
| `tools/` | Validações, testes do frontend e construção do artefato público |
| `docs/` | Guias operacionais, decisões e checklists |

## Por onde começar no frontend

| Alteração | Arquivos principais em `assets/js/` |
| --- | --- |
| Painel e criador principal | `teacher-dashboard.js`, `dashboard-creation.js` |
| Menu lateral | `app-sidebar.js` |
| Turmas e filtros | `classes-overview.js`, `class-detail.js`, `turma-context.js` |
| Biblioteca, destinos e sincronização de materiais | `lesson-library.js`, `library-bulk-actions.js` |
| Pedido à IA e aplicação do resultado no editor | `ai-material-generator.js`, `generation-recovery.js` |
| Opções e ações comuns dos editores | `editor-disclosure.js`, `builder-actions.js`, `builder-journey.js` |
| Aula completa | `lesson-sequence-builder.js`, `lesson-sequence-player.js` |
| Apresentação compartilhada | `presentation-mode.js`, `presentation-runtime.js`, `presentation-inline-edit.js` |
| Sessão e persistência local | `firebase-config.js`, `auth-flow.js`, `storage-scope.js`, `local-persistence.js` |
| Administração e consumo | `admin-access.js`, `admin-dashboard.js`, `admin-usage.js` |

As atividades seguem principalmente os pares `*-builder.js` e `*-runtime.js`. Quiz e flashcards usam `*-generator.js` no editor. Slides compartilham `presentation-runtime.js`, controles de tema, ilustrações e imagens. Confirme os scripts efetivamente carregados no HTML da tela antes de alterar.

Fluxo principal: painel/editor → `ai-material-generator.js` → API `/api/ai/generate` → resultado no editor → `lesson-library.js`/Firebase → apresentação. A aula completa compõe materiais já criados. Arquivos do professor são processados no backend; upload de imagem própria tem seu fluxo no frontend.

Os scripts clássicos compartilham funções globais. Renomear uma função ou mudar a ordem de carregamento pode afetar outras páginas. A camada de persistência também atende materiais antigos: não renomeie chaves de armazenamento para “padronizar” sem migração.

### Rascunhos e organização de materiais

`Rascunhos` é um filtro da biblioteca pessoal (`scope: library`, `status: draft`), não outra coleção. `builder-journey.js` cobre os onze editores; a Aula completa salva pelo seu próprio builder. Sem destino explícito, novas criações vão para a biblioteca. Salvamentos são locais primeiro e sincronizam pelo protocolo existente; falhas de armazenamento não devem ser apresentadas como sucesso.

`generation-recovery.js` arquiva o resultado do criador do painel antes de abrir o editor. Até a primeira abertura, `draft` contém `{pendingAiResult: ...}`. Os links da biblioteca encaminham pelo editor, que converte o resultado sem nova chamada à IA. Cópias usam `quickLesson` para distinguir registros originados da mesma geração. A Aula completa mostra “Revisar no editor” para esses resultados, em vez de inserir conteúdo vazio. O cache legado de gerações pendentes é migrado por conta.

`autoFiled` identifica apenas materiais guardados automaticamente: ao escolher uma turma no salvamento explícito, o registro é promovido para ela sem deixar um rascunho duplicado. Materiais organizados explicitamente preservam a semântica anterior de cópia para novos destinos.

`library-bulk-actions.js` mantém seleção somente dos cartões visíveis e a limpa quando muda a conta/origem. `organizeLessons` valida todos os IDs e o destino antes da gravação local única. Mover preserva o ID; copiar cria IDs independentes e reinicia revisão/histórico de uso; excluir registra tombstones antes de remover e exige confirmação na interface. Não substitua esse fluxo por exclusão direta no Firebase: isso permitiria ressuscitar materiais ao sincronizar outro dispositivo.

## Organização do serviço de IA

| Módulo | Responsabilidade |
| --- | --- |
| `server.js` | Inicialização/configuração, middleware e composição das rotas; ainda contém cotas e o fluxo de execução |
| `materials/schemas.js` | Registro explícito dos formatos aceitos (`MATERIAL_TYPES`) e seus contratos JSON |
| `materials/prompts.js` | Instruções enviadas aos provedores de texto e de imagem |
| `materials/generated-json.js` | Leitura e recuperação do JSON retornado pela IA |
| `materials/slides.js` | Normalização de slides, temas, contraste e ilustrações |
| `materials/upload.js` | Filtro de upload, assinatura/formato, extração de texto e modelo da roleta |
| `activity-generation-policy.js` | Opções pedagógicas comuns e ajustes por atividade |
| `slide-generation-policy.js`, `slide-illustration-policy.js` | Regras específicas de slides e desenhos |
| `ai-text-provider.js` | Integração de texto com Groq; a chamada Gemini ainda está no orquestrador |
| `ai-credit-policy.js`, `ai-credit-store.js` | Cálculo, reservas e persistência dos créditos |
| `ai-usage-analytics.js` | Observações de consumo sem armazenar prompts ou materiais |
| `ai-usage-export.js` | Exportação protegida do consumo, com projeção de campos e rótulos de contas locais ao arquivo |
| `firebase-admin-services.js` | Serviços Firebase e validação da sessão ativa |
| `admin-dashboard.js` | Rotas administrativas protegidas pela lista de UIDs do servidor |
| `account-deletion.js` | Exclusão retomável da conta e dos dados associados |

Os módulos de `materials/` não conhecem Express, usuários ou cotas, exceto a fábrica de upload que cria o middleware Multer. Não leem configurações do ambiente nem iniciam chamadas à IA. Mantenha decisões de acesso, reservas e gravações fora das funções de formatação.

Para mudar um formato, confira schema, prompt, política, editor/importação e apresentação. Para mudar créditos, preserve reservas, acerto final e devolução em falhas; não confunda créditos internos, tokens do provedor e estimativa de preço.

Para exportar o relatório administrativo sem identificadores diretos, consulte [ai-usage-export.md](ai-usage-export.md). O botão usa `admin-usage-export.js` e o mesmo ciclo de sessão de `admin-usage.js`; não acrescente dados pessoais ao arquivo nem busque as páginas da tabela em sequência.

Para acrescentar uma ferramenta, siga [como adicionar uma atividade](adding-activities.md). O registro da API tem cobertura obrigatória em teste, mas ainda não substitui os registros e integrações do frontend.

## Ilustrações dos slides

As paletas personalizadas geradas pela IA são normalizadas em `materials/slides.js`: fundos de leitura têm luminância relativa mínima de 0,88, capa/encerramento usam fundo com luminância máxima de 0,09 e o texto mantém contraste mínimo de 7:1. A mistura com branco/preto preserva a tonalidade, sem impor um tema único. Variantes escuras ficam restritas à capa e ao encerramento; subtítulos/parágrafos não são atenuados por opacidade na prévia/apresentação. Esse ajuste é aplicado a novas gerações, não reescreve temas manuais nem rascunhos salvos. `slide-theme.test.mjs` cobre cores extremas, contraste, variantes, importação e limite do prompt.

Novas gerações usam o contrato de ilustração **v2**, independente do assunto: objetivo acessível, título, nós com rótulos/símbolos e conexões explícitas. Há layouts para processos, ciclos, comparações, conceitos, hierarquias e itens independentes. A IA não define coordenadas, cores ou código. `assets/js/slide-diagram-model.js` é um módulo puro compartilhado (CommonJS no backend, script clássico no navegador), que define o schema e valida ids, contagens, ligações e topologia.

No Render, `render.yaml` usa a raiz do repositório (sem `rootDir`) e os comandos `npm ci --prefix ai-service` / `npm start --prefix ai-service`. Isso mantém o contrato compartilhado acessível sem instalar dependências do frontend. Os filtros de build incluem a API, esse contrato e o próprio Blueprint. Não restrinja `rootDir` a `ai-service`: [arquivos fora dessa pasta ficam indisponíveis no build e na execução](https://render.com/docs/monorepo-support). Serviços fora de um Blueprint precisam receber esses mesmos comandos e a remoção de Root Directory no painel.

`slide-illustration-policy.js` orienta a decisão pedagógica; `slide-diagram-renderer.js` calcula posições, quebra de linhas, símbolos e setas sem cortar legendas. `slide-illustrations.js` é a fachada de compatibilidade, prioridade de upload e avisos de falhas parciais. Os formatos anteriores (`elements` e composições por `labels`) continuam aceitos para materiais salvos; não os regenere automaticamente. `includeIllustration: false` sempre prevalece, e a imagem própria mantém prioridade na capa.

A escolha do diagrama segue a relação pedagógica (ordem, ciclo, comparação, classificação ou associação); cartões ficam reservados a itens independentes. O exemplo de campos não fixa um layout pronto. A renderização numera etapas de processos, reserva espaço para as setas, repete cores por lado nas comparações e dispensa ícones idênticos em todos os nós. Não cria nós, fatos ou conexões nem altera o material de origem. O prompt também solicita coerência de nomes/datas/valores entre texto e desenho e evita falsa precisão ou fontes inventadas; isso é orientação ao modelo, **não** consulta a fontes ou verificação factual independente. Imagens SVG já salvas permanecem intactas; os refinamentos entram em novas renderizações.

`needs-image` comunica que o pedido precisa de uma imagem detalhada que não pode ser representada fielmente por diagramas; `invalid` é um estado interno para saídas malformadas. Nesses casos, o texto é preservado e nenhum desenho substituto é inventado. Não há segunda chamada à IA, mudança de provedor, ativação de geração de imagens paga nem nova regra de cobrança. O renderer não comprova fatos: validação estrutural e qualidade visual não substituem revisão pedagógica; a [documentação do Groq](https://console.groq.com/docs/structured-outputs) também distingue conformidade de schema de precisão semântica.

Para ampliar o mecanismo, atualize o contrato compartilhado, as instruções e o renderer. Use `tools/fixtures/slide-diagrams.mjs` e `tools/tests/slide-diagrams.test.mjs` para testar várias disciplinas, topologias inválidas, textos longos, conteúdo malicioso, acessibilidade e persistência. Confira o resultado dentro de um slide real. As fixtures não são respostas de IA: uma avaliação de aderência do modelo exige geração real, respeitando cotas e sem expor credenciais. Preserve os testes de compatibilidade em `slide-illustrations.test.mjs`.

### Edição dos textos internos

Novas ilustrações v2 guardam também um campo oculto `slide-illustration` no cartão do slide, junto do SVG final. `slide-diagram-editing.js` serializa apenas o modelo normalizado, limita o tamanho do envelope e o associa à imagem por uma assinatura compacta (proteção contra imagem substituída, não autenticação). Sem estrutura válida, imagens legadas ou enviadas pelo professor não são reinterpretadas. Não faça parsing de SVG nem tente inferir relações a partir de pixels.

`slide-diagram-editor.js` oferece o mesmo diálogo acessível nos Slides e nos blocos da Aula completa. Altera somente título, legenda, descrição acessível, rótulos e detalhes; mantém layout, IDs, ícones e conexões. A prévia usa o renderer local: texto inválido ou que não cabe bloqueia a aplicação sem alterar o original. Cancelar/Escape descarta a cópia temporária, e a troca de conta fecha o diálogo. Aplicar atualiza imagem e estrutura juntas pelo salvamento existente; edição na Aula completa vale apenas para aquele bloco. Não há requisição à IA nem consumo de créditos. Upload, remoção e substituição não podem reutilizar metadados de uma imagem anterior. A apresentação preserva o campo ao editar os textos normais do slide. Testes: `tools/tests/slide-diagram-editing.test.mjs` e conferência visual de salvar/reabrir, cancelar, teclado e celular.

### Falhas de geração e ilustrações opcionais

`schemaFor("slides", slideOptions)` remove o campo `illustration` do contrato enviado ao provedor quando a opção está desativada. Isso evita que slides sem desenhos falhem por campos de uma ilustração vazia. O contrato completo continua disponível para o modo com ilustração e para compatibilidade.

O Groq pode rejeitar uma resposta com `json_validate_failed` e fornecer o JSON completo em `error.failed_generation`. `materials/slide-response-recovery.js` recupera somente Slides: exige JSON completo e limitado, conteúdo não vazio e conformidade dos demais campos com o contrato estrito. Não completa JSON truncado, texto de aula, nós ou conexões. Metadados auxiliares ausentes do desenho usam o título e os rótulos já existentes; toda geometria semântica continua passando pelo validador compartilhado. Um desenho irrecuperável vira `invalid`, preservando o texto e acionando o aviso existente no editor/painel. Nenhum código gerado é executado, e a recuperação não faz outra chamada à IA.

Se o provedor informar consumo, ele é contabilizado uma vez. Quando uma resposta recuperada não contém essa medição, `charge.basis` é `unavailable`, `usage` e `measuredCost` são `null` e os créditos individuais reservados são devolvidos. A cota global mantém a estimativa conservadora da reserva; o relatório registra medição desconhecida, não zero tokens. Respostas truncadas ou inválidas sem recuperação segura retornam `ai_response_incomplete` (HTTP 502), sem substituir o material anterior.

Regressões: `ai-service/tests/slide-response-recovery.test.mjs` cobre ambos os modos, os campos ausentes relatados em produção, validação restrita e preservação de uso; `ai-usage-routes.test.mjs` cobre devolução de créditos, cota global e mensagens de erro. Uma alteração no prompt deve continuar cabendo no limite padrão de entrada, sem enfraquecer os limites globais.

## Testes e ferramentas

### Atividades de descoberta: trilha e conexões

`wordtrail` (Trilha de Palavras) e `connections` (O que há em comum?) compartilham `discovery-core.js`, um módulo puro usado no navegador e na API. Ele valida o conteúdo, serializa campos escapados no formato de rascunho existente e monta tabuleiros determinísticos. A IA fornece termos/pistas, nunca HTML nem coordenadas. A trilha usa caminhos ortogonais sem sobreposição e divide listas grandes ou pistas extensas em tabuleiros menores, sem perder palavras.

`materials/discovery.js` reúne schemas, prompts e preservação das listas fornecidas pelo professor. `inputMode` distingue tópico de lista; no modo lista a quantidade genérica é desconsiderada. Na trilha, os termos mantêm a grafia original. Em conexões, cada item da lista é uma **resposta**: a IA cria um desafio por resposta, preservando ordem e grafia. `clueCount` (2–8) e `difficulty` (easy/medium/hard) orientam a geração; a quantidade de pistas também é validada no retorno. Listas inválidas são recusadas antes da reserva de créditos. Os formatos usam a rota, a autenticação e as métricas comuns.

Na trilha, `includeClues` é a opção da geração; `showClues` no material e `discovery-show-clues` nos controles do rascunho preservam a preferência de apresentação. Ausência desse campo em materiais antigos significa mostrar pistas. Ocultar pistas manualmente não apaga os textos. `discovery-pointer-input.js` captura o gesto no contêiner estável, preserva cliques/teclado e evita cliques duplicados após arrastar; `advancePath` valida vizinhança e permite recuar uma letra durante o arraste. O progresso da Aula completa inclui a visibilidade das pistas.

`discovery-builder.js` e `discovery-runtime.js` atendem as páginas `trilha-palavras-*` e `em-comum-*`, com estilo compartilhado em `components/discovery.css`. `discovery-view.js` é um módulo puro de apresentação, carregado depois do core: produz o tabuleiro, os caminhos SVG e os cartões sem controlar eventos nem alterar o material. Somente caminhos já encontrados, revelados ou selecionados entram no SVG; palavras ainda não descobertas aparecem como espaços vazios, sem texto de resposta oculto. As setas indicam a direção do caminho e os números relacionam as palavras ao banco lateral.

Em conexões, as pistas usam toda a largura disponível. Até cinco pistas formam uma coluna; de seis a oito usam duas, com paginação calculada pela área útil real quando a altura é limitada. A resposta ocupa uma faixa separada apenas após a revelação; a explicação é inserida com `textContent` em um diálogo nativo, aberto por “Por quê?” e esvaziado ao fechar. Em celular, as pistas ficam empilhadas e a página permite rolagem vertical. O runtime mede novamente a área após mudar a revelação ou as dimensões, inclusive dentro da Aula completa.

Os rascunhos são isolados por conta, os destinos/bulk actions usam a biblioteca existente e a Aula completa usa o mesmo player, com captura/restauração do progresso. Na impressão, somente o desafio e o estado de revelação atuais são impressos; não há um gabarito oculto adicionado ao PDF. A edição não consome IA. Testes: `tools/tests/discovery.test.mjs`, `tools/tests/discovery-view.test.mjs` e `ai-service/tests/ai-usage-routes.test.mjs`.

Em conexões, a apresentação organiza mais de cinco pistas em duas colunas. `cluePageSize` considera o espaço disponível e o tamanho dos textos: telas baixas, inclusive dentro da Aula completa, dividem as pistas em páginas. Revelar uma pista abre automaticamente sua página; navegar entre páginas não revela pistas adicionais. A página atual é preservada no progresso, e a impressão reúne todas as pistas do desafio com o mesmo estado de revelação.

- `ai-service/tests/`: contratos e integração da API, segurança, provedores, créditos e consumo.
- `tools/tests/`: comportamento do frontend, fluxos de materiais, design e artefato público.
- `firebase/tests/`: isolamento entre contas e exclusão, usando emuladores.
- `tools/project-files.mjs`: inventário compartilhado para validadores; ignora saídas locais/privadas e dependências instaladas.
- `tools/verify.mjs`: entrada única para verificações estáticas e testes sem IA real.
- `tools/build-pages.mjs`: política independente de publicação, restrita a arquivos públicos versionados. Não substitua pela lista dos validadores.

## Compatibilidade e próximos cortes

Nesta etapa foram extraídas as regras de materiais do servidor, removidos um helper sem chamadas (`splitIntoShortUnits`), uma configuração calculada mas nunca lida (`legacyAiDailyCreditLimitFree`) e um wrapper redundante de normalização. Os testes de prompts passaram a importar os módulos reais. Nenhuma rota pública, formato salvo, chave de persistência, tela ou regra de cobrança foi removida.

Ainda há arquivos grandes: `lesson-library.js`, `lesson-sequence-builder.js`, `ai-material-generator.js` e o próprio `server.js`. As próximas extrações devem separar persistência/renderização da biblioteca, editores por tipo da aula completa e serviços de cotas/execução da API, cada uma com testes de caracterização. Não misture essa migração com mudanças visuais ou de cobrança.

Páginas antigas e imagens sem referência estática evidente foram preservadas: podem ter links externos ou servir de material de apoio. Recursos condicionais (imagens por IA, checkout/webhook) não são código morto só porque estão desativados no ambiente atual.

Esta organização facilita colaboração, mas não torna a infraestrutura automaticamente distribuída. Limitadores em memória e o armazenamento local do checkout precisam de revisão antes de múltiplas instâncias/assinaturas reais. A arquitetura CSS e a ordem dos scripts também exigem migração gradual, não uma reorganização automática por nome de arquivo.
