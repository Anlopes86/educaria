# IA para Builders

Este projeto agora tem uma base para ligar IA real aos builders de `slides` e `quiz`.

## O que foi implementado primeiro

A ordem escolhida foi:

1. definir como a IA trabalha
2. definir o JSON esperado por cada ferramenta
3. criar um backend para proteger a chave da API
4. integrar os builders do frontend

Isso evita conectar uma API sem contrato claro.

## Arquivos principais

- `assets/js/ai-material-generator.js`
- `ai-service/server.js`
- `ai-service/.env.example`
- `ai-service/package.json`

## Como funciona

1. O professor cola um texto ou envia um arquivo no builder.
2. O frontend envia isso para `POST /api/ai/generate`.
3. O backend extrai texto de `.txt`, `.docx` e `.pdf`.
4. O backend chama a OpenAI.
5. A resposta volta em JSON estruturado.
6. O frontend preenche automaticamente os cards do builder.

## Como rodar

Na pasta `ai-service`:

```bash
npm install
```

Copie `.env.example` para `.env` e preencha:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
PORT=8787
ALLOWED_ORIGIN=http://127.0.0.1:5500
```

Depois:

```bash
npm run dev
```

## Como servir junto do frontend

Se o frontend estiver em outra porta, crie um proxy ou ajuste a chamada do frontend para apontar para o backend.

Hoje o frontend usa:

```txt
/api/ai/generate
```

Opcionalmente, vocês podem definir antes do script:

```html
<script>
  window.EDUCARIA_AI_ENDPOINT = "http://localhost:8787/api/ai/generate";
</script>
```

Se vocês abrirem o HTML por um servidor local separado, o mais simples é:

- servir frontend e backend no mesmo domínio via proxy, ou
- definir `window.EDUCARIA_AI_ENDPOINT`

## Fallback atual

Se a API falhar:

- o quiz tenta cair no gerador local existente
- os slides usam uma estruturação local simples

Assim o produto não trava enquanto a infraestrutura real não estiver pronta.

## Próximos passos recomendados

1. adicionar geração de `flashcards`
2. salvar o JSON estruturado no banco
3. incluir metadados como turma, disciplina e ano no prompt
4. validar melhor arquivos escaneados e PDFs com pouco texto
