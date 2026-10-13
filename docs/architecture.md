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
| Biblioteca, destinos e sincronização de materiais | `lesson-library.js` |
| Pedido à IA e aplicação do resultado no editor | `ai-material-generator.js`, `generation-recovery.js` |
| Opções e ações comuns dos editores | `editor-disclosure.js`, `builder-actions.js`, `builder-journey.js` |
| Aula completa | `lesson-sequence-builder.js`, `lesson-sequence-player.js` |
| Apresentação compartilhada | `presentation-mode.js`, `presentation-runtime.js`, `presentation-inline-edit.js` |
| Sessão e persistência local | `firebase-config.js`, `auth-flow.js`, `storage-scope.js`, `local-persistence.js` |
| Administração e consumo | `admin-access.js`, `admin-dashboard.js`, `admin-usage.js` |

As atividades seguem principalmente os pares `*-builder.js` e `*-runtime.js`. Quiz e flashcards usam `*-generator.js` no editor. Slides compartilham `presentation-runtime.js`, controles de tema, ilustrações e imagens. Confirme os scripts efetivamente carregados no HTML da tela antes de alterar.

Fluxo principal: painel/editor → `ai-material-generator.js` → API `/api/ai/generate` → resultado no editor → `lesson-library.js`/Firebase → apresentação. A aula completa compõe materiais já criados. Arquivos do professor são processados no backend; upload de imagem própria tem seu fluxo no frontend.

Os scripts clássicos compartilham funções globais. Renomear uma função ou mudar a ordem de carregamento pode afetar outras páginas. A camada de persistência também atende materiais antigos: não renomeie chaves de armazenamento para “padronizar” sem migração.

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
| `firebase-admin-services.js` | Serviços Firebase e validação da sessão ativa |
| `admin-dashboard.js` | Rotas administrativas protegidas pela lista de UIDs do servidor |
| `account-deletion.js` | Exclusão retomável da conta e dos dados associados |

Os módulos de `materials/` não conhecem Express, usuários ou cotas, exceto a fábrica de upload que cria o middleware Multer. Não leem configurações do ambiente nem iniciam chamadas à IA. Mantenha decisões de acesso, reservas e gravações fora das funções de formatação.

Para mudar um formato, confira schema, prompt, política, editor/importação e apresentação. Para mudar créditos, preserve reservas, acerto final e devolução em falhas; não confunda créditos internos, tokens do provedor e estimativa de preço.

Para acrescentar uma ferramenta, siga [como adicionar uma atividade](adding-activities.md). O registro da API tem cobertura obrigatória em teste, mas ainda não substitui os registros e integrações do frontend.

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
