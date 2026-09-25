# Jornada de ouro do Quiz

O Quiz foi o formato piloto da jornada completa de criacao da EducarIA. A mesma arquitetura agora atende Slides, Flashcards, Jogo da Memoria, Forca, Roleta e Ligar Pontos pelo runtime compartilhado `assets/js/builder-journey.js`.

## Fluxo

1. O professor abre um novo Quiz pelo painel, turma, biblioteca ou menu lateral.
2. Informa turma, disciplina, ano/publico e um topico, texto ou arquivo.
3. A geracao por IA recebe esse contexto pedagogico junto das preferencias de quantidade e formato.
4. O editor grava imediatamente o HTML estruturado no armazenamento local.
5. Depois de uma pausa na edicao, o rascunho e consolidado na biblioteca de materiais e sincronizado com `teachers/{uid}/lessons/{lessonId}`.
6. O status informa se o material esta salvo na nuvem ou aguardando sincronizacao.
7. Ao salvar explicitamente, o registro passa de `draft` para `ready` e pode ser aberto pela turma ou biblioteca.
8. O professor pode editar, apresentar, renomear, duplicar para outra turma e excluir.

## Separacao entre novo e existente

Os atalhos de criacao usam `quiz-builder.html?new=1`. O editor consome esse parametro uma unica vez, limpa apenas o rascunho ativo do Quiz e remove o parametro da URL. Links de edicao continuam usando `quiz-builder.html` e recuperam o ID ativado pela biblioteca.

## Estrategia de persistencia

- `localStorage`: recuperacao imediata, inclusive durante oscilacao de internet.
- Firestore: fonte sincronizada entre dispositivos para registros consolidados.
- Autosave: grava como `draft`, com debounce para evitar escrita a cada tecla.
- Save explicito: grava como `ready` e aguarda a tentativa de persistencia remota antes de navegar.
- Retorno da internet: dispara reconciliacao da biblioteca local com o Firestore.

Os registros dos sete formatos integrados incluem `subject`, `grade` e `sourceMode` (`topic`, `file`, `mixed` ou `manual`). Esses metadados participam da busca e aparecem como chips na biblioteca.

## Eventos de produto

- `quiz_creation_started`
- `quiz_context_changed`
- `ai_generate_started`, `ai_generate_succeeded` e `ai_generate_failed`
- `quiz_autosave_succeeded` e `quiz_autosave_failed`
- `quiz_draft_recovered`
- `lesson_saved`, `lesson_editor_opened`, `lesson_presented` e `lesson_renamed`

Slides, Flashcards, Jogo da Memoria, Forca, Roleta e Ligar Pontos emitem o mesmo funil com os prefixos `slides_`, `flashcards_`, `memory_`, `hangman_`, `wheel_` e `match_`, incluindo eventos de inicio da criacao, autosave e recuperacao de rascunho.

Esses eventos permitem medir inicio da criacao, sucesso da IA, recuperacao, salvamento e chegada ao modo de apresentacao.
