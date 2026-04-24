# Regressao de i18n

Use este comando antes de publicar mudancas em paginas traduzidas:

```bash
node tools/check-i18n.mjs
```

O script valida:

- JSON valido em `assets/i18n/pt-BR.json`, `en-US.json` e `es-ES.json`
- mesmas chaves nos tres idiomas
- chaves usadas em `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label` e helpers JS

Paginas ja iniciadas no i18n:

- `plataforma/configuracoes.html`
- `plataforma/biblioteca.html`
- `plataforma/index.html`

Ao traduzir uma nova pagina, carregue `assets/js/i18n.js`, marque textos estaticos com `data-i18n` e adicione as chaves nos tres dicionarios.
