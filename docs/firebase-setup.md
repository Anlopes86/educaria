# Firebase Setup

Este projeto usa Firebase Auth + Firestore no frontend.

## 1. Configure o app Web no Firebase

1. Crie um projeto no Firebase.
2. Adicione um app Web.
3. Copie o objeto `firebaseConfig` do console.
4. Habilite `Authentication > Email/Password`.
5. Crie o Firestore em modo nativo.
6. Configure o Firebase Storage.

## 2. Defina a configuracao sem commitar no GitHub

O arquivo versionado `assets/js/firebase-config.js` usa apenas placeholders por padrao. Sem configurar estes valores, login, cadastro e sincronizacao com Firestore ficam desativados com seguranca.

Para desenvolvimento local, prefira `assets/js/firebase-config.local.js`. Esse arquivo e carregado automaticamente e esta no `.gitignore`.

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

Isso salva a config no `localStorage` e evita colocar credenciais no Git.

Para GitHub Pages, use o workflow documentado em `docs/deploy-firebase-config.md`. Ele gera `firebase-config.local.js` no artefato publicado a partir de um secret do GitHub, sem gravar os valores no repositorio.

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

- `teachers/{uid}/classes/{classId}/materials/{materialId}`
- `teachers/{uid}/productAnalyticsEvents/{eventId}`

Os eventos de analytics ficam primeiro no `localStorage` e sao sincronizados automaticamente em lotes pequenos quando ha sessao Firebase ativa. A pagina de configuracoes tambem permite sincronizacao manual.

## Nota importante

No Firebase Web SDK, o `apiKey` nao e segredo isoladamente.
O controle real de seguranca vem de:

1. Regras de Firestore/Storage
2. Auth obrigatorio
3. Limites e monitoramento de uso
