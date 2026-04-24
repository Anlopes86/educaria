# Checkout e Plano Pro

A EducarIA ainda nao tem uma integracao fechada com gateway de pagamento. A pagina de configuracoes ja esta preparada para exibir um link externo de checkout quando ele for configurado.

## Configuracao temporaria

Use uma das opcoes:

```js
window.EDUCARIA_BILLING_CHECKOUT_URL = "https://checkout.example.com/educaria-pro";
```

ou:

```js
localStorage.setItem("educaria:billing:checkout-url", "https://checkout.example.com/educaria-pro");
```

Quando a URL existir, o botao `Ir para pagamento` aparece em `plataforma/configuracoes.html`.

## Fluxo recomendado para producao

1. Criar checkout no provedor escolhido, como Stripe ou Mercado Pago.
2. Enviar o usuario autenticado para o checkout com identificador seguro do professor.
3. Receber o webhook no backend.
4. Validar assinatura/pagamento no servidor.
5. Atualizar `teachers/{uid}.plan = "pro"` ou uma custom claim Firebase.
6. Usar a claim ou o campo persistido para definir limites de IA no backend.

## Estado atual

- O backend de IA aceita plano via custom claim (`plan`, `educaria_plan`, `subscription_plan` ou `https://educaria.app/plan`) e via allowlist `AI_PRO_UIDS`.
- O frontend mostra saldo e limites retornados por `GET /api/ai/credits`.
- A solicitacao manual de upgrade ainda grava `billingIntent` no Firestore.
