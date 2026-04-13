# EducarIA — CLAUDE.md

Project context and conventions for AI-assisted development.

---

## Project Overview

EducarIA is a Brazilian EdTech platform for teachers. It supports creating, managing, and presenting 12+ activity types (quiz, slides, flashcards, word search, crossword, hangman, memory game, wheel/spinner, word link, mind map, guided debate, complete lesson). Activities are AI-generated via Google Gemini, stored in Firebase Firestore, and presented in-browser.

---

## Architecture

```
educaria/
├── ai-service/          # Node.js backend — proxies Gemini API, rate limits, parses files
│   ├── server.js        # Single-file Express server
│   └── .env.example     # Config template (actual .env is git-ignored)
├── assets/
│   ├── css/
│   │   └── estilo-premium.css   # Global design system — CSS variables + all component styles
│   ├── js/              # 50+ standalone frontend modules (no bundler)
│   └── templates/       # RTF model files for teacher imports
├── plataforma/          # 40+ HTML pages — builders and presentation views
├── index.html           # Landing page
├── login.html           # Firebase auth
└── docs/                # Markdown docs for setup and schemas
```

**Two separate runtimes:**
- **Frontend**: Vanilla JS + HTML + CSS, served as static files. No build step.
- **Backend** (`ai-service/`): Node.js ES Modules, Express 4. Run separately.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend language | Vanilla JavaScript (ES2020+, no TypeScript) |
| Frontend modules | No bundler — `<script>` tags only, globals via `window.*` |
| Styling | CSS3 with custom properties; single file `estilo-premium.css` |
| Auth | Firebase Authentication (compat SDK v11, CDN) |
| Database | Firebase Firestore |
| Backend | Node.js (ES Modules), Express 4.21 |
| AI | Google Gemini via `@google/genai` (`gemini-2.5-flash` default) |
| File parsing | `mammoth` (DOCX), `pdf-parse` (PDF), `multer` (uploads) |
| Dev environment | VS Code Live Server (default: `http://127.0.0.1:5500`) |

---

## Dev Commands

**Backend** (run from `ai-service/`):
```bash
npm install
npm run dev      # or: npm start  (both run: node server.js)
```

**Frontend**: No build step. Open with VS Code Live Server or any static server.

**Environment**: Copy `ai-service/.env.example` to `ai-service/.env` and fill in `GEMINI_API_KEY`.

---

## Code Conventions

### JavaScript (Frontend)

- **No imports/exports** — each file is a standalone script. Expose public API via `window.*`:
  ```js
  window.EducarIACrossword = { ... };
  window.EDUCARIA_FIREBASE_CONFIG = { ... };
  ```
- **Naming**:
  - Functions and variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE` (e.g., `EDUCARIA_SESSION_KEY`)
  - HTML `data-*` attributes: `kebab-case` (e.g., `data-quiz-stack`, `data-crossword-entry`)
  - CSS classes: `kebab-case` (e.g., `activity-content-card`, `platform-modal-backdrop`)
- **HTML generation**: Template literals returning HTML strings, not DOM API calls.
- **DOM queries**: `document.querySelector` / `querySelectorAll`; event delegation on container or `document`.
- **Error handling**: `try/catch` with `console.warn` fallback; never let localStorage errors crash the page.

### JavaScript (Backend — `ai-service/server.js`)

- Node.js ES Modules (`import`/`export`), `"type": "module"` in `package.json`.
- Same naming conventions as frontend.
- Rate limiting and credit tracking use in-memory `Map` with periodic cleanup.
- API error responses are always JSON: `{ error: "message" }`.
- Schema validation objects defined inline before the endpoint that uses them.

### CSS (`assets/css/estilo-premium.css`)

- All design tokens live at `:root` as CSS custom properties:
  - Colors: `--navy-dark`, `--blue-vibrant`, `--orange-bright`, etc.
  - Spacing: `--space-xs` → `--space-4xl`
  - Radii: `--radius-sm` → `--radius-2xl`
  - Shadows, transitions: standardized variables
- Always use existing variables instead of hardcoding values.
- Class names follow the `kebab-case` BEM-adjacent pattern; prefer semantic names (`activity-content-card`) over deeply nested selectors.

### Commit Messages

Recent project style is imperative, first letter capitalized, mixed Portuguese/English:
```
Add inline editing to presentation views
Ajusta apresentacao do debate guiado
Protege ai-service e adiciona creditos de IA
```
Follow the same style: short imperative phrase, no ticket refs. Use English only in future commit messages. 

---

## Adding a New Activity Type

Each activity type consists of up to four pieces:

1. `plataforma/*-builder.html` — teacher creation UI
2. `assets/js/*-builder.js` — builder logic (reads form → builds JSON → saves to Firestore)
3. `plataforma/*-apresentacao.html` — presentation/play page
4. `assets/js/*-runtime.js` — runtime logic (loads JSON → renders interactive activity)

For game-heavy types (crossword, word search, hangman) there is also a `*-core.js` that holds pure game logic separate from UI concerns.

---

## Testing

**No automated test suite.** Testing is manual/exploratory.

- Each builder has a live preview mode — use it to verify generation output.
- Each runtime loads from localStorage or Firestore — test both paths.
- Do not introduce a test framework without discussing it first.

---

## Read-Only / Do Not Edit Directly

| Path | Reason |
|---|---|
| `ai-service/node_modules/` | NPM-managed; git-ignored |
| `ai-service/.env` | Secret credentials; git-ignored; never commit |
| `ai-service/package-lock.json` | Auto-managed by npm |
| `assets/templates/*.rtf` | Teacher import models; binary assets |
| `assets/images/` | Logo/brand assets |
| `docs/` | Reference docs — update only when the feature they describe changes |

---

## Firebase Notes

- `assets/js/firebase-config.js` contains the **public** Firebase web SDK config (safe to commit — it is not a secret).
- Firestore rules and indexes are managed in the Firebase console, not in this repo.
- Auth is email/password via Firebase Authentication.

---

## AI Service Notes

- The backend (`ai-service/`) exists **only** to keep `GEMINI_API_KEY` off the client.
- Daily credit limit and per-minute rate limits are enforced in `server.js` via in-memory state — they reset on server restart.
- Primary model: `gemini-2.5-flash`. Image generation uses a separate model env var.
- `ALLOWED_ORIGIN` in `.env` must list all frontend origins (comma-separated) or CORS will block requests.
