# Firebase Setup

Para ativar o login real com Firebase neste projeto:

1. Crie um projeto no Firebase.
2. Adicione um app Web no projeto.
3. Copie o `firebaseConfig` do console do Firebase.
4. Preencha os valores em `assets/js/firebase-config.js`.
5. Em `Authentication`, habilite o provedor `Email/Password`.
6. Em `Firestore Database`, crie o banco no modo nativo.
7. Crie uma regra inicial de desenvolvimento semelhante a:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /teachers/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

O fluxo atual usa:

- Firebase Auth para cadastro, login e logout
- Firestore para salvar o perfil do professor em `teachers/{uid}`

Referências oficiais:

- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/firestore/manage-data/add-data
