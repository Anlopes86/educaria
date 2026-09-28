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
5. O backend chama o Groq para gerar o texto estruturado. Enquanto a chave do Groq não estiver configurada, o modo `auto` mantém o Gemini como alternativa temporária.
6. A resposta volta em JSON estruturado.
7. O frontend preenche automaticamente os cards do builder.

## Como rodar

Na pasta `ai-service`:

```bash
npm install
```

Copie `.env.example` para `.env` e preencha:

```env
AI_TEXT_PROVIDER=auto
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-120b
GROQ_REASONING_EFFORT=low
GROQ_MAX_PROMPT_TOKENS=4000
GROQ_MAX_COMPLETION_TOKENS=3500
GROQ_REQUEST_TIMEOUT_MS=90000
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
AI_AUTH_REQUIRED=true
FIREBASE_PROJECT_ID=your_firebase_project_id_here
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=8
AI_GLOBAL_RATE_LIMIT_MAX=4
AI_USER_RATE_LIMIT_MAX=2
AI_GLOBAL_DAILY_REQUEST_LIMIT=16
AI_USER_DAILY_REQUEST_LIMIT_FREE=2
AI_USER_DAILY_REQUEST_LIMIT_PRO=4
AI_GENERATION_MAX_ATTEMPTS=1
AI_PROVIDER_DAILY_TIME_ZONE=UTC
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
AI_CREDIT_STORE=firestore
AI_CREDIT_STORE_PATH=.data/ai-credits.json
AI_CREDIT_FIRESTORE_DATABASE=(default)
AI_CREDIT_FIRESTORE_COLLECTION=aiCreditUsage
AI_CREDIT_RESERVATION_TTL_MS=3600000
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
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

O custo não depende do tipo da atividade. Depois que o provedor conclui a geração, o backend lê o consumo real de tokens e calcula o gasto:

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

O saldo é sempre associado ao `uid` validado no token do Firebase. Assim, cada professor tem seu próprio consumo mesmo que todos usem a mesma chave do provedor. O mesmo usuário também mantém o mesmo saldo ao trocar de computador ou celular.

A chave e a cota do provedor continuam sendo compartilhadas pelo serviço inteiro. O saldo individual da EducarIA controla quanto cada usuário pode consumir, mas não cria uma cota separada no Groq para cada professor.

Por isso, a plataforma também mantém uma cota diária de requisições ao provedor. Durante a migração, a configuração permanece conservadora para permitir testes reais sem colocar toda a cota gratuita em risco:

- `AI_GLOBAL_DAILY_REQUEST_LIMIT=16`: mantém uma trava global conservadora durante os primeiros testes com o novo provedor;
- `AI_USER_DAILY_REQUEST_LIMIT_FREE=2`: impede um único professor gratuito de consumir toda a cota;
- `AI_USER_DAILY_REQUEST_LIMIT_PRO=4`: permite uma cota maior ao plano Pro, ainda subordinada ao limite global;
- `AI_GLOBAL_RATE_LIMIT_MAX=4`: evita rajadas coletivas enquanto o comportamento do novo modelo é medido;
- `AI_USER_RATE_LIMIT_MAX=2`: impede rajadas de um único professor;
- `AI_GENERATION_MAX_ATTEMPTS=1`: evita que uma única ação consuma duas chamadas por causa de uma nova tentativa automática.

As cotas diária global e individual usam reservas atômicas na mesma coleção do Firestore. Uma chamada que chegou ao provedor é contabilizada mesmo quando a resposta do modelo falha, pois ela também consome a cota externa. Os créditos ponderados do usuário, por outro lado, são devolvidos quando não há material aproveitável.

O limite diário é renovado à meia-noite no fuso definido por `AI_PROVIDER_DAILY_TIME_ZONE` (`UTC` por padrão para o Groq). A resposta de `GET /api/ai/credits` inclui `credits.requests`, com o saldo individual e o saldo global da plataforma.

## Ativar o Groq no Render

1. Crie uma conta em `https://console.groq.com` e gere uma API key.
2. Abra o serviço `educaria-api-anlopes86` no Render.
3. Entre em **Environment** e adicione `GROQ_API_KEY` com a chave gerada.
4. Confirme que `AI_TEXT_PROVIDER` está como `auto` e salve as alterações.
5. Aguarde o novo deploy e abra `/api/health` para confirmar que o serviço está funcionando.
6. Gere uma atividade de teste e confira no retorno da requisição se `charge.provider` é `groq`.

Nunca coloque a chave no frontend, no GitHub ou nesta documentação. No modo `auto`, a presença de `GROQ_API_KEY` ativa o Groq para textos. O Gemini continua disponível como retorno rápido e também permanece responsável por imagens enquanto `AI_IMAGE_GENERATION_ENABLED=true`. Para forçar um provedor específico, use `AI_TEXT_PROVIDER=groq` ou `AI_TEXT_PROVIDER=gemini`.

O limite de entrada do Groq gratuito é protegido por `GROQ_MAX_PROMPT_TOKENS`. Quando um arquivo ultrapassa esse valor, o professor recebe uma mensagem para reduzir o conteúdo e nenhuma chamada é enviada ao provedor.

Em produção, use `AI_CREDIT_STORE=firestore`. O serviço grava um documento diário por usuário e faz reservas e acertos em operações atômicas. Isso impede que duas gerações simultâneas do mesmo professor gastem o mesmo saldo. Também permite executar mais de uma instância do backend sem perder a separação dos usuários.

No Render, adicione como variável secreta uma das opções abaixo:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

ou o mesmo JSON codificado em Base64:

```env
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=...
```

Essa credencial deve pertencer ao mesmo projeto definido em `FIREBASE_PROJECT_ID`, com permissão de leitura e escrita no Firestore. Nunca coloque o JSON da conta de serviço no frontend, no GitHub ou em um arquivo público. Em ambientes do Google Cloud com credenciais padrão da aplicação, as duas variáveis podem ficar vazias.

Os documentos recebem o campo `expiresAt`. É recomendável habilitar uma política de TTL para esse campo no Firestore, mantendo o banco limpo automaticamente. A exclusão de conta também remove os registros de crédito daquele UID.

Para desenvolvimento local, `AI_CREDIT_STORE=memory` mantém o contador apenas no processo do `ai-service`.

Para persistir o consumo entre reinicios em uma instalacao simples, use:

```env
AI_CREDIT_STORE=file
AI_CREDIT_STORE_PATH=.data/ai-credits.json
```

O modo `file` grava um JSON local e remove dias antigos automaticamente. Ele resolve reinícios em uma instalação simples, mas não é indicado para o Render nem para várias instâncias ao mesmo tempo.

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
