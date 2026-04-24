# Checklist Rapido de Acessibilidade (WCAG)

Data de referencia: 24/04/2026

## Escopo validado

1. `login.html`
2. `cadastro.html`
3. `plataforma/index.html`
4. `plataforma/turma.html`
5. `plataforma/biblioteca.html`
6. `plataforma/configuracoes.html`

## Itens aplicados nesta rodada

1. Skip link para pular direto ao conteudo principal.
2. `main` com `id="main-content"` e `tabindex="-1"` para foco programatico.
3. `nav` lateral com `aria-label="Navegacao principal"`.
4. Melhorias de contraste em sidebar e hero do dashboard.
5. Melhor foco visivel global e suporte a `prefers-reduced-motion`.

## Checklist manual de regressao

1. Navegar so com teclado: `Tab`, `Shift+Tab`, `Enter`, `Space`, `Esc`.
2. Confirmar que o skip link aparece no foco e leva ao `main`.
3. Verificar foco visivel em botoes, links, campos e cards clicaveis.
4. Conferir contraste dos textos secundarios no sidebar e hero.
5. Testar tour do dashboard com teclado (setas e `Esc`).
6. Testar formularios de login/cadastro com `required` e `autocomplete`.
7. Validar filtros de turmas/turma/biblioteca com `aria-pressed` correto no item ativo.
8. Confirmar que elementos dinamicos de creditos IA usam `role="status"`, `aria-live="polite"` e `aria-atomic="true"`.
9. Confirmar que contagem, resumo e resultados da biblioteca anunciam mudancas com live regions e `aria-busy`.

## Proximo ciclo recomendado

1. Auditoria automatica com Lighthouse + axe nas telas de builder.
2. Revisao de contraste por token para padronizar cores sem depender de ajustes locais.
3. Revisao de semantica de icones e botoes sem texto visivel (aria-label explicito).
