# Como adicionar uma atividade

Este é o roteiro para incluir novas ferramentas sem quebrar materiais já salvos. O cadastro de formatos aceitos pela API fica em `ai-service/materials/schemas.js` (`MATERIAL_TYPES` e `schemaFor`). Ele não registra automaticamente uma tela no navegador: frontend, persistência e apresentação precisam conhecer o mesmo identificador.

## 1. Definir o contrato antes da interface

Escolha um identificador estável (por exemplo, `timeline`) e descreva o JSON mínimo, as opções pedagógicas e o que o professor poderá editar. Use dados estruturados; não aceite HTML ou JavaScript gerados pela IA como interface executável. Comece com um material de exemplo sintético que possa ser criado sem IA.

Não reutilize o identificador de uma atividade antiga com outro significado. Não renomeie campos persistidos sem compatibilidade de leitura. A primeira versão deve abrir dados incompletos com segurança e informar quando um conteúdo não puder ser exibido.

## 2. Backend: formato e geração

1. Inclua o schema em `materials/schemas.js` e registre seu identificador no mapa `materialSchemas`. `MATERIAL_TYPES` deriva desse registro; não mantenha uma segunda lista manual de tipos aceitos.
2. Acrescente as instruções específicas em `materials/prompts.js`. Preserve o pedido e o conteúdo original do professor. Se o formato exigir lógica extensa, coloque-a em um módulo próprio dentro de `materials/` e importe-a explicitamente.
3. Acrescente opções e ajustes necessários em `activity-generation-policy.js`, com validação antes de reservar créditos. Use as políticas de slides apenas se a ferramenta realmente for slides.
4. Confira rótulos/quantidade gerada no relatório de `ai-usage-analytics.js` e as estimativas/reservas em `ai-credit-policy.js`, caso o formato precise de algo específico.
5. Amplie `ai-service/tests/materials.test.mjs`: o teste exige cobertura explícita de cada tipo registrado. Inclua schema, preservação do pedido, opções válidas/inválidas e material normalizado.

Use a rota de geração e os controles existentes. Não crie uma chamada direta do navegador ao provedor nem copie o mecanismo de créditos/autenticação para outra rota. Só abrir o schema para um formato não torna a ferramenta pronta para publicação.

## 3. Frontend: criar, editar e apresentar

- Crie a página de edição e seu script em `plataforma/` e `assets/js/`. Adote `*-builder.js` para ferramentas novas; as exceções antigas continuam compatíveis.
- Crie a apresentação e `*-runtime.js`, usando o shell/controles compartilhados. Reutilize tokens, cores e componentes antes de criar estilos próprios.
- Registre as opções de criação no painel (`dashboard-creation.js`), a interpretação do resultado da IA (`ai-material-generator.js`) e os atalhos necessários (`class-format-picker.js`, `builder-actions.js` e contextos do material).
- Confira `lesson-library.js`: tipo, rascunho, salvamento, destino em turmas, duplicação, abrir editor e abrir apresentação. Os identificadores ficam associados à conta por `storage-scope.js`.
- Integre a aula completa em `lesson-sequence-builder.js` e `lesson-sequence-player.js`, incluindo edição do bloco, ordem e apresentação. Se não houver suporte, apresente a limitação claramente; não deixe um bloco vazio.
- Confira ícones, rótulos, traduções e ilustrações em `activity-visuals.js`, `collection-visuals.js` e `assets/i18n/`. Carregue os scripts na ordem usada pelos editores atuais.

As integrações do frontend ainda estão distribuídas entre esses módulos. Procure também ocorrências de um tipo semelhante antes de concluir o registro. Uma futura centralização em um catálogo compartilhado deverá preservar URLs, dados e ordem de carregamento, com testes; não adicione mais uma lista paralela de ferramentas como atalho.

## 4. Critérios para considerar a ferramenta pronta

- [ ] Funciona com material de exemplo, sem depender de uma resposta real da IA.
- [ ] Pedido, arquivo, quantidade e opções do professor chegam à geração.
- [ ] A resposta pode ser editada, salva e recuperada após recarregar.
- [ ] É possível salvar na biblioteca e nas turmas escolhidas.
- [ ] A troca de conta não expõe rascunhos ou materiais de outra pessoa.
- [ ] A apresentação funciona com topo aberto/fechado, notebook pequeno e celular.
- [ ] Teclado, foco, retorno à biblioteca e impressão/PDF estão tratados.
- [ ] Funciona dentro da aula completa, ou o limite de suporte é explícito.
- [ ] Erros, resposta vazia e falha de rede não causam perda silenciosa do material.
- [ ] Créditos/consumo usam o fluxo existente e não registram o conteúdo do professor em logs.
- [ ] `npm run verify` e os testes de segurança aplicáveis passam.
- [ ] Novo HTML/JS/CSS entra no artefato público; credenciais e testes não entram.

Veja também [arquitetura](architecture.md), [contribuição](../CONTRIBUTING.md) e [checklist de apresentações](apresentacoes-e-destinos.md).
