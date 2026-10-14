# Exportação do consumo de IA

Na Administração, abra **Consumo de IA**, escolha os filtros e clique em **Exportar relatório**. O botão fica disponível após o carregamento do relatório. O arquivo JSON usa os filtros atuais do formulário, mesmo se ainda não foram aplicados à tabela, e inclui todas as páginas disponíveis. Não altera créditos, cotas, materiais ou usuários e não chama um provedor de IA.

O download é local. Para solicitar uma análise, anexe o arquivo à conversa; a plataforma não o envia automaticamente a terceiros.

## Escopo e leitura dos números

- Formato `educaria-ai-usage`, versão `1`, com data de exportação, data da consulta, filtros, período e avisos.
- Uma única consulta à fonte limitada aos 5.000 registros mais recentes dos últimos 30 dias, antes dos filtros. Uma amostra truncada continua truncada na exportação, mesmo que o filtro resulte em poucos registros. O arquivo sinaliza isso em `completeness.truncated` e `warnings`.
- `events` contém cada solicitação e suas tentativas; `summary`, `byMaterial`, `byAccount` e `byCohort` resumem os mesmos registros. Não há limitação às 20 contas mostradas na tabela administrativa.
- `usage` da geração já agrega as tentativas conhecidas. Não some a geração e suas tentativas novamente. Cache é subconjunto da entrada; raciocínio aparece separado da saída.
- `null` indica valor desconhecido, não zero. Médias e P95 de tokens excluem medições parciais/desconhecidas. Custos incompletos somam apenas parcelas conhecidas. O preço em USD é estimativa de referência, não uma cobrança.
- `unlimited` identifica a política da conta no momento da geração; não é uma confirmação de papel administrativo.
- As janelas de 1, 7 ou 30 dias são móveis; horários são UTC. Não é um histórico retroativo nem garantia de coleta integral. Falhas de gravação, gravações pendentes, armazenamento temporário e coleta desativada acompanham o arquivo.

## Privacidade e implementação

`GET /api/admin/usage/export` usa a mesma autenticação, lista de administradores, limite de consultas e cabeçalhos `private, no-store` do painel. Faz uma leitura atualizada do consumo e não consulta o diretório de contas.

`ai-service/ai-usage-export.js` projeta explicitamente os campos autorizados em cada nível. Não exporta nomes, e-mails, UIDs, hashes de UID, IDs persistidos das gerações, escola, prompts, conteúdos, nomes de arquivos ou mensagens brutas de erro. Rótulos como `Professor 001` só têm significado dentro daquele arquivo; não devem ser cruzados entre exportações. Eventos sem conta mantêm `account: null`.

Datas, planos e padrões de uso permanecem úteis à análise. A remoção de identificadores diretos não garante anonimato absoluto: compartilhe apenas com quem precisa analisar os dados.

O navegador baixa o JSON sem guardá-lo no armazenamento do site. Mudança de sessão, navegação, atualização do relatório ou alteração dos filtros cancela uma exportação pendente. A URL temporária do arquivo é liberada depois do download. Uma falha não gera um arquivo parcial. Se apenas o frontend for publicado e a API ainda estiver antiga, a interface explica que falta atualizar o servidor.

Testes: `ai-service/tests/ai-usage-export.test.mjs`, `ai-service/tests/admin-dashboard.test.mjs`, `tools/tests/admin-usage-export.test.mjs`. As fixtures de `tools/fixtures/ai-usage.mjs` são sintéticas e não correspondem a professores reais.
