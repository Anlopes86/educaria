# Arquitetura CSS

O projeto ainda usa `assets/css/estilo-premium.css` como ponto unico de entrada para preservar compatibilidade com as paginas HTML existentes.

## Estrutura atual

```txt
assets/css/
  estilo-premium.css
  base/
    tokens.css
    reset.css
    a11y.css
  components/
    buttons.css
    filters.css
    forms.css
    cards.css
    empty-state.css
    lists.css
    feedback.css
    modals.css
    navigation.css
    presentation.css
    presentation-stages.css
    debate.css
    previews.css
    toolbar.css
  layouts/
    app-shell.css
  pages/
    classes-overview.css
    home.css
    dashboard.css
    class-library.css
    auth.css
    settings.css
```

## Ordem de importacao

1. Fonte externa.
2. `base/tokens.css`: variaveis de cor, tipografia, espacamento, bordas, sombras e transicoes.
3. `base/reset.css`: box sizing e defaults globais de `body`.
4. `base/a11y.css`: skip link, foco visivel e reducao de movimento.
5. `components/buttons.css`: botoes e acoes compartilhadas.
6. `components/forms.css`: grid de formulario, campos e estados de foco.
7. `components/filters.css`: filtros de materiais e chips simples de status.
8. `components/cards.css`: cards compartilhados e superficies de destaque.
9. `components/empty-state.css`: estados vazios e mensagens de ajuda.
10. `components/lists.css`: cards de historico e listas densas.
11. `components/modals.css`: modais e janelas flutuantes.
12. `components/feedback.css`: toasts, chips e feedback inline.
13. `components/navigation.css`: shell, sidebar e navegacao lateral.
14. `components/presentation.css`: shell de apresentacao, topo e cards de palco.
15. `components/presentation-stages.css`: slides, controles e questionarios de apresentacao.
16. `components/debate.css`: controles flutuantes do debate.
17. `components/previews.css`: vitrines de materiais e previews.
18. `components/toolbar.css`: barras fixas de acao e grupos de comandos.
19. `layouts/app-shell.css`: shell principal e area de conteudo.
20. `pages/classes-overview.css`: vitrine de turmas e detalhe da turma.
21. `pages/home.css`: pagina inicial e cards de destaque.
22. `pages/dashboard.css`: painel do professor e turmas recentes.
23. `pages/class-library.css`: turma e biblioteca da turma.
24. `pages/auth.css`: telas de acesso e autenticacao.
25. `pages/settings.css`: pagina de configuracoes.
26. `pages/library.css`: biblioteca geral.
27. Estilos legados ainda mantidos em `estilo-premium.css`.

## Proximas extracoes recomendadas

1. `components/tables.css` ou `components/lists.css`: listas mais densas e historicos.
2. `components/badges.css`: estados pequenos, etiquetas e marcadores de status.
3. `components/debate.css`: controles e ajustes especificos do debate.
Ao extrair, mantenha `estilo-premium.css` como agregador ate existir um build CSS dedicado. Isso evita editar todos os HTMLs a cada etapa.
