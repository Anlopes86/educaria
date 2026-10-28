# Vagas do beta e lista de espera

O lote inicial permite **25 novos acessos**, além das contas existentes. Depois disso, novos cadastros permanecem no Firebase Authentication, mas entram na lista de espera e não podem acessar materiais, uploads nem IA. A tela `lista-espera.html` informa que novas vagas serão liberadas e permite consultar o acesso, sair da sessão ou falar com a EducarIA. Não há botão para sair da lista; pedidos de exclusão podem ser encaminhados pelo canal de contato. Não há envio automático de convites ou avisos por e-mail.

## Regras do lote

- A ativação registra uma data fixa e preserva as contas criadas até esse instante, usando a data do Firebase Auth, nunca uma data enviada pelo navegador.
- Cada novo UID ocupa no máximo uma vaga. As transações do Firestore impedem ultrapassar o lote em cadastros concorrentes.
- Novas contas gratuitas aprovadas recebem 250 créditos diários. Contas anteriores mantêm seu limite. Contas administrativas sem limite individual continuam sujeitas à proteção global do provedor.
- Vagas não renovam diariamente e não são repostas quando uma conta é excluída. Créditos continuam renovando no horário configurado na API.
- A administração pode filtrar a lista de espera e liberar uma conta. Se o lote estiver cheio, essa ação aumenta explicitamente o lote em uma vaga; a interface pede confirmação.
- O estado fica em `platformControl/betaEnrollment` e `betaEnrollments/{uid}`, sem acesso direto do cliente. Não excluir esses documentos para liberar vagas: isso pode reiniciar a política ou perder a contagem.

## Publicar e ativar com segurança

1. Executar `npm run verify` e `npm run test:security`.
2. Publicar frontend e API, incluindo o bloqueio atômico de exclusão em `account-deletion.js`. Confirmar que o cadastro carrega `beta-access.js` e que `/api/beta/status` responde com App Check válido.
3. Publicar as regras de Firestore e Storage. Sem a política ativa, contas existentes continuam funcionando.
4. Consultar o estado com uma credencial administrativa do projeto correto. O caminho abaixo é um exemplo; nunca versionar o arquivo da credencial:

   ```powershell
   node ai-service/tools/beta-enrollment.mjs --project educaria-f46b2 --credentials "C:\caminho\credencial-admin.json"
   ```

5. Para iniciar o lote, acrescentar `--activate` ao mesmo comando. A ativação primeiro prepara os acessos antigos e só depois aplica o bloqueio. Se houver interrupção, executar novamente: o processo retoma a mesma data e o mesmo lote, sem conceder outras 25 vagas.
6. Confirmar na administração o lote, o acesso de uma conta anterior e o fluxo de um novo cadastro de teste autorizado. Evitar criar contas fictícias em produção apenas para esgotar vagas; esse caso é coberto nos emuladores.

Antes da ativação, a funcionalidade permanece inativa. Publicar código não inicia nem reinicia o lote.

## Segurança e manutenção

Auth e App Check protegem a API; a autorização usa UID validado e registros do servidor. O cliente não pode escolher status, cota, UID ou data de entrada. Firestore e Storage também bloqueiam a lista de espera, mesmo com chamadas diretas aos SDKs.

Storage permite apenas duas consultas a documentos Firestore por avaliação. Com o beta ativo, suas regras leem política e matrícula. A solicitação de exclusão grava `accessBlocked` na matrícula na mesma transação do bloqueio de exclusão, antes de remover conteúdo; a preparação de contas antigas respeita exclusões já iniciadas. Não alterar esse fluxo de forma isolada. [Limites oficiais das regras](https://firebase.google.com/docs/rules/rules-behavior).

Módulos: `ai-service/beta-enrollment.js` (transações), `beta-routes.js` (API), `assets/js/beta-access.js` (interface). Testes de concorrência, migração e exclusão: `firebase/tests/beta-enrollment.test.mjs`; autorização: `ai-service/tests/beta-routes.test.mjs`; isolamento: `firebase/tests/isolation.test.mjs`.
