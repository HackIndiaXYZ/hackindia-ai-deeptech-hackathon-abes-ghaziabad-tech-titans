# Sahayak — AI-Powered Civic Complaint Platform

> Hackathon submission by **Tech Titans** for the HackIndia AI DeepTech Hackathon, ABES Ghaziabad.
> `hackindia-team:hackindia-ai-deeptech-hackathon-abes-ghaziabad:tech-titans`

Sahayak is a voice-first, bilingual (Hindi + English) civic complaint platform that uses Google Gemini to triage citizen complaints, classify them against an Indian municipal taxonomy, and auto-draft a formal government-style complaint letter — all in seconds.

The goal is to compress the gap between a citizen noticing a civic issue and that issue reaching the right desk in the right department.

---

## What it does

1. **Capture** a complaint by speaking (browser Web Speech API, Hindi / English) or typing.
2. **Triage** the complaint with Gemini 2.5 — extracting issue type, responsible authority, severity, and location.
3. **Draft** a ready-to-submit formal complaint letter (To / Subject / Body / Request) addressed to the correct Indian government body.
4. **Track** the complaint through a live status timeline (Submitted → AI Triaged → Assigned → In Progress → Resolved).
5. **Resilient demo mode** — if the live AI is unreachable, an on-device fallback classifier keeps the experience intact and the UI surfaces a subtle "Demo Mode" badge.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4 |
| Language | TypeScript (strict) |
| AI | Google Gemini via `@google/generative-ai` (structured JSON output via `responseSchema`) |
| Voice | Browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) |
| Icons | `lucide-react` |
| Hosting target | Vercel (Node.js runtime) |

---

## Project layout

```
.
├── README.md                    ← you are here
├── LICENSE
└── sahayak/                     ← the Next.js application
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx             ← homepage: complaint capture, AI analysis, draft letter
    │   ├── globals.css
    │   └── api/
    │       └── analyze/
    │           └── route.ts     ← POST /api/analyze — Gemini-powered triage
    ├── AGENTS.md                ← repo conventions for AI agents
    ├── CLAUDE.md
    ├── package.json
    ├── next.config.ts
    └── tsconfig.json
```

---

## Getting started

### 1. Prerequisites

- Node.js 20+
- A Google Gemini API key — get one at [aistudio.google.com](https://aistudio.google.com/app/apikey)

### 2. Install

```bash
cd sahayak
npm install
```

### 3. Configure environment

Create `sahayak/.env.local`:

```env
GEMINI_API_KEY=your_api_key_here
# optional override (defaults to gemini-2.5-flash)
# GEMINI_MODEL=gemini-2.5-pro
```

`.env.local` is gitignored — never commit your key.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Build for production

```bash
npm run build
npm start
```

---

## API reference

### `POST /api/analyze`

Analyse a citizen complaint and return a structured triage record.

**Request**

```json
{
  "complaint": "अबेस कॉलेज के पास पॉट होल है"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `complaint` | string | 4–4000 characters. Hindi, English, or Hinglish accepted. |

**Response — `200 OK`**

```json
{
  "issueType": "ROAD_AND_POTHOLES",
  "authority": "MUNICIPAL_CORPORATION",
  "severity": "MEDIUM",
  "location": "Abes College",
  "summary": "A pothole has been reported near Abes College."
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `issueType` | enum | One of 20 civic categories (roads, water, electricity, sanitation, law & order, …). |
| `authority` | enum | One of 16 Indian government bodies (Municipal Corporation, PWD, Water Board, DISCOM, Police, Pollution Control Board, …). |
| `severity` | enum | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`. |
| `location` | string | Extracted verbatim, or `"Not specified"`. |
| `summary` | string | Neutral English one-liner suitable for a municipal ticket. |

**Errors**

| Status | Meaning |
| --- | --- |
| `400` | Missing / non-string / under 4 chars / over 4000 chars complaint. |
| `405` | Wrong HTTP method (use `POST`). |
| `500` | `GEMINI_API_KEY` not configured server-side. |
| `502` | Gemini returned an empty, non-JSON, or schema-violating response. |

The response shape is enforced via Gemini's `responseMimeType: "application/json"` + a `responseSchema` with locked enums, so non-conforming output never reaches the client.

---

## Features in detail

### Voice-first input
- Bilingual: toggle between `en-IN` and `hi-IN` with a single chip.
- Live transcription via `interimResults` — words appear in the textarea as you speak.
- Listening indicator, animated waveform, MM:SS timer.
- Graceful browser-compatibility fallback when Web Speech is unavailable.

### AI triage
- Strong prompt engineering tailored for Indian civic complaints (authority-mapping reference, severity rubric, Hindi/Hinglish handling).
- Structured JSON output enforced by `responseSchema`.
- Low temperature (`0.2`) for reproducible classification.

### Formal complaint draft
- Client-side templated letter using the four analysis fields.
- Salutation, subject, body, numbered citizen requests, and closing — all formatted in Indian government style.
- Copy-to-clipboard with a fallback `document.execCommand` path for older browsers.

### Demo-mode fallback
- If the live AI is unreachable (offline demo booth, hackathon Wi-Fi, expired key), an on-device classifier with 16 Hindi/English keyword rules + location regex keeps the demo flowing.
- A subtle amber "Demo Mode" pill makes the offline state explicit.

### UI / UX
- Modern dark theme with layered gradient orbs and a radial dot grid background.
- All interactive elements respect `prefers-reduced-motion`.
- Live status timeline animates through five stages on submit.
- Responsive: single column on mobile, 3/2 split on `lg`.

---

## Roadmap (post-hackathon)

- Geo-tag complaints automatically using the Geolocation API.
- Persist complaints to Supabase with public reference-ID tracking.
- Outbound integration with municipal grievance portals (CPGRAMS, MyGov).
- Image / video attachments with on-device redaction.
- WhatsApp bot front-end using the same `/api/analyze` endpoint.

---

## Team — Tech Titans

Hackathon team repository for **Tech Titans** at the HackIndia AI DeepTech Hackathon hosted at ABES Engineering College, Ghaziabad.

---

## License

See [`LICENSE`](./LICENSE).
