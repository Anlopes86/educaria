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

Novas gerações usam o contrato de ilustração **v2**, independente do assunto: objetivo acessível, título, nós com rótulos/símbolos e conexões explícitas. Há layouts para processos, ciclos, comparações, conceitos, hierarquias e itens independentes. A IA não define coordenadas, cores ou código. `assets/js/slide-diagram-model.js` é um módulo puro compartilhado (CommonJS no backend, script clássico no navegador), que define o schema e valida ids, contagens, ligações e topologia.

No Render, `render.yaml` usa a raiz do repositório (sem `rootDir`) e os comandos `npm ci --prefix ai-service` / `npm start --prefix ai-service`. Isso mantém o contrato compartilhado acessível sem instalar dependências do frontend. Os filtros de build incluem a API, esse contrato e o próprio Blueprint. Não restrinja `rootDir` a `ai-service`: [arquivos fora dessa pasta ficam indisponíveis no build e na execução](https://render.com/docs/monorepo-support). Serviços fora de um Blueprint precisam receber esses mesmos comandos e a remoção de Root Directory no painel.

`slide-illustration-policy.js` orienta a decisão pedagógica; `slide-diagram-renderer.js` calcula posições, quebra de linhas, símbolos e setas sem cortar legendas. `slide-illustrations.js` é a fachada de compatibilidade, prioridade de upload e avisos de falhas parciais. Os formatos anteriores (`elements` e composições por `labels`) continuam aceitos para materiais salvos; não os regenere automaticamente. `includeIllustration: false` sempre prevalece, e a imagem própria mantém prioridade na capa.

`needs-image` comunica que o pedido precisa de uma imagem detalhada que não pode ser representada fielmente por diagramas; `invalid` é um estado interno para saídas malformadas. Nesses casos, o texto é preservado e nenhum desenho substituto é inventado. Não há segunda chamada à IA, mudança de provedor, ativação de geração de imagens paga nem nova regra de cobrança. O renderer não comprova fatos: validação estrutural e qualidade visual não substituem revisão pedagógica; a [documentação do Groq](https://console.groq.com/docs/structured-outputs) também distingue conformidade de schema de precisão semântica.

Para ampliar o mecanismo, atualize o contrato compartilhado, as instruções e o renderer. Use `tools/fixtures/slide-diagrams.mjs` e `tools/tests/slide-diagrams.test.mjs` para testar várias disciplinas, topologias inválidas, textos longos, conteúdo malicioso, acessibilidade e persistência. Confira o resultado dentro de um slide real. As fixtures não são respostas de IA: uma avaliação de aderência do modelo exige geração real, respeitando cotas e sem expor credenciais. Preserve os testes de compatibilidade em `slide-illustrations.test.mjs`.

### Falhas de geração e ilustrações opcionais

`schemaFor("slides", slideOptions)` remove o campo `illustration` do contrato enviado ao provedor quando a opção está desativada. Isso evita que slides sem desenhos falhem por campos de uma ilustração vazia. O contrato completo continua disponível para o modo com ilustração e para compatibilidade.

O Groq pode rejeitar uma resposta com `json_validate_failed` e fornecer o JSON completo em `error.failed_generation`. `materials/slide-response-recovery.js` recupera somente Slides: exige JSON completo e limitado, conteúdo não vazio e conformidade dos demais campos com o contrato estrito. Não completa JSON truncado, texto de aula, nós ou conexões. Metadados auxiliares ausentes do desenho usam o título e os rótulos já existentes; toda geometria semântica continua passando pelo validador compartilhado. Um desenho irrecuperável vira `invalid`, preservando o texto e acionando o aviso existente no editor/painel. Nenhum código gerado é executado, e a recuperação não faz outra chamada à IA.

Se o provedor informar consumo, ele é contabilizado uma vez. Quando uma resposta recuperada não contém essa medição, `charge.basis` é `unavailable`, `usage` e `measuredCost` são `null` e os créditos individuais reservados são devolvidos. A cota global mantém a estimativa conservadora da reserva; o relatório registra medição desconhecida, não zero tokens. Respostas truncadas ou inválidas sem recuperação segura retornam `ai_response_incomplete` (HTTP 502), sem substituir o material anterior.

Regressões: `ai-service/tests/slide-response-recovery.test.mjs` cobre ambos os modos, os campos ausentes relatados em produção, validação restrita e preservação de uso; `ai-usage-routes.test.mjs` cobre devolução de créditos, cota global e mensagens de erro. Uma alteração no prompt deve continuar cabendo no limite padrão de entrada, sem enfraquecer os limites globais.

## Testes e ferramentas

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
