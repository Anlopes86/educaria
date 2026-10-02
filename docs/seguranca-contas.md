# Segurança das contas

## Ativação em produção — 02/10/2026

`ACCOUNT_DELETION_ENABLED=true` foi configurado no serviço `educaria-api-anlopes86` após confirmar ausência de solicitações pendentes, permissões Admin e regras publicadas. O [deploy da configuração](https://dashboard.render.com/web/srv-datbe9navr4c73csctog/deploys/dep-davrfq2d0e5s7393qe70) ficou Live, reutilizando o código validado `1f67d17`.

O teste `ai-service/tools/production-deletion-smoke.mjs` passou em **23 verificações**: rejeição de clientes antigos, confirmação explícita, UID obtido do token (ignorando UID alheio no corpo), bloqueio imediato na API/Firestore, comprovante sem sessão, rejeição de comprovante incorreto, execução das cinco etapas pelo worker real, remoção de Auth/perfil/subcoleções (inclusive abaixo de documento pai inexistente), preservação de outra conta fictícia e do registro de consumo. Todos os dados de teste foram removidos; nenhuma conta real foi alterada e não houve geração de IA.

O bucket continua inexistente (404): o teste validou esse caminho, **não** remoção de arquivos em Storage real. Antes de adicionar Storage, publicar/testar suas regras de bloqueio e permissões entre serviços. Nenhum plano pago, bucket, permissão IAM ou política TTL foi ativado nesta operação. TTL dos comprovantes concluídos segue pendente de configuração; `expiresAt` sozinho não apaga documentos.

O switch de ativação fica com `sync: false` no Blueprint para preservar a decisão do painel em futuras publicações ([semântica oficial do Render](https://render.com/docs/blueprint-spec#prompting-for-secret-values)). Em novas instalações, iniciar desativado até validar as dependências; o servidor continua com padrão `false`. Para suspender novas solicitações e o worker, definir `false` e publicar a configuração no painel, sem remover os jobs/bloqueios existentes. Ao reativar, o worker retoma as etapas pendentes.

### Revalidação controlada

Usar apenas um caminho local de credencial; nunca seu conteúdo no terminal/chat. Os scripts recusam UID existente como argumento e nunca enviam segredos para os logs:

```text
node ai-service/tools/firebase-preflight.mjs CAMINHO_DA_CREDENCIAL
node ai-service/tools/production-security-smoke.mjs CAMINHO_DA_CREDENCIAL --create-disposable-probe --expect-deletion-enabled
node ai-service/tools/production-deletion-smoke.mjs CAMINHO_DA_CREDENCIAL --create-and-delete-disposable-probe
```

O teste completo só roda se não houver jobs pendentes. Se falhar depois de tentar registrar a solicitação, preserva o bloqueio e informa somente os identificadores fictícios para investigação; não executa uma limpeza que dispute com o worker. A remoção dos fixtures após sucesso acontece somente depois de confirmar o fim do job. Executar os testes de produção separadamente para respeitar a limitação por IP.

## Estado da publicação — 01/10/2026

Frontend e API publicados no commit `1f67d17e72cfe718795661dc4f4ada7d38e28726`. O [workflow do GitHub Pages](https://github.com/Anlopes86/educaria/actions/runs/36899684424) e o deploy do Render terminaram com sucesso.

As regras do Firestore foram publicadas e conferidas no ruleset `2cf691c5-b10d-446a-a216-999b5070c9b0`. A versão anterior (`eff135a5-57f7-46b3-91ab-7020ddcd1128`) permanece disponível para rollback, com backup local em `.data/security-release-backups/`. Os perfis antigos não tinham `role`/`plan`; a regra agora aceita os padrões seguros sem migrar dados de professores.

A validação autenticada em produção confirmou 12 verificações: API com sessão válida, exclusão desativada, leitura/edição do próprio perfil legado, negação de acesso a outra conta e de alteração do próprio plano, bloqueio de exclusão em Firestore/API e rejeição de contas desabilitadas, sessões revogadas e usuários removidos. Usou uma conta temporária sem email e documentos fictícios, todos removidos ao final. Não houve geração de IA.

Na publicação inicial, a **exclusão automática permaneceu desativada**, comprovada por resposta 503 com `deletion_unavailable`. O bucket configurado `educaria-f46b2.firebasestorage.app` retornou 404 e não havia release de regras Storage. Não foi criado bucket, alterado IAM nem ativado faturamento/TTL. A ativação posterior está registrada acima.

Observação: o worker tolera um bucket comprovadamente inexistente (404), pois não há arquivos a remover. Isso não obriga a contratar Storage para excluir perfis e materiais embutidos no Firestore. Antes da ativação, confirmar a configuração pretendida, o bucket exato e testar o fluxo completo com uma conta descartável. Nunca tratar erro 403 como bucket ausente.

Testes locais/CI desta publicação: 33 backend + 39 interface/persistência + 6 emuladores, incluindo compatibilidade de perfis legados. As seções abaixo descrevem implementação e procedimentos, com histórico da preparação local no final.

## Sessões da API

O Firebase Admin SDK verifica assinatura, validade e revogação com `verifyIdToken(token, true)`. Contas desabilitadas/removidas são rejeitadas. A API também consulta o bloqueio de exclusão no Firestore antes de atender uma sessão. Credenciais com projeto diferente são rejeitadas; falhas operacionais retornam 503, sem expor tokens, chaves ou mensagens dos provedores.

Essa verificação cobre a API. Ela **não** faz uma regra Firestore consultar automaticamente a revogação geral de tokens. As regras desta etapa bloqueiam especificamente as contas com solicitação de exclusão, inclusive quando o navegador ainda tem um ID token dentro da validade.

## Exclusão retomável

`ACCOUNT_DELETION_ENABLED=false` por padrão. Não habilitar antes de validar regras e permissões. Quando desativado, DELETE retorna 503 e não remove dados. Não há fallback para exclusão no navegador.

1. O professor confirma `EXCLUIR` e reautentica no Firebase. A senha não é enviada à API.
2. O navegador guarda um comprovante aleatório de 256 bits antes da requisição. DELETE `/api/account` exige autenticação há no máximo cinco minutos e `{version: 1, confirmation: "EXCLUIR", receipt}`. O UID vem exclusivamente do token validado.
3. Uma transação cria `accountDeletionJobs/{uid}`. Só o hash do comprovante é armazenado no servidor. A resposta 202 significa **solicitação registrada**, não exclusão concluída.
4. O worker desabilita a conta/revoga sessões, remove arquivos do prefixo exato `teachers/{uid}/`, remove recursivamente `teachers/{uid}` e subcoleções, limpa o estado de cobrança local e, por último, remove o usuário do Auth.
5. Cada etapa tem checkpoint, lease transacional renovável e novas tentativas com espera crescente. Reiniciar o servidor retoma solicitações pendentes. Operações repetidas toleram recursos já removidos. Erros de permissão no Storage não são tratados como sucesso.
6. POST `/api/account/deletion-status` permite consultar apenas o status com UID e comprovante. Não cria nem altera solicitações e não expõe perfil. O token não vai na URL. A página `exclusao-conta.html` funciona sem autenticação e tem link de retomada no login.

O worker roda a cada 15 segundos **enquanto o processo estiver ativo**. Render gratuito pode suspender o processo, atrasando a exclusão; não se promete execução contínua. Para SLA, usar fila/worker durável ou agendamento externo, com autorização separada.

Os registros de consumo permanecem com a retenção própria (`aiCreditUsage.expiresAt`); excluir não restaura cotas. A solicitação concluída recebe `expiresAt` de 30 dias, mas a remoção automática depende de configurar TTL no Firestore. Solicitações pendentes não recebem TTL. Não apagar manualmente o bloqueio para tentar resolver uma falha: isso poderia permitir novas gravações durante a limpeza.

Arquivos exportados, caches em outros dispositivos, backups e versões mantidas por políticas de soft delete/retention do provedor não são apagados pelo navegador nem devem ser anunciados como apagamento físico imediato. A cobrança ainda usa arquivo local no backend: múltiplas instâncias e webhooks concorrentes exigem migrar essa fonte de estado para armazenamento transacional antes de escalar cobrança real.

## Checklist para novas ativações

1. Rodar testes e revisar o diff. Validar em projeto de teste com contas e conteúdo descartáveis, incluindo token revogado/desabilitado e reinício após falha.
2. Conferir `FIREBASE_PROJECT_ID`, credencial da conta de serviço, banco `(default)` dos professores e `FIREBASE_STORAGE_BUCKET`. Não colar credenciais em chat, logs ou Git. Não ativar plano pago automaticamente.
3. Validar permissões Admin de Auth, Firestore e Storage. A credencial antes usada só para créditos pode não ter permissão para consultar/desabilitar/remover usuários. Primeiro testar uma chamada autenticada comum da API; falha agora deve retornar 503, nunca permitir acesso sem verificar revogação.
4. Publicar as regras versionadas de Firestore e Storage. A consulta `firestore.exists` nas regras de Storage exige habilitar a permissão entre serviços. Validar usuário proprietário, usuário alheio e conta bloqueada antes de ativar exclusão. O emulador não comprova IAM real.
5. Publicar frontend e backend correspondentes, inicialmente com exclusão desativada. Recarregar abas antigas: versões anteriores ainda continham exclusão pelo navegador.
6. Só após os testes com conta descartável, ativar `ACCOUNT_DELETION_ENABLED=true`. Conferir TTL/retenção de consumo e de solicitações concluídas. Monitorar jobs pendentes e falhas; não apagar contas reais como teste.

Referências: [sessões do Firebase](https://firebase.google.com/docs/auth/admin/manage-sessions), [regras do Storage e consultas ao Firestore](https://firebase.google.com/docs/reference/security/storage), [testes de regras](https://firebase.google.com/docs/rules/unit-tests).

## Testes locais

```text
npm ci --prefix ai-service
npm test --prefix ai-service
node --test tools/tests/*.test.mjs
npm ci --prefix firebase
npm test --prefix firebase
node tools/check-js-syntax.mjs
node tools/check-assets.mjs
node tools/check-i18n.mjs
node tools/check-responsive-layout.mjs exclusao-conta.html login.html auth:plataforma/configuracoes.html
```

Os emuladores exigem Java 21+. Usam exclusivamente `demo-educaria-security`, sem recursos cloud. Os testes se recusam a rodar sem os hosts de emuladores. Não usar `.env`, tokens ou contas de produção. No Windows, um runtime portátil pode ser selecionado apenas para o processo do teste usando `JAVA_HOME` e `PATH`; não é necessário substituir o Java do sistema.

O workflow de Pages passa a exigir os testes das regras antes de publicar o frontend. Isso **não** publica as regras Firebase e não comprova o deploy do Render.

`gaxios@6` (dependência de Storage) tem override pontual de `uuid` para `^11.1.1`, eliminando o alerta de segurança transitivo. Um teste verifica a interface CommonJS `v4` usada por essa dependência. Reavaliar o override quando o SDK atualizar sua árvore.

### Resultado local em 01/10/2026

- 33 testes do backend, 39 testes da interface/persistência e 5 testes nos emuladores passaram.
- Emuladores validaram isolamento entre professores, bloqueio de exclusão, leases concorrentes, paginação, retomada e remoção de documentos/arquivos somente da conta fictícia escolhida.
- Chrome em 390px: acompanhamento, login e configurações sem overflow horizontal; menu mobile de configurações aprovado. Os dois erros de conexão nas configurações vêm do backend indisponível no ensaio sintético, não de integração cloud validada.
- Sintaxe, referências de assets, traduções e `git diff --check` passaram. Auditoria das dependências de produção: zero vulnerabilidades reportadas.
- Nenhuma conta real foi excluída. Código, regras e configuração desta etapa não foram publicados. IAM, TTL e integração autenticada de produção continuam pendentes.
