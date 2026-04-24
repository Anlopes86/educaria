# Regressao Automatica (22/04/2026)

## Escopo validado

1. `assets/js/classes-overview.js`
2. `assets/js/lesson-library.js`
3. `plataforma/turmas.html`
4. `plataforma/turma.html`
5. `plataforma/biblioteca.html`
6. `assets/css/estilo-premium.css`

## Resultado

1. Sintaxe JS (`node --check`): **OK**
2. Seletores de filtros nas 3 telas (`turmas`, `turma`, `biblioteca`): **OK**
3. Vínculo de ações para seleção de turma (`saveSelectedClass`): **OK**
4. Eventos de tracking de troca de filtro: **OK**
5. Hardening de nome de turma com `encodeURIComponent/decodeURIComponent`: **OK**
6. Busca por texto corrompido (mojibake) no escopo alterado: **OK**

## Evidências rápidas

1. `classes_overview_filter_changed`, `class_material_filter_changed`, `library_material_filter_changed` presentes.
2. `aria-pressed` aplicado nos botões de filtro.
3. Contêineres de filtros presentes em:
   - `plataforma/turmas.html`
   - `plataforma/turma.html`
   - `plataforma/biblioteca.html`

## Pendente (manual)

1. Validar navegação real no navegador:
   - `turmas` -> `Ver materiais` -> `turma`
   - `turmas` -> `Criar material` -> `index#activity-toolkit`
2. Confirmar comportamento visual final dos filtros em mobile.
3. Rodar auditoria Lighthouse/axe.
