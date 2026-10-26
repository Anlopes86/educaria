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

Em 26/10/2026, antes desta publicação, foram confirmados: armazenamento de créditos em Firestore; limites globais de 180.000 tokens/dia e 900 pedidos/dia; 4 gerações/minuto para a plataforma e 2/minuto por usuário; 500 créditos/dia para conta gratuita. O dia do provedor usa UTC. A cota atual da organização Groq ainda precisa ser comparada no console autenticado; esses valores são limites da EducarIA, não uma garantia de capacidade do provedor.

Os verificadores `ai-service/tools/production-security-smoke.mjs` e `production-deletion-smoke.mjs` criam identificadores aleatórios próprios e nunca recebem um usuário existente como alvo. Validam leitura entre contas, promoção indevida de plano, sessões revogadas/desativadas, bloqueio durante exclusão e remoção completa. Nunca imprimem credenciais ou tokens.

O verificador de segurança aceita `--expect-verified-email` para confirmar o bloqueio antes de qualquer chamada de IA e `--with-app-check` para usar um token administrativo de teste após enforcement. Esse token testa a verificação no servidor; não substitui o teste de atestação pelo navegador real.

Os relatórios, backups, credenciais, anexos e capturas de auditoria ficam fora do Git. A rotina de publicação permite somente arquivos estáticos públicos.
