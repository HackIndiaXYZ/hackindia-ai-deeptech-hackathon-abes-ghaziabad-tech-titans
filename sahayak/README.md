# Sahayak — Next.js app

This folder contains the **Sahayak** Next.js application (frontend + `/api/analyze` route handler).

For the full project description, hackathon attribution, architecture overview, and roadmap, see the [repository root README](../README.md).

---

## Stack

- Next.js 16 (App Router, Turbopack) — note: APIs and conventions differ from older Next versions. See `AGENTS.md`.
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- `@google/generative-ai` (Gemini, structured JSON output)
- `lucide-react` icons
- Browser Web Speech API for bilingual voice input

---

## Getting started

### Prerequisites

- Node.js 20+
- A Google Gemini API key — [aistudio.google.com](https://aistudio.google.com/app/apikey)

### Install

```bash
npm install
```

### Environment

Create `.env.local` in this folder:

```env
GEMINI_API_KEY=your_api_key_here
# Optional override (defaults to gemini-2.5-flash)
# GEMINI_MODEL=gemini-2.5-pro
```

`.env.local` is gitignored — never commit your key.

### Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

---

## Folder structure

```
sahayak/
├── app/
│   ├── layout.tsx              ← root layout, fonts, metadata
│   ├── page.tsx                ← homepage: capture, AI analysis, formal draft
│   ├── globals.css             ← Tailwind v4 entry + theme tokens
│   └── api/
│       └── analyze/
│           └── route.ts        ← POST /api/analyze — Gemini triage endpoint
├── public/                     ← static assets
├── AGENTS.md                   ← repo conventions for AI agents (read this first)
├── CLAUDE.md                   ← Claude-specific instructions, re-exports AGENTS.md
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

The route handler lives at `app/api/analyze/route.ts` — there is no `src/` directory in this project, so any new route handlers belong under `app/` directly.

---

## API endpoint

`POST /api/analyze`

Accepts `{ "complaint": "..." }` (Hindi / English / Hinglish, 4–4000 chars). Returns a structured triage record:

```json
{
  "issueType": "ROAD_AND_POTHOLES",
  "authority": "MUNICIPAL_CORPORATION",
  "severity": "MEDIUM",
  "location": "Abes College",
  "summary": "A pothole has been reported near Abes College."
}
```

Full request/response shapes, enum values, and error codes are documented in the [root README](../README.md#api-reference).

---

## Working with this codebase

- **Read `AGENTS.md` first.** Next.js 16 has breaking changes from older versions — APIs and conventions may differ from training data, so docs in `node_modules/next/dist/docs/` are the source of truth.
- **Tailwind v4** uses `@import "tailwindcss"` + `@theme` directives in `globals.css` — there is no `tailwind.config.js`.
- **Hot reload** is on by default with `npm run dev`. The dev server refuses to start if another instance is already bound to the port — kill the existing process with `taskkill /PID <pid> /F` (Windows) before restarting.
- **Web Speech API** only works in Chromium-based browsers, Safari, and Edge — the UI gracefully degrades elsewhere.
- **Demo mode** kicks in automatically when `/api/analyze` is unreachable, so the UX never dead-ends even without internet or a valid key.

---

## Deploy

The easiest deployment target is [Vercel](https://vercel.com/new). Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) as a project environment variable before the first deploy.
