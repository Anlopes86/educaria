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

### Refinamentos finais implementados

- A barra da apresentação destaca tela cheia e ocultação dos controles. Impressão, edição e retorno ficam em “Mais opções”, com fechamento por Escape e clique fora. O menu cabe também em telas estreitas.
- A memória mostra cartas numeradas, pares encontrados, tentativas e reinício. A grade considera largura e altura; cartas com textos muito longos permitem rolagem para não perder conteúdo.
- O quiz dá mais destaque à pergunta, amplia alternativas e oferece retorno textual além das cores. A explicação mantém o foco dentro da janela e pode ser fechada por Escape.
- O debate tem cronômetro por rodada, com iniciar, pausar e reiniciar. Trocar de rodada, sair da atividade ou ocultar a página pausa a contagem. Em janelas baixas, a diagramação prioriza a proposição, os lados e o desafio.
- Ligue os pontos tem seleção mais evidente, marca de acerto e linhas legíveis. O mapa mental reduz cabeçalhos em telas baixas para preservar o espaço da explicação com rolagem.
- Slides com imagem que falha no carregamento passam a usar a área de texto, sem manter um espaço vazio para a imagem.
- Os 11 formatos recuperam o progresso ao trocar de bloco e voltar na mesma aula completa: posição, respostas, pares, letras, resultados ou temporizadores, conforme a atividade. O cronômetro retorna pausado. Um sorteio em andamento mantém o resultado já escolhido, sem sortear novamente.

Essa retomada é temporária, na memória da apresentação: recarregar a página, fechá-la ou abrir outra apresentação inicia uma nova sessão. Não altera o conteúdo salvo nem consome créditos de IA. A troca de bloco fica protegida enquanto a próxima atividade carrega.

### Validação dos refinamentos

- 64 testes automatizados do front, incluindo captura/restauração dos 11 formatos, isolamento dos blocos, navegação durante carregamento e regras do cronômetro.
- Sintaxe, referências locais, traduções e espaços em branco verificados.
- Conferência local do quiz, memória, debate, ligue os pontos e mapa mental, incluindo janela de 1280 × 600; menu e quiz em 390 × 844.
- Ocultação dos controles, navegação por teclado, feedback de verdadeiro/falso, fechamento da explicação e retomada entre blocos conferidos com dados fictícios.

Conteúdos excepcionalmente longos ainda podem precisar de rolagem. Não houve consumo de IA nem gravação em turmas reais durante os testes.
