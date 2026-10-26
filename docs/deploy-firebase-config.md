# Configuração Web do Firebase

O frontend precisa do objeto de configuração Web para localizar o projeto Firebase. Como esse objeto é enviado a todo navegador que abre o site, ele faz parte do código publicado em `assets/js/firebase-config.js`.

Essa configuração identifica o app, mas não autoriza acesso aos dados. A segurança depende de:

- Firebase Authentication;
- regras de Firestore e Storage;
- restrições da chave às APIs do Firebase;
- App Check, quando habilitado.

## GitHub Pages

Não é necessário cadastrar um secret para o login funcionar. O workflow `.github/workflows/deploy-pages.yml` valida o projeto e publica os arquivos já configurados.

Depois de alterar a configuração Web, valide o projeto e publique normalmente. O arquivo `firebase-config.js` fica fora do cache do service worker para que a correção chegue imediatamente aos dispositivos.

## Desenvolvimento local

Para testar outro projeto Firebase sem alterar a configuração de produção, crie `assets/js/firebase-config.local.js`. Esse arquivo está no `.gitignore` e só é carregado em `localhost`, `127.0.0.1`, `::1` ou quando o site é aberto diretamente pelo sistema de arquivos.

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

Nunca coloque no frontend uma conta de serviço, chave privada, token do Admin SDK ou chave de API do Groq/Gemini.

## Restrições da chave em produção

Em 26 de outubro de 2026, a chave Web do projeto `educaria-f46b2` foi restringida às seguintes APIs no Google Cloud:

- Firebase Management API (`firebase.googleapis.com`);
- Cloud Logging API (`logging.googleapis.com`);
- Identity Toolkit API (`identitytoolkit.googleapis.com`);
- Token Service API (`securetoken.googleapis.com`);
- Cloud Firestore API (`firestore.googleapis.com`);
- Cloud Datastore API (`datastore.googleapis.com`);
- Firebase Rules API (`firebaserules.googleapis.com`);
- Cloud Storage for Firebase API (`firebasestorage.googleapis.com`);
- Firebase App Check API (`firebaseappcheck.googleapis.com`).

A lista preserva autenticação, dados e armazenamento, além da API de proteção App Check. Permitir essa API não ativa o App Check nem exige sua validação: essa integração ainda precisa ser configurada no aplicativo e nos serviços. As restrições por aplicativo/site não foram alteradas nesta revisão.

Gemini, Firebase AI Logic e APIs não utilizadas não fazem parte dessa lista. O serviço de IA usa suas próprias credenciais no backend. Ao incorporar outro produto Firebase, consulte a [lista oficial de APIs necessárias](https://firebase.google.com/docs/projects/api-keys#api-allowlist-required) antes de modificar as restrições; remover Identity Toolkit ou Token Service pode interromper o login e a renovação das sessões.
