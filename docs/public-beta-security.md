# Segurança do beta público

## Comportamento da aplicação

- Geração e refinamento com IA exigem sessão ativa e a confirmação de e-mail do Firebase, verificada no servidor antes de upload ou reserva de créditos. Biblioteca, edição manual, backup e exclusão continuam disponíveis sem confirmação.
- Novos cadastros recebem um pedido de confirmação. Contas existentes podem enviá-lo pelo aviso no painel; não há envio em massa. O botão **Já confirmei** atualiza a sessão.
- O backup local filtra eventos pelo professor atual e cancela se a conta mudar durante a exportação. Não contém credenciais de login.
- O consumo só é tratado como medido quando os contadores necessários foram informados. Uma resposta recuperada de erro do provedor pode não conter tokens; nesse caso o usuário não é cobrado e a reserva conservadora da plataforma é mantida. O relatório diferencia ausência de medição de consumo zero.

## App Check: implantação em etapas

O código suporta App Check, mas a presença do SDK não significa proteção obrigatória.

1. Ativar a API reCAPTCHA Enterprise no projeto `educaria-f46b2`, após o responsável aceitar os termos apresentados pelo Google. Manter o plano Spark; esta configuração não exige contratar faturamento.
2. Criar chave Web baseada em pontuação, com domínio `anlopes86.github.io`. Não liberar todos os domínios nem adicionar localhost à chave de produção.
3. Registrar a aplicação Web no App Check com essa chave e publicar seu identificador público em `assets/js/app-security.js`. A chave do site é pública; tokens de depuração não são.
4. No Render, definir `APP_CHECK_MODE=monitor` e `FIREBASE_WEB_APP_ID=1:856146928482:web:2d5a5aa8b868ef19b1c23b`. A ausência da variável de modo usa monitor. O modo enforce exige o ID da aplicação.
5. Confirmar no navegador real login, leitura/gravação de materiais e tokens aceitos. Observar métricas antes de exigir a proteção.
6. Só então definir `APP_CHECK_MODE=enforce` no Render e habilitar enforcement dos serviços Firebase usados, um por vez. Uma página antiga precisa ser recarregada. Não ativar cobrança ou Identity Platform como parte desta etapa sem decisão do responsável.

Webhooks de pagamento e acompanhamento de exclusão com comprovante possuem autenticação própria e não exigem App Check. App Check não substitui regras por UID, confirmação de e-mail, limites ou validação de sessão.

Referência: [Firebase App Check para Web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).

## Verificações de produção

Em 26/10/2026, foram confirmados no Render: armazenamento de créditos em Firestore; limites globais de 180.000 tokens/dia e 900 pedidos/dia; 4 gerações/minuto para a plataforma e 2/minuto por usuário; 500 créditos/dia para conta gratuita. O dia do provedor usa UTC.

No console autenticado da organização Personal no Groq, o modelo `openai/gpt-oss-120b` tem 30 pedidos/minuto, 1.000 pedidos/dia, 8.000 tokens/minuto e 200.000 tokens/dia. Os tetos diários da EducarIA deixam margem, mas o controle de pedidos por minuto não garante ficar dentro dos tokens por minuto: pedidos grandes simultâneos podem receber 429 e exigir espera. A cota do Groq é compartilhada com outros usos da mesma organização. Referência: [limites do Groq](https://console.groq.com/docs/rate-limits).

O reCAPTCHA Enterprise foi ativado com autorização do responsável e sem vincular faturamento. A chave de produção permite somente `anlopes86.github.io`, sem desafios e sem modo de teste. A aplicação Web foi registrada no App Check com validade de uma hora e pontuação mínima padrão de 0,5. A publicação da chave inicia a coleta de atestações; a exigência depende da validação em produção. Os diagnósticos de navegador registram apenas sucesso/falha, nunca o token.

Os verificadores `ai-service/tools/production-security-smoke.mjs` e `production-deletion-smoke.mjs` criam identificadores aleatórios próprios e nunca recebem um usuário existente como alvo. Validam leitura entre contas, promoção indevida de plano, sessões revogadas/desativadas, bloqueio durante exclusão e remoção completa. Nunca imprimem credenciais ou tokens.

O verificador de segurança aceita `--expect-verified-email` para confirmar o bloqueio antes de qualquer chamada de IA e `--with-app-check` para usar um token administrativo de teste após enforcement. Esse token testa a verificação no servidor; não substitui o teste de atestação pelo navegador real.

Os relatórios, backups, credenciais, anexos e capturas de auditoria ficam fora do Git. A rotina de publicação permite somente arquivos estáticos públicos.
