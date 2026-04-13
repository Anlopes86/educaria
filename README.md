# EducarIA — Local Setup Guide

EducarIA is a browser-based platform for Brazilian teachers to create and present AI-generated classroom activities. This guide covers the full local dev setup.

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18 or later |
| npm | bundled with Node |
| A Firebase project | (see [docs/firebase-setup.md](docs/firebase-setup.md)) |
| A Google Gemini API key | (see [docs/ia-materials-setup.md](docs/ia-materials-setup.md)) |

---

## Repository Structure

```
educaria/
├── ai-service/    # Node.js backend — proxies Gemini, enforces auth/rate limits
├── assets/        # Frontend JS modules, CSS design system, templates
├── plataforma/    # Activity builder and presentation HTML pages (40+)
├── index.html     # Landing page
├── login.html     # Firebase auth page
└── docs/          # Setup and schema reference docs
```

The frontend is **pure static HTML/CSS/JS** — no build step. The backend is a **separate Node.js process** that runs alongside it.

---

## 1. Clone the repository

```bash
git clone <repo-url>
cd educaria
```

---

## 2. Set up the backend

```bash
cd ai-service
npm install
cp .env.example .env
```

Open `.env` and fill in the required values (see table below).

---

## 3. Configure environment variables

All configuration lives in `ai-service/.env`. This file is git-ignored — never commit it.

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Text generation model |
| `GEMINI_IMAGE_MODEL` | No | `gemini-3.1-flash-image-preview` | Image generation model |
| `PORT` | No | `8787` | Port the backend listens on |
| `FIREBASE_PROJECT_ID` | Yes (if auth on) | — | Firebase project ID (e.g. `educaria-f46b2`) |
| `AI_AUTH_REQUIRED` | No | `false` | Set to `true` to require Firebase ID token on all AI routes |
| `AI_RATE_LIMIT_MAX` | No | `8` | Max AI requests per window per IP |
| `AI_RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window in milliseconds |
| `AI_DAILY_CREDIT_LIMIT` | No | `5` | Max AI generations per user per day |
| `AI_MAX_UPLOAD_MB` | No | `5` | Max uploaded file size in MB |
| `AI_JSON_LIMIT` | No | `2mb` | Max JSON request body size |
| `AI_IMAGE_GENERATION_ENABLED` | No | `false` | Enable image generation endpoint |
| `ALLOWED_ORIGIN` | No | localhost defaults | Comma-separated list of allowed frontend origins |
| `TRUST_PROXY` | No | `false` | Set to `true` when behind a reverse proxy (Render, etc.) |

**Minimum config for local dev:**

```env
GEMINI_API_KEY=your_key_here
FIREBASE_PROJECT_ID=your_project_id
```

---

## 4. Start the backend

```bash
# from ai-service/
npm run dev
```

The server starts on `http://localhost:8787` (or whichever `PORT` you set).

Verify it is running:

```bash
curl http://localhost:8787/api/health
```

Expected response:

```json
{
  "ok": true,
  "geminiConfigured": true,
  "authRequired": false,
  ...
}
```

---

## 5. Serve the frontend

The frontend requires no build step. Use any static file server. The recommended approach is **VS Code Live Server** (default URL: `http://127.0.0.1:5500`).

Alternatives:

```bash
# Python
python -m http.server 5500

# Node (npx)
npx serve . --listen 5500
```

Open `http://127.0.0.1:5500` in your browser. The app should load the landing page.

> **CORS note**: The backend defaults to allowing `http://127.0.0.1:5500` and `http://localhost:5500`. If you use a different port, add it to `ALLOWED_ORIGIN` in `.env`.

---

## 6. Firebase setup

The frontend Firebase config is already embedded in `assets/js/firebase-config.js`. For a fresh Firebase project, follow [docs/firebase-setup.md](docs/firebase-setup.md) to:

- Enable **Email/Password** authentication
- Create a **Firestore** database
- Set Firestore security rules

---

## API Reference

All endpoints are served from the backend (`http://localhost:8787`).

### `GET /api/health`

Returns backend config status. No auth required.

```json
{ "ok": true, "geminiConfigured": true, "authRequired": false, ... }
```

---

### `GET /api/ai/credits`

Returns remaining daily generation credits for the authenticated user.

**Headers:** `Authorization: Bearer <firebase-id-token>` (required if `AI_AUTH_REQUIRED=true`)

```json
{ "ok": true, "credits": { "limit": 5, "used": 1, "remaining": 4, "resetAt": "..." } }
```

---

### `POST /api/ai/generate`

Generates a structured activity from source text or an uploaded file.

**Headers:** `Authorization: Bearer <firebase-id-token>`

**Body:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `materialType` | string | Activity type: `quiz`, `slides`, `flashcards`, `memory`, `match`, `wheel`, `wordsearch`, `mindmap`, `debate`, `crossword` |
| `action` | string | Teacher's generation goal (e.g. `"Criar revisão rápida"`) |
| `sourceText` | string | Plain text source material |
| `file` | file | Optional uploaded file (`.txt`, `.docx`, `.pdf`, `.rtf`) |

**Response:**

```json
{
  "ok": true,
  "materialType": "quiz",
  "material": { ... },
  "credits": { "remaining": 3, ... }
}
```

**Error codes:**

| Status | Meaning |
|---|---|
| 400 | Unsupported material type or missing source |
| 401 | Auth required but token missing/invalid |
| 413 | Uploaded file exceeds size limit |
| 429 | Rate limit or daily credits exhausted |
| 500 | Gemini generation failed |
| 503 | `GEMINI_API_KEY` not configured |

---

### `POST /api/model-template/generate`

Parses a filled-in RTF teacher template (currently only `wheel` type).

**Body:** `multipart/form-data` — `materialType` + `file` (RTF)

---

### `POST /api/ai/generate-image`

Generates an image for a slide using Gemini. Only available when `AI_IMAGE_GENERATION_ENABLED=true`.

**Body (JSON):** `title`, `subtitle`, `body`, `prompt`

**Response:** `{ "ok": true, "mimeType": "image/png", "imageBase64": "..." }`

---

## Supported File Types for Upload

| Extension | Parsed via |
|---|---|
| `.txt` | Raw UTF-8 read |
| `.docx` | `mammoth` |
| `.pdf` | `pdf-parse` |
| `.rtf` | Custom RTF stripper |

---

## Deployment

- **Frontend**: Deploy the repo root as a static site (Render Static Site, GitHub Pages, Netlify, etc.)
- **Backend**: Deploy `ai-service/` as a Node.js web service (Render, Railway, Heroku)
- Set `ALLOWED_ORIGIN` in the backend to the production frontend URL
- Set `TRUST_PROXY=true` when behind a reverse proxy
- Set `AI_AUTH_REQUIRED=true` in production to require Firebase authentication

See [docs/ia-materials-setup.md](docs/ia-materials-setup.md) for Render-specific steps.
