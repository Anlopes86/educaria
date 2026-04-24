# Checkout e Plano Pro

A EducarIA tem um fluxo inicial de checkout assistido pelo backend. Ele ainda e agnostico ao provedor, mas ja tira o link solto do frontend e cria um ponto unico para pagamento e webhook.

## Configuracao do backend

No `ai-service/.env`:

```env
BILLING_CHECKOUT_URL=https://checkout.example.com/educaria-pro
BILLING_WEBHOOK_SECRET=troque_por_um_token_longo
BILLING_STORE_PATH=.data/billing-events.json
```

Quando o professor clica em `Ir para pagamento`, o frontend chama:

```txt
POST /api/billing/checkout
```

O backend exige Firebase ID token, cria uma `external_reference` no formato `educaria:{uid}:{assinatura}` e devolve a URL do checkout com `teacher_uid`, `external_reference` e `email` nos query params.

## Webhook

Configure o provedor para chamar:

```txt
POST /api/billing/webhook
```

Inclua o header:

```txt
X-Educaria-Webhook-Secret: troque_por_um_token_longo
```

Payload minimo aceito:

```json
{
  "provider": "stripe",
  "data": {
    "status": "paid",
    "teacher_uid": "UID_DO_FIREBASE",
    "external_reference": "educaria:UID_DO_FIREBASE:assinatura",
    "email": "professor@escola.com"
  }
}
```

Tambem sao tratados status como `approved`, `completed`, `checkout.session.completed` e `payment_intent.succeeded`.

Ao receber pagamento confirmado, o backend grava o UID em `BILLING_STORE_PATH` e passa a considerar esse professor como `pro` no limite de IA.

## Fluxo recomendado para producao

1. Criar checkout no provedor escolhido, como Stripe ou Mercado Pago.
2. Configurar `BILLING_CHECKOUT_URL` no backend.
3. Receber o webhook no backend.
4. Validar assinatura/pagamento no servidor.
5. Atualizar `teachers/{uid}.plan = "pro"` ou uma custom claim Firebase quando a integracao estiver conectada ao Admin SDK.
6. Usar a claim ou o campo persistido para definir limites de IA no backend.

## Estado atual

- O backend de IA aceita plano via custom claim (`plan`, `educaria_plan`, `subscription_plan` ou `https://educaria.app/plan`) e via allowlist `AI_PRO_UIDS`.
- O backend tambem aceita UIDs promovidos pelo webhook em `BILLING_STORE_PATH`.
- O frontend mostra saldo e limites retornados por `GET /api/ai/credits`.
- A solicitacao manual de upgrade ainda grava `billingIntent` no Firestore.
