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
- Contas ilimitadas não sofrem desconto individual. Seu consumo aparece no relatório de gerações, separado do saldo diário.
- Dados privados ficam só na memória da página, sem persistência local, cache de API, arquivos, turmas ou materiais. São limpos na troca de sessão e ao sair da página.
- Metadados de cadastro ficam em cache no servidor por 30 segundos; **Atualizar dados** renova a consulta. Saldos são consultados a cada listagem. Último login não é presença online.
- Limite de 60 consultas/minuto por IP, no máximo quatro leituras de saldo simultâneas, erros genéricos sem dados pessoais. O diretório tem proteção explícita de 20 mil contas por leitura; acima disso, migre a busca e os totais para um índice administrativo antes de ampliar a operação. Não retorna totais truncados.
- O painel não altera planos, saldos, senhas ou contas. Não há endpoints administrativos de escrita nesta versão.

## Verificação antes de liberar

Execute `npm test --prefix ai-service`, `node --test tools/tests/*.test.mjs`, `node tools/check-assets.mjs` e `node tools/check-js-syntax.mjs`. Após publicar, confirme que a conta autorizada vê o painel e uma conta comum recebe 403 em `/api/admin/users`, inclusive ao acessar a página diretamente. Se o Admin SDK não tiver permissão de listar usuários, corrija a configuração do serviço; não relaxe as regras dos professores.

## Relatório de consumo de IA

- `GET /api/admin/usage` herda a mesma autenticação, autorização por UID, limitação de consultas e proteção contra cache. Não há leitura de métricas diretamente pelo navegador no Firestore.
- Coleta automática nas gerações de texto e de imagens, incluindo contas ilimitadas, falhas e todas as tentativas internas. Bloqueios antes de chamar o provedor não são contados como gerações. Montar uma aula com atividades existentes, editar, salvar e apresentar não chama IA e não gera registro; criações de blocos são medidas na chamada correspondente.
- `aiGenerationUsage` fica no banco **(default)** do projeto Firebase já configurado no serviço. Não precisa criar a coleção manualmente: ela surge na primeira geração após publicar o backend. A opção `AI_CREDIT_FIRESTORE_DATABASE` continua específica do saldo.
- Coleta habilitada por padrão. `AI_USAGE_ANALYTICS_ENABLED=false` desliga novos registros. Com `AI_CREDIT_STORE=firestore`, usa Firestore; em desenvolvimento com outro armazenamento, usa memória limitada e avisa no painel. Nenhuma quota existente foi alterada.
- Guarda UID, plano, indicação de isenção, tipo de atividade, quantidades solicitada/gerada, presença de arquivo, opções categóricas, provedor/modelo, tokens separados, duração, tentativas, resultado, desconto confirmado e estimativa monetária. Não guarda prompts, materiais, arquivos, nomes de arquivos, conteúdo de erro, nome/e-mail, turma, disciplina ou público-alvo. Nome/e-mail são resolvidos pelo diretório administrativo somente na consulta.
- `creditsCharged` é o desconto confirmado; `measuredCredits` é a equivalência na política interna, não dinheiro. A tarifa de referência é independente: Groq GPT-OSS 120B, USD 0,15/milhão de entrada, 0,075 de entrada em cache e 0,60 de saída incluindo raciocínio (13/10/2026). Cada evento preserva o valor calculado e a versão da tarifa. Fonte: https://console.groq.com/docs/model/openai/gpt-oss-120b. Outros modelos ou contagens incompatíveis ficam sem preço, nunca zero. Não representa fatura ou cobrança no plano gratuito.
- Uso desconhecido não vira zero nem entra na média/P95. Medições parciais somam apenas tokens/custos conhecidos e são sinalizadas. A média se aplica aos filtros selecionados (inclusive falhas se esse filtro estiver ativo); P95 é descritivo da amostra, não previsão ou garantia de quota.
- Janela móvel de 24 horas, 7 ou 30 dias; cache de 30 segundos; **Atualizar relatório** força nova leitura. Limite de 5.000 registros mais recentes no conjunto dos últimos 30 dias, com aviso explícito se truncado, inclusive ao filtrar professores ou tipos. Antes de escalar além disso, adicione agregações diárias persistentes.
- Uma transação por geração concluída/falha, com leitura do bloqueio de exclusão e escrita do evento. Consulta administrativa lê os eventos na janela. São operações sujeitas às quotas/custos do Firestore. Não há chamadas extras à IA.
- A gravação não impede a entrega do material se falhar. Espera limitada a 2,5 segundos; operação pendente pode concluir depois. ID estável evita duplicação em retentativas do SDK. Aviso `ai_usage_write_unconfirmed` sem dados pessoais; contadores de falhas/pendências exibidos no painel são deste processo e reiniciam com o serviço. Reinício abrupto pode perder uma gravação ainda pendente: este relatório é analítico, não um livro contábil de faturamento.
- Histórico não retroativo: saldos antigos não permitem reconstruir gerações. Use os dados novos para escolher amostras e simular planos antes de definir preço/quota.

### Retenção e exclusão

Cada documento recebe `expiresAt` (Timestamp) para **90 dias**. Para remoção automática, configure uma política TTL no Firestore para o grupo de coleções `aiGenerationUsage`, campo `expiresAt`. O campo sozinho não ativa TTL; sem essa política os registros continuam armazenados (o painel consulta apenas os últimos 30 dias). TTL pode gerar cobranças de exclusão; confirme a configuração do projeto antes de ativá-lo. Esta alteração de código não ativa faturamento nem muda políticas na nuvem.

A exclusão de conta remove os registros desse UID em lotes de 200 no estágio de cobrança, antes de excluir a identidade. A transação de escrita respeita `accountDeletionJobs`, impedindo que uma geração em andamento recrie métricas após a exclusão. As regras atuais negam acesso direto à coleção para todos os clientes, inclusive usuários comuns com claims forjadas.
