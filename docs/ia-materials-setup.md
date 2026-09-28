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
3. O backend valida tamanho, extensao, MIME e assinatura basica do arquivo.
4. O backend extrai texto de `.txt`, `.docx`, `.rtf` e `.pdf`.
5. O backend chama o Gemini.
6. A resposta volta em JSON estruturado.
7. O frontend preenche automaticamente os cards do builder.

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
AI_USAGE_DAILY_CREDIT_LIMIT=1000
AI_USAGE_DAILY_CREDIT_LIMIT_FREE=1000
AI_USAGE_DAILY_CREDIT_LIMIT_PRO=4000
AI_CREDIT_TOKENS_PER_CREDIT=100
AI_CREDIT_INPUT_WEIGHT=1
AI_CREDIT_OUTPUT_WEIGHT=3
AI_CREDIT_THOUGHT_WEIGHT=3
AI_CREDIT_MINIMUM_CHARGE=1
AI_CREDIT_PROMPT_OVERHEAD_TOKENS=600
AI_CREDIT_ESTIMATED_OUTPUT_TOKENS=1200
AI_CREDIT_IMAGE_OUTPUT_CREDITS=100
AI_CREDIT_STORE=memory
AI_CREDIT_STORE_PATH=.data/ai-credits.json
AI_PRO_UIDS=uid1,uid2
AI_MAX_UPLOAD_MB=5
AI_JSON_LIMIT=2mb
AI_IMAGE_GENERATION_ENABLED=false
TRUST_PROXY=true
PORT=8787
ALLOWED_ORIGIN=http://127.0.0.1:5500
```

O backend exige autenticacao por padrao e aceita chamadas de IA somente com um Firebase ID token valido no header `Authorization: Bearer ...`. O frontend dos builders ja envia esse token a partir do usuario logado. Em producao, o servico interrompe a inicializacao se a autenticacao estiver desativada, se `FIREBASE_PROJECT_ID` estiver ausente ou se `ALLOWED_ORIGIN` for permissivo.

`AI_USAGE_DAILY_CREDIT_LIMIT_FREE` e `AI_USAGE_DAILY_CREDIT_LIMIT_PRO` definem os saldos diários por plano. Se as novas variáveis não existirem, os limites antigos de 5/20 gerações são convertidos automaticamente para a nova escala de 1000/4000 créditos.

O custo não depende do tipo da atividade. Depois que o Gemini conclui a geração, o backend lê `usageMetadata` e calcula o consumo real:

| Parte do processamento | Peso padrão |
| --- | --- |
| Tokens do conteúdo e das instruções enviadas | 1x |
| Tokens da resposta produzida | 3x |
| Tokens de raciocínio informados pelo modelo | 3x |

A cada 100 tokens ponderados, 1 crédito é consumido. Os pesos e a quantidade de tokens por crédito são configuráveis pelas variáveis `AI_CREDIT_*`. Uma aula completa é medida bloco a bloco, porque cada bloco corresponde a uma chamada real ao modelo.

O plano pode ser resolvido por:

- claim `plan=pro` no Firebase ID token
- UID listado em `AI_PRO_UIDS` (fase inicial)

Cada chamada válida para `POST /api/ai/generate` faz uma reserva estimada com base no tamanho do conteúdo. Ao terminar, o backend substitui a reserva pelo custo real retornado pelo modelo. Se a geração falhar, a reserva é devolvida integralmente. Essa reserva evita que várias requisições simultâneas usem o mesmo saldo.

Por padrao, `AI_CREDIT_STORE=memory` mantem o contador no processo do `ai-service`.

Para persistir o consumo entre reinicios em uma instalacao simples, use:

```env
AI_CREDIT_STORE=file
AI_CREDIT_STORE_PATH=.data/ai-credits.json
```

O modo `file` grava um JSON local e remove dias antigos automaticamente. Ele resolve o problema de reinicio do servico e a reserva de credito evita corrida dentro de uma unica instancia Node. Ainda nao e o armazenamento ideal para varias instancias rodando ao mesmo tempo. Para controle financeiro mais rigido em producao horizontal, mova esse contador para Redis, Firestore via Admin SDK ou outro banco de servidor com incremento atomico.

No frontend, `assets/js/ai-credits.js` consulta `GET /api/ai/credits`, mostra o saldo atualizado em todos os elementos com `data-ai-credits` e expõe `ensureEducariaAiCreditsAvailable()`. O custo exato aparece somente depois da geração, pois vem do consumo medido pelo provedor.

Na pagina de configuracoes, o botao de pagamento aparece somente quando houver uma URL configurada em `window.EDUCARIA_BILLING_CHECKOUT_URL` ou no `localStorage` com a chave `educaria:billing:checkout-url`. Esse link deve apontar para um checkout criado por Stripe, Mercado Pago ou outro provedor, e o webhook do provedor ainda precisa atualizar `teachers/{uid}.plan` ou as claims do Firebase.

No Free Tier, mantenha `AI_IMAGE_GENERATION_ENABLED=false`. A geração automática de imagens fica desabilitada, e o professor pode enviar uma imagem real em JPG, PNG ou WebP. A plataforma otimiza a imagem no próprio navegador antes de salvá-la no material.

## Uploads aceitos

O limite de tamanho vem de `AI_MAX_UPLOAD_MB` e o padrao e 5 MB. O backend aceita apenas arquivos com extensao e MIME coerentes para:

- `.txt`
- `.docx`
- `.rtf`
- `.pdf`

Antes da extracao, o backend tambem confere assinaturas simples de RTF, DOCX/ZIP e PDF. Arquivos com extensao trocada ou formato desconhecido retornam `400` com mensagem de arquivo nao suportado. Os campos de upload do frontend foram alinhados para nao oferecer `.doc`, porque o servico nao extrai Word legado.

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
