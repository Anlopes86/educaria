# Schemas de Geração

Este documento define o formato esperado da geração de conteúdo da plataforma `EducarIA`.

O objetivo é simples:
- fontes externas fornecem referência
- a IA organiza e adapta
- a plataforma salva em formato estruturado

## 1. Aula

```json
{
  "id": "lesson_001",
  "teacher_id": "teacher_12",
  "class_id": "class_8b",
  "subject": "Inglês",
  "title": "Has Technology Changed Education?",
  "theme": "Technology and education",
  "grade_label": "8º ano B",
  "duration_minutes": 50,
  "difficulty": "intermediário",
  "status": "draft",
  "objective": "Discutir mudanças na educação usando present perfect em contexto.",
  "bncc_refs": [
    {
      "code": "EF08LI01",
      "description": "Identificar usos da língua em práticas orais e escritas relacionadas ao cotidiano."
    }
  ],
  "source_refs": [
    {
      "source_id": "bncc_ef08li01",
      "type": "bncc"
    }
  ],
  "materials": [
    "Slides",
    "Quiz final"
  ],
  "blocks": [
    {
      "id": "block_1",
      "type": "opening",
      "title": "Imagem + pergunta-gatilho",
      "duration_minutes": 5,
      "content": "Compare duas cenas de sala de aula.",
      "teacher_notes": "Pedir respostas curtas primeiro.",
      "student_output": "Resposta oral"
    },
    {
      "id": "block_2",
      "type": "explanation",
      "title": "Present perfect em contexto",
      "duration_minutes": 10,
      "content": "Apresentar exemplos ligados a escola e tecnologia.",
      "teacher_notes": "Modelar 3 frases antes da prática."
    },
    {
      "id": "block_3",
      "type": "activity",
      "title": "Debate em duplas",
      "duration_minutes": 15,
      "content": "Perguntas guiadas para comparação.",
      "teacher_notes": "Circular pela sala e corrigir oralmente.",
      "student_output": "Troca oral em duplas"
    },
    {
      "id": "block_4",
      "type": "quiz",
      "title": "Checagem final",
      "duration_minutes": 8,
      "quiz_id": "quiz_77"
    }
  ],
  "presentation_mode": {
    "enabled": true,
    "slide_count": 12
  },
  "created_at": "2026-03-30T14:20:00Z",
  "updated_at": "2026-03-30T14:40:00Z"
}
```

## 2. Tipos de bloco

Blocos aceitos na primeira versão:
- `opening`
- `explanation`
- `guided_practice`
- `activity`
- `discussion`
- `reading`
- `writing`
- `flashcards`
- `quiz`
- `closing`

Campos mínimos por bloco:

```json
{
  "id": "block_1",
  "type": "opening",
  "title": "Abertura",
  "duration_minutes": 5,
  "content": "Texto principal do bloco"
}
```

Campos opcionais:

```json
{
  "teacher_notes": "Orientação curta para o professor",
  "student_output": "O que o aluno produz",
  "resource_refs": ["img_01", "text_04"],
  "assessment_focus": "O que observar",
  "differentiation": "Como adaptar"
}
```

## 3. Quiz

```json
{
  "id": "quiz_77",
  "lesson_id": "lesson_001",
  "title": "Present Perfect Check",
  "instructions": "Choose the best answer.",
  "question_count": 5,
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "prompt": "She ____ finished her homework.",
      "options": ["have", "has", "is", "do"],
      "correct_answer": "has",
      "explanation": "Use 'has' with she/he/it."
    }
  ]
}
```

Tipos de questão da primeira versão:
- `multiple_choice`
- `true_false`
- `short_answer`

## 4. Slides

```json
{
  "id": "slides_001",
  "lesson_id": "lesson_001",
  "title": "Has Technology Changed Education?",
  "slides": [
    {
      "id": "slide_1",
      "type": "cover",
      "title": "Has Technology Changed Education?",
      "body": "Observe as imagens e pense no que mudou.",
      "teacher_notes": "Use este slide como aquecimento."
    },
    {
      "id": "slide_2",
      "type": "content",
      "title": "Present perfect in context",
      "body": "Examples about school and technology.",
      "teacher_notes": "Modelar oralmente antes de pedir respostas."
    }
  ]
}
```

Tipos de slide da primeira versão:
- `cover`
- `content`
- `question`
- `image_prompt`
- `instructions`
- `quiz`
- `closing`

## 5. Flashcards

```json
{
  "id": "flashcards_001",
  "lesson_id": "lesson_001",
  "title": "Technology Vocabulary",
  "cards": [
    {
      "id": "card_1",
      "front": "keyboard",
      "back": "teclado",
      "example": "The keyboard is on the desk."
    }
  ]
}
```

## 6. Fontes externas

```json
{
  "id": "bncc_ef08li01",
  "type": "bncc",
  "title": "Habilidade BNCC",
  "code": "EF08LI01",
  "subject": "Inglês",
  "grade_range": "8º ano",
  "description": "Descrição da habilidade.",
  "source_url": "https://...",
  "license": "publica",
  "tags": ["speaking", "grammar", "technology"]
}
```

Tipos esperados:
- `bncc`
- `curriculo_estadual`
- `questao`
- `texto`
- `imagem`
- `modelo_interno`

Materiais salvos na biblioteca tambem preservam metadados leves:

- `bnccCodes`: codigos detectados em titulo, resumo ou rascunho, como `EF08LI01` e `EM13LGG101`
- `tags`: marcadores pedagogicos inferidos, como `avaliacao`, `revisao`, `argumentacao`, `vocabulario` e `organizacao`

Esses metadados entram na busca da biblioteca e aparecem como chips nos cards.

## 7. Fluxo esperado

1. Professor informa turma, tema, tempo e objetivo.
2. Sistema consulta BNCC e outras fontes externas.
3. IA recebe contexto curricular e regras da plataforma.
4. IA devolve aula estruturada em JSON.
5. Plataforma salva como rascunho.
6. Professor revisa, edita e publica.

## 8. Regra central

A IA não deve devolver texto corrido sem estrutura.

Ela deve devolver objetos reutilizáveis para:
- editor
- apresentação
- quiz
- flashcards
- duplicação
- histórico de versões
