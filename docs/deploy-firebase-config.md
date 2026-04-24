# Firebase sem chave no repositorio

O frontend precisa receber a configuracao Web do Firebase para autenticar no navegador. Essa configuracao nao e uma senha de servidor, mas ela fica visivel para qualquer pessoa que abre o site publicado.

A diferenca segura e: nao versionar os valores no GitHub e proteger dados de verdade com Firebase Auth, Firestore Rules e dominios autorizados.

## Desenvolvimento local

Crie `assets/js/firebase-config.local.js`. O arquivo ja esta no `.gitignore`.

Exemplo:

```js
(function configureEducariaFirebaseLocal() {
    if (typeof window.setEducariaFirebaseConfig !== "function") return;

    window.setEducariaFirebaseConfig({
        apiKey: "...",
        authDomain: "...firebaseapp.com",
        projectId: "...",
        storageBucket: "...",
        messagingSenderId: "...",
        appId: "...",
        measurementId: "..."
    }, { persist: true });
})();
```

`assets/js/firebase-config.js` tenta carregar esse arquivo automaticamente a partir da mesma pasta. Se o arquivo nao existir, ele usa a configuracao salva no `localStorage`, quando houver.

## GitHub Pages

Este repo inclui o workflow `.github/workflows/deploy-pages.yml`.

Configure o secret `EDUCARIA_FIREBASE_CONFIG_JSON` no GitHub com o JSON puro da configuracao:

```json
{
  "apiKey": "...",
  "authDomain": "...firebaseapp.com",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "measurementId": "..."
}
```

Depois, em **Settings > Pages**, use **GitHub Actions** como origem do deploy.

O workflow gera `assets/js/firebase-config.local.js` somente no artefato publicado. Os valores nao entram no commit.

## Checklist de seguranca

- Em Firebase Authentication, autorize apenas os dominios usados pela EducarIA.
- Em Firestore Rules, mantenha leitura/escrita restritas ao `request.auth.uid`.
- Nao coloque service account, Admin SDK ou chaves privadas no frontend.
- Trate a API key Web como identificador publico do app, nao como segredo.
