# Firebase Setup

Este projeto usa Firebase Auth + Firestore no frontend.

## 1. Configure o app Web no Firebase

1. Crie um projeto no Firebase.
2. Adicione um app Web.
3. Copie o objeto `firebaseConfig` do console.
4. Habilite `Authentication > Email/Password`.
5. Crie o Firestore em modo nativo.
6. Configure o Firebase Storage.

## 2. Defina a configuração Web

O arquivo versionado `assets/js/firebase-config.js` contém a configuração Web pública usada em produção. Esses valores identificam o app Firebase no navegador, mas não autorizam acesso aos dados.

Para testar outro projeto em desenvolvimento local, use `assets/js/firebase-config.local.js`. Esse arquivo é carregado automaticamente apenas no ambiente local e está no `.gitignore`.

Também ficam ignorados arquivos `.env`, `.env.*`, `*.local` e variantes `assets/js/*firebase*local*.js`. Nunca coloque no frontend uma conta de serviço, chave privada, token do Admin SDK ou chave da API Gemini.

No browser (uma vez por ambiente), rode:

```js
setEducariaFirebaseConfig({
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
}, { persist: true });
```

Isso salva a configuração alternativa no `localStorage` do ambiente local.

Para GitHub Pages, não é necessário cadastrar um secret. Consulte `docs/deploy-firebase-config.md`.

Para voltar ao estado sem credenciais locais, rode:

```js
resetEducariaFirebaseConfig();
```

Se preferir injetar a configuracao antes desse arquivo carregar, defina `window.EDUCARIA_FIREBASE_CONFIG_OVERRIDE` com o mesmo formato do objeto acima.

## 3. Regras de seguranca recomendadas

Use os arquivos:

- `firebase/firestore.rules`
- `firebase/storage.rules`

Eles restringem leitura/escrita aos dados do proprio professor (`request.auth.uid`).

## 4. Estrutura de dados esperada

```txt
teachers/{uid} {
  name: string
  email: string
  institution: string
  institutionName: string
  institutionId: string
  role: "teacher" | "coordinator" | "institution_admin"
  plan: "free" | "pro"
  billingIntent: object | null
  aiCredits: object | null
  monthlyUsage: object | null
}
```

Subcolecoes usadas:

- `teachers/{uid}/platform/classes`
- `teachers/{uid}/lessons/{lessonId}`
- `teachers/{uid}/classes/{classId}/materials/{materialId}`
- `teachers/{uid}/productAnalyticsEvents/{eventId}`

`platform/classes` guarda a lista de turmas criada na barra lateral e `lessons` guarda os materiais salvos pelo professor. As regras versionadas permitem leitura/escrita somente quando `request.auth.uid` e igual ao `{uid}` do caminho.

Os eventos de analytics ficam primeiro no `localStorage` e sao sincronizados automaticamente em lotes pequenos quando ha sessao Firebase ativa. A pagina de configuracoes tambem permite sincronizacao manual.

A pagina de configuracoes oferece backup da conta e exclusao autenticada. A exclusao remove os caminhos conhecidos do professor no Firestore, arquivos em `teachers/{uid}` no Storage, estado de creditos/cobranca do servico de IA e, por ultimo, o usuario do Firebase Auth. Novas colecoes ou caminhos de Storage devem ser adicionados ao fluxo de exclusao no mesmo ciclo em que forem criados.

## Nota importante

No Firebase Web SDK, o `apiKey` não é uma senha. Ele deve ser restrito às APIs do Firebase e não pode ser reutilizado para Gemini ou outras APIs do Google Cloud.
O controle real de segurança vem de:

1. Regras de Firestore/Storage
2. Auth obrigatório
3. Limites e monitoramento de uso

As regras de Storage versionadas restringem uploads ao caminho do proprio professor e limitam tamanho/tipos permitidos. Se novos formatos forem adicionados, atualize `firebase/storage.rules` junto com o frontend/backend que consome esses arquivos.
