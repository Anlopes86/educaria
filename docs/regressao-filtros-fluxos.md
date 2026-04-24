# Regressao Rapida: Filtros e Fluxos

Data de referencia: 22/04/2026

## Escopo

1. `plataforma/turmas.html`
2. `plataforma/turma.html`
3. `plataforma/biblioteca.html`
4. `assets/js/classes-overview.js`
5. `assets/js/lesson-library.js`

## Cenarios principais

1. Abrir `turmas.html` com turmas criadas.
2. Alternar filtros: `Todas`, `Com atividades`, `Sem atividades`, `Com slides/aula`, `Com quiz`.
3. Confirmar que o resumo abaixo dos filtros muda conforme o filtro ativo.
4. Clicar em `Ver materiais` e validar que abre `turma.html#atividades-salvas` na turma certa.
5. Clicar em `Criar material` e validar que abre `index.html#activity-toolkit` com turma selecionada.
6. Em `turma.html`, alternar filtros e validar contadores, cards e resumo.
7. Em `biblioteca.html`, alternar filtros e validar contadores, cards e resumo.
8. Excluir ou mover materiais e validar re-hidratacao da tela sem reload manual.

## Comportamento esperado

1. Filtro ativo sempre com `aria-pressed="true"`.
2. Filtros inativos com `aria-pressed="false"`.
3. Filtro sem itens fica desabilitado quando nao estiver ativo.
4. Se um filtro ativo ficar vazio apos mudanca de dados, a tela volta para `Todos/Todas`.
5. Nenhum card deve quebrar layout quando nome da turma tiver caracteres especiais.
6. Acoes principais (`Ver materiais`, `Criar material`, `Editar`, `Apresentar`) continuam funcionais.

## Acessibilidade rapida

1. Navegar filtros so com teclado (`Tab`, `Enter`, `Space`).
2. Confirmar foco visivel em cada botao de filtro.
3. Confirmar que `skip-link` aparece no foco e leva para `main`.
4. Confirmar `main` com `id="main-content"` e `tabindex="-1"` nas telas do escopo.

## Observacoes

1. Este checklist cobre regressao funcional e de UX basica.
2. Auditoria automatica (Lighthouse/axe) continua recomendada como etapa seguinte.
