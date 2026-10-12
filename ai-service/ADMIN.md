# Administração de usuários (somente consulta)

## Ativação

1. Publique esta versão do frontend e do `ai-service`.
2. No serviço **Educaria** do Render, em **Environment**, crie `ADMIN_UIDS` com o UID exato da sua conta em Firebase Authentication. Não use e-mail, senha ou chave de serviço.
3. Salve e reimplante o serviço. A lista é carregada no início do processo.
4. Entre com essa conta e atualize o painel. **Administração** aparecerá no menu lateral. O endereço é `plataforma/administracao.html`.

Sem `ADMIN_UIDS`, ninguém recebe acesso. Para revogar, remova o UID e reimplante. Não é preciso mudar as regras do Firestore; elas continuam isolando os professores. Não crie um campo editável `admin` no perfil. `AI_UNLIMITED_UIDS` não concede permissão administrativa.

## Dados e garantias

- `GET /api/admin/access`: exige sessão Firebase válida; só informa a permissão da própria sessão.
- `GET /api/admin/users`: exige sessão não revogada e UID autorizado no servidor, mesmo se a autenticação da IA estiver desligada no ambiente local.
- Busca por nome/e-mail, filtro de plano e situação, 20 linhas por página; os totais consideram o diretório inteiro, não apenas a página.
- Firebase Authentication é a fonte dos cadastros, datas, situação e último login. Perfis incompletos continuam visíveis. Escola vem apenas dos campos `institution`/`institutionName` em `teachers/{uid}`.
- Plano é resolvido pelas mesmas claims assinadas e regras de cobrança usadas pela IA, não pelo campo de perfil editável.
- Créditos consultam o mesmo armazenamento, chave diária e limites da geração. `peek` não escreve nem libera reservas persistidas. O painel separa gastos de reservas em processamento.
- Contas ilimitadas não têm consumo individual contabilizado pelo mecanismo atual; o painel mostra isso explicitamente, sem inventar consumo zero.
- Dados privados ficam só na memória da página, sem persistência local, cache de API, arquivos, turmas ou materiais. São limpos na troca de sessão e ao sair da página.
- Metadados de cadastro ficam em cache no servidor por 30 segundos; **Atualizar dados** renova a consulta. Saldos são consultados a cada listagem. Último login não é presença online.
- Limite de 60 consultas/minuto por IP, no máximo quatro leituras de saldo simultâneas, erros genéricos sem dados pessoais. O diretório tem proteção explícita de 20 mil contas por leitura; acima disso, migre a busca e os totais para um índice administrativo antes de ampliar a operação. Não retorna totais truncados.
- O painel não altera planos, saldos, senhas ou contas. Não há endpoints administrativos de escrita nesta versão.

## Verificação antes de liberar

Execute `npm test --prefix ai-service`, `node --test tools/tests/*.test.mjs`, `node tools/check-assets.mjs` e `node tools/check-js-syntax.mjs`. Após publicar, confirme que a conta autorizada vê o painel e uma conta comum recebe 403 em `/api/admin/users`, inclusive ao acessar a página diretamente. Se o Admin SDK não tiver permissão de listar usuários, corrija a configuração do serviço; não relaxe as regras dos professores.
