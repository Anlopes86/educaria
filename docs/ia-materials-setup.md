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
4. O backend chama o Gemini.
5. A resposta volta em JSON estruturado.
6. O frontend preenche automaticamente os cards do builder.

## Como rodar

Na pasta `ai-service`:

```bash
npm install
```

Copie `.env.example` para `.env` e preencha:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
AI_AUTH_REQUIRED=true
FIREBASE_PROJECT_ID=your_firebase_project_id_here
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=8
AI_DAILY_CREDIT_LIMIT=5
AI_DAILY_CREDIT_LIMIT_FREE=5
AI_DAILY_CREDIT_LIMIT_PRO=20
AI_PRO_UIDS=uid1,uid2
AI_MAX_UPLOAD_MB=5
AI_JSON_LIMIT=2mb
AI_IMAGE_GENERATION_ENABLED=false
TRUST_PROXY=true
PORT=8787
ALLOWED_ORIGIN=http://127.0.0.1:5500
```

Com `AI_AUTH_REQUIRED=true`, o backend aceita chamadas de IA somente com um Firebase ID token valido no header `Authorization: Bearer ...`. O frontend dos builders ja envia esse token a partir do usuario logado.

`AI_DAILY_CREDIT_LIMIT` funciona como fallback.

`AI_DAILY_CREDIT_LIMIT_FREE` e `AI_DAILY_CREDIT_LIMIT_PRO` definem limites diarios por plano.

O plano pode ser resolvido por:

- claim `plan=pro` no Firebase ID token
- UID listado em `AI_PRO_UIDS` (fase inicial)

Cada chamada bem-sucedida para `POST /api/ai/generate` desconta 1 credito.

O contador atual roda no processo do `ai-service` e reinicia se o servico reiniciar. Para varias instancias ou controle financeiro mais rigido, mova esse contador para Redis, Firestore via Admin SDK ou outro banco de servidor.

No frontend, `assets/js/ai-credits.js` consulta `GET /api/ai/credits`, atualiza todos os elementos com `data-ai-credits` e expõe `ensureEducariaAiCreditsAvailable()`. Os geradores chamam essa funcao antes de enviar uma nova geracao para evitar chamadas conhecidamente sem saldo.

Na pagina de configuracoes, o botao de pagamento aparece somente quando houver uma URL configurada em `window.EDUCARIA_BILLING_CHECKOUT_URL` ou no `localStorage` com a chave `educaria:billing:checkout-url`. Esse link deve apontar para um checkout criado por Stripe, Mercado Pago ou outro provedor, e o webhook do provedor ainda precisa atualizar `teachers/{uid}.plan` ou as claims do Firebase.

No Free Tier, mantenha `AI_IMAGE_GENERATION_ENABLED=false`. Os slides usam placeholder local em vez de chamar modelo de imagem.

Em deploys como Render, configure essas mesmas variaveis no painel do servico. O arquivo `.env` local nao vai para o GitHub.

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
