# Apresentações e destinos dos materiais

## Rodada de 02/10/2026

### Apresentação

- A atividade incorporada à aula completa usa uma única linha de conteúdo: o cabeçalho oculto não deve reservar uma linha vazia.
- Flashcards têm uma área própria de ações, dimensionamento do texto também em cartões baixos e rolagem no verso quando o conteúdo excede o espaço legível.
- Grades de palavras cruzadas consideram largura e altura disponíveis. A numeração das pistas é única.
- Caça-palavras dimensiona a fonte conforme as células. Termo e pista têm hierarquias distintas.
- Os dois jogos de palavras oferecem “Ampliar grade” / “Ver grade inteira”. Ampliar permite rolagem explícita do tabuleiro, sem forçar uma fonte minúscula.
- A forca aceita apenas letras individuais não tratadas por outros controles. T/F são letras do jogo, não atalhos globais. Setas não contam como tentativas.
- Espaço nos flashcards vira o cartão; Enter/Espaço sobre botões preservam a ação do botão em foco.
- A roleta usa números quando há muitas opções ou textos longos; a lista lateral mantém o conteúdo completo e continua editável. O resultado sorteado tem destaque próprio.
- Em janelas baixas, o roteiro da aula completa fica mais compacto sem desaparecer. O alfabeto da forca fica ao lado do desenho.

### Salvar e copiar

O editor e “Adicionar à turma” usam a janela de destinos. A lista inclui todas as turmas disponíveis e a biblioteca pessoal, com busca e seleção múltipla.

Ao salvar pelo editor, a indicação “Atualiza este material” identifica o destino original. Outros destinos recebem cópias com IDs independentes. Ao adicionar pela biblioteca, o original é preservado. Cada cópia pode ser editada sem modificar as outras.

As cópias são persistidas juntas no armazenamento local antes das solicitações de sincronização. A janela diferencia “Salvo na conta” de “Salvo neste computador · sincronização pendente”. Repetir a sincronização reutiliza os mesmos IDs. Fechar a janela depois do salvamento local não apaga as cópias pendentes.

Não há redirecionamento automático antes da confirmação. O professor conclui a janela e permanece no contexto atual. Materiais existentes preservam sua turma durante a montagem do registro, mesmo quando outra turma foi selecionada anteriormente.

### Validação

- 51 testes automatizados do front, incluindo seleção múltipla, IDs únicos, preservação do original, atualização no destino correto, seleção inválida, ausência de turmas, falha de armazenamento, repetição de sincronização e atalhos.
- Checagens de sintaxe, referências locais, traduções e espaços em branco.
- Conferência visual local dos 11 formatos dentro da aula completa em 1366 × 768; casos de altura reduzida em 1280 × 600, incluindo flashcards, forca e grades.
- Teste manual de biblioteca, editor de quiz e editor de aula completa com duas turmas fictícias e conexão remota bloqueada.
- Verificação dos atalhos da forca, ocultação/restauração de controles, ampliação das palavras cruzadas e roleta em 390 × 844.

Os testes no navegador usam dados fictícios. A confirmação remota foi coberta com testes simulados, sem gravar no Firebase de produção. Uma TV física, o fluxo completo em outros navegadores e todas as combinações de conteúdo continuam exigindo validação adicional.

### Próxima rodada visual

Ainda não foram implementados todos os refinamentos da análise: numeração/progresso da memória, hierarquia do quiz, novos ajustes por formato e preservação do progresso ao trocar e retornar a blocos da aula completa são itens separados.
