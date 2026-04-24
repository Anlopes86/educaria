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
  layouts/
    app-shell.css
  pages/
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
8. `layouts/app-shell.css`: shell, sidebar, navegacao lateral e area principal.
9. `pages/settings.css`: pagina de configuracoes.
10. Estilos legados ainda mantidos em `estilo-premium.css`.

## Proximas extracoes recomendadas

1. `pages/dashboard.css`: painel do professor e tour.
2. `pages/class-library.css`: turmas, turma e biblioteca.
3. `components/cards.css`: `.focus-card`, `.platform-builder-card` e cards de historico.
4. `components/modals.css`: modais de quiz, preview e tour.
5. `components/feedback.css`: toasts, feedbacks de formulario e estados vazios.

Ao extrair, mantenha `estilo-premium.css` como agregador ate existir um build CSS dedicado. Isso evita editar todos os HTMLs a cada etapa.
