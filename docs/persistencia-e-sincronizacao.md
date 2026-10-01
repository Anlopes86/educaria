# Persistência e sincronização — etapas 1 e 2 da auditoria

## Materiais

- `syncRevision` identifica a última versão remota conhecida pelo dispositivo. Uma transação Firestore gera a próxima revisão ao salvar.
- `_pendingSync` existe somente na cópia local e indica uma alteração ainda não confirmada na nuvem.
- Documentos com `deletedAt` são marcadores de exclusão, não materiais. Não removê-los em uma limpeza comum: dispositivos offline precisam reconhecê-los para não recriar IDs excluídos.
- Edições locais pendentes de um material excluído remotamente são preservadas em outro ID, com o sufixo de título “edição recuperada”.
- Quando a versão-base de uma edição não coincide com a remota, a transação preserva a versão remota em uma cópia antes de gravar a edição atual. `conflictOf` relaciona essa cópia ao original. Alterações apenas em metadados de uso não criam cópias de conflito.
- Documentos legados recebem revisão na primeira sincronização. Em divergências sem histórico suficiente, prefere-se preservar uma cópia a descartar conteúdo.
- Leituras de coleção não aplicam snapshots locais capturados antes da resposta: relê-se o armazenamento atual e verifica-se se outro salvamento já mudou a revisão.

As regras versionadas atuais permitem as operações dentro do UID proprietário; não é introduzida uma coleção pública. Não afirmar que os testes simulados equivalem à validação das regras efetivamente implantadas. Antes de publicar, recomenda-se ensaio com uma conta de teste em dois dispositivos e dados descartáveis.

## Falhas de gravação

Falhas de armazenamento local são propagadas e notificadas. Todos os editores que carregam `lesson-library.js` podem mostrar aviso persistente, tentar novamente e exportar uma cópia JSON do rascunho atual. Essa cópia é um recurso de recuperação manual; a importação automática ainda não foi implementada.

O status de salvamento automático não confirma alterações digitadas durante uma requisição anterior. O retorno da internet provoca nova tentativa de salvar o conteúdo atual, sem indicar “Salvo na nuvem” apenas porque a rede voltou.

Falhas ao gravar a atividade ativa ou o rascunho da aula completa também são propagadas. A ação de tentar novamente reconhece a aula completa, sem depender da presença de uma pilha de slides no editor.

## Resultados de IA no painel

- O resultado concluído é gravado antes de abrir o modal, em uma chave própria por geração e UID. Não há mais descarte automático após 15 minutos nem dependência de `sessionStorage` para levar o material ao editor.
- O painel oferece “Continuar depois” e um botão de retomada. A fila suporta mais de um resultado pendente. O modal informa que a cópia está neste navegador, não na nuvem.
- Retomar não chama o provedor de IA. O custo mostrado é o da geração original; um saldo antigo não é reapresentado como saldo atual.
- O editor usa um ID estável por resultado. Só remove a pendência depois de gravar o material localmente; abrir uma pendência já importada recupera a edição existente sem sobrescrevê-la.
- Trocas de conta são verificadas antes e depois das operações assíncronas. Resultados concluídos após uma troca continuam vinculados à conta que iniciou a geração.
- Se o armazenamento estiver cheio, o painel mantém uma cópia em memória, mostra o aviso para não fechar/atualizar e oferece download JSON de segurança (recuperação manual, sem importador automático).

Limites: vale para resultados recebidos pelo navegador. Fechar a aba durante a requisição, antes de receber o resultado, ainda exige um fluxo de jobs persistidos no servidor para recuperação garantida. A cópia pendente não atravessa dispositivos e não sobrevive à limpeza dos dados do navegador. Nenhuma cota/provedor foi alterado nesta etapa.

## Imagens e apresentação de slides

`image-upload.js` aplica o mesmo tratamento ao editor de slides e aos slides dentro da aula completa: JPG/PNG/WebP até 8 MiB, validação pela decodificação, limite de 32 megapixels decodificados, redimensionamento até 1600 × 1000 e redução progressiva até no máximo 160 KiB de texto no data URL. Falha ao criar canvas não insere o arquivo original inteiro. Remover a imagem/fechar ou alterar o bloco durante o processamento invalida o resultado atrasado.

Abrir a apresentação não regrava mais a estrutura do editor. A edição de texto na apresentação atualiza os campos existentes, preservando controles, opções, imagens e slides ainda vazios. O editor recompõe controles de upload ausentes em rascunhos legados simplificados por versões anteriores.

As imagens **continuam embutidas no rascunho**. A redução não aumenta os limites de armazenamento local nem o limite de documento Firestore. Materiais com muitas imagens ainda precisam de armazenamento de arquivos separado. Firebase Storage exige plano Blaze conforme a [documentação oficial](https://firebase.google.com/docs/storage/web/start); não foi ativado faturamento nem configurado serviço cloud. A migração permanece pendente da escolha do armazenamento/plano.

## Conta e consumo de IA

O endpoint de limpeza exige `auth_time` recente. Ele não apaga mais os registros de consumo: a conta Firebase ainda é excluída pelo fluxo autenticado no navegador, e acionar apenas a limpeza do backend não pode renovar a cota.

O ciclo de exclusão completo ainda precisa ser coordenado pelo servidor em uma próxima etapa. A validação geral de tokens revogados/desabilitados e um processo retomável de exclusão também continuam pendentes. Não tratar o endpoint atual como uma operação atômica de remoção de toda a conta.

Os limites continuam renovando conforme o dia da política existente. A remoção física de documentos de consumo é uma configuração distinta: o armazenamento Firestore já escreve `expiresAt`; conferir em produção a política TTL correspondente e a retenção adequada. Não foi alterada a configuração cloud nem feita limpeza de contas reais.

A limpeza local remove apenas chaves do UID excluído e seus eventos de uso, preservando dados de outros professores no navegador.

## Publicação

O workflow cria um artefato com `tools/build-pages.mjs`: somente arquivos versionados e explicitamente públicos de `assets`, `img`, `plataforma` e páginas-raiz. Não inclui backend, dependências do servidor, ferramentas, relatórios nem configurações locais. A lista deve ser revisada quando surgir um novo tipo de asset público.

O service worker passa a usar a versão `v8` do cache. Após o deploy, recarregar abas antigas antes de verificar o novo comportamento. O deploy do frontend não substitui o deploy do serviço no Render. Os módulos novos e suas referências HTML precisam fazer parte do mesmo commit antes da publicação; o build ignora arquivos não versionados.

## Validação

```text
node --test tools/tests/*.test.mjs
npm test --prefix ai-service
node tools/check-js-syntax.mjs
node tools/check-assets.mjs
node tools/check-i18n.mjs
node tools/build-pages.mjs
```

O teste Chrome existente aceita `EDUCARIA_AUDIT_STORAGE_FAILURE=1` para simular falta de espaço em um editor, verificar o aviso/ação de recuperação e confirmar seu desaparecimento depois de restabelecer o armazenamento. As credenciais e dados usados pelos testes de interface são fictícios.

`EDUCARIA_AUDIT_RECOVERY=1` ativa verificações de retomada de IA (painel → editor → apresentação), reabertura sem perda de edições, preservação dos controles de slides e upload validado nos dois editores. Exemplo em PowerShell:

```powershell
$env:EDUCARIA_AUDIT_RECOVERY = '1'
$env:EDUCARIA_AUDIT_DISABLE_DASHBOARD_TOUR = '1'
node tools/check-responsive-layout.mjs auth:plataforma/index.html auth:plataforma/slides-builder.html auth:plataforma/criar-aula.html
```

Os testes usam resultados sintéticos, sem chamar IA nem escrever na nuvem. Firebase/Render são bloqueados nesse modo; os erros de rede correspondentes no log do navegador são esperados, não validam uma integração de produção.
