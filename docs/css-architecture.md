# Arquitetura CSS

O projeto ainda usa `assets/css/estilo-premium.css` como ponto unico de entrada para preservar compatibilidade com as paginas HTML existentes.

O agregador é a referência da ordem real dos imports. A árvore abaixo mostra a organização base, não um inventário completo. As camadas visuais acrescentadas depois estão descritas ao final; não reorganize a cascata alfabeticamente.

## Organização base

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

## Ordem de importação base

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

## Camadas visuais atuais

Além dos componentes básicos, o agregador inclui estilos específicos para landing, editores, aula completa, dispositivos móveis e refinamentos de apresentação. Os arquivos `presentation-activities.css`, `presentation-refinements.css` e `presentation-fit.css` complementam os palcos. `activity-visual-system.css`, `pages/collections.css` e `components/sidebar.css` aplicam o sistema visual recente.

`account-deletion.css` e `pages/admin.css` são carregados diretamente pelas páginas correspondentes; não são arquivos sem uso por estarem fora do agregador.

## Como continuar a organização

1. Identifique o seletor e a regra vencedora antes de criar outro override.
2. Separe estilos compartilhados de exceções de uma atividade, preservando a prioridade das regras.
3. Confira notebook pequeno, topo de apresentação aberto/fechado, teclado e celular.

Classes também são criadas pelo JavaScript. Não remova seletores apenas porque não aparecem no HTML inicial. Mantenha `estilo-premium.css` como agregador até existir um build CSS dedicado e equivalência visual verificada.

## Validacao relacionada

Use `node tools/check-assets.mjs` depois de mover arquivos CSS, imagens ou scripts. O check percorre HTML/CSS e aponta referencias locais quebradas antes do deploy.

Enquanto nao houver bundler, mantenha a importacao centralizada em `estilo-premium.css`. A migracao futura deve gerar bundles por pagina a partir dos modulos atuais e preservar a ordem de importacao documentada acima.
