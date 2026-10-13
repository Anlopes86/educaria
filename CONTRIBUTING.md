# Trabalhando no EducarIA

## Preparar o ambiente

Use Node.js 22 ou superior. Para reproduzir a integração contínua, prefira Node 22. Os emuladores de segurança precisam também de Java 21.

```bash
npm ci --prefix ai-service
npm ci --prefix firebase
```

O `package.json` da raiz oferece atalhos e não instala dependências. As dependências e seus arquivos de lock continuam separados por serviço.

Para a API local, copie `ai-service/.env.example` para `ai-service/.env`, preencha apenas as configurações necessárias e execute `npm run dev:api`. Siga [o guia de IA](docs/ia-materials-setup.md) e [o guia Firebase](docs/firebase-setup.md). Não use o projeto Firebase de produção para testes destrutivos.

Não sirva a raiz inteira do repositório na web: ela pode conter credenciais locais. `npm run build:pages` monta uma pasta temporária com apenas os arquivos públicos versionados e informa seu caminho. Use essa pasta em um servidor estático local; arquivos novos só entram no artefato depois de adicionados ao Git.

## Antes de alterar

1. Consulte o [mapa da arquitetura](docs/architecture.md) e identifique a camada responsável.
2. Confira as alterações já existentes; não misture arquivos pessoais, vídeos ou ajustes de outra tarefa.
3. Escreva ou localize um teste que represente o comportamento a preservar.
4. Faça mudanças pequenas, separando reorganização de alterações de comportamento.

Para incluir uma ferramenta, siga [o roteiro de novas atividades](docs/adding-activities.md), que cobre geração, edição, salvamento, apresentação, aula completa e testes.

## Verificar

```bash
npm run check          # sintaxe, assets, traduções e configuração pública
npm test              # testes de frontend e API, sem chamadas reais à IA
npm run verify        # as duas etapas acima, interrompendo no primeiro erro
npm run test:security # isolamento Firebase em emuladores; exige Java 21
```

`node tools/verify.mjs` é equivalente a `npm run verify`. Os testes de segurança Firebase são separados: um `verify` verde não significa que os emuladores rodaram. As duas etapas são obrigatórias na integração contínua.

Quando mudar uma tela, revise também teclado/foco, celular e apresentação em notebook pequeno. Quando mudar persistência, teste salvar, recarregar, trocar de conta, escolher turmas e recuperar um rascunho. Consulte [build e validação](docs/build-and-validation.md) para as auditorias de navegador já existentes.

## Convenções

- Backend: módulos ESM, responsabilidade explícita e testes importando funções públicas. Funções de domínio não devem abrir o servidor nem ler segredos na importação.
- Frontend: scripts clássicos carregados pelo HTML, sem bundler. Preserve a ordem dos scripts, funções compartilhadas e eventos existentes; não converta um arquivo isoladamente para ESM.
- CSS: mantenha a ordem de `assets/css/estilo-premium.css`. Evite corrigir um problema acrescentando sucessivas regras globais ao final; identifique a regra e a página responsáveis.
- Dados: preserve IDs, chaves de armazenamento e formatos de materiais salvos. Mudanças de estrutura exigem compatibilidade/migração e teste com materiais antigos.
- Texto: mantenha português com acentos e as traduções usadas em `assets/i18n/`. Não reformate todos os arquivos junto com uma correção pontual.
- Testes: prefira imports a recortes de código com `vm`. Os testes legados de integração ainda usam recortes de rotas; a substituição deve manter a mesma cobertura de autenticação, consumo e falhas.
- Limpeza: referência textual ausente é apenas um indício. Antes de excluir, confira HTML, CSS, JavaScript, caminhos dinâmicos, URLs públicas, testes e compatibilidade com dados salvos.

## Segurança e publicação

Nunca versione `.env`, chaves de serviço Firebase, tokens, dumps de usuários ou arquivos de teste com dados reais. A configuração Web pública do Firebase não substitui autenticação/regras de acesso. O navegador nunca decide permissões administrativas ou saldo.

Revise o diff, inclua apenas os arquivos da tarefa e execute as verificações antes de publicar. Um push em `master` aciona o fluxo de publicação do Pages; o Render usa sua configuração própria de deploy. Uma reorganização local não deve publicar mudanças sem autorização.
