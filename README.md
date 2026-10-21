# FlowCRM AI Voice Sales Bot

An AI salesperson ("Priya") that sells **FlowCRM**, a CRM for small businesses, over a live voice call in the browser. It shows the conversation as text while it happens. When the call ends it saves the recording, writes an AI summary and assigns a sales status. Every call is kept in a searchable call history.

**Live demo:** _add your Vercel link here_

## Features

| Requirement | How it works |
|---|---|
| Voice conversation | Real-time voice call through [Vapi](https://vapi.ai): Deepgram speech-to-text, Claude as the sales brain, natural text-to-speech. The bot asks about the customer's needs, pitches matching features, handles objections and tries to close (free trial or demo). |
| Language | English or Hindi/Hinglish, chosen before the call. |
| Live chat screen | Bot and customer messages appear as chat bubbles in real time, including words still being spoken. |
| Call controls | Start Call / End Call, live mm:ss timer, call status (Ready, Connecting, Live, Ending, Ended, Error) and a speaking/listening indicator. |
| Call recording + consent | The user must tick a recording-consent box before the call can start, and the bot says the call is recorded. The recording is fetched from Vapi after the call and can be played back. |
| AI summary | At the end of each call, Vapi's analysis step reads the transcript and returns a summary, customer requirements, objections and next steps as structured JSON. The server checks the result against a schema before saving it. |
| Sales status | One of: Converted, Interested, Follow-up Required, Not Interested, Demo Requested, No Response. If the customer never speaks, the status is set to No Response automatically. |
| Call history | `/history` lists every call with date, duration, language and status, with filters by status. Each call opens to show its recording, summary, insights and full transcript. |

## How it works

```
Browser (Next.js)                          Server (Next.js API routes)
─────────────────                          ───────────────────────────
Start Call ──► Vapi Web SDK ◄──► Vapi cloud (STT → Claude → TTS, records audio)
   │  live transcript events
   ▼
Chat bubbles, timer, status
   │
End Call ─────────────────────────────►  POST /api/calls
                                            └─ save transcript to Supabase
          ─────────────────────────────►  POST /api/calls/:id/sync
                                            └─ poll Vapi API for AI analysis
                                               (summary + status) and recording → save
          ◄──────── results card ─────────
History page ─────────────────────────►  Supabase (server-side read)
```

## Tech stack

- **Next.js 15** (App Router, TypeScript, Tailwind CSS), deployed on Vercel
- **Vapi Web SDK**: real-time voice, transcription, recording and post-call AI analysis. The conversation runs on Claude through Vapi, so no separate LLM API key is needed.
- **Supabase** (Postgres): call history storage

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `VAPI_PRIVATE_KEY`: Vapi dashboard → API Keys
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API
3. In the Supabase SQL editor, run `supabase/schema.sql`.
4. `npm run dev`, open http://localhost:3000 in Chrome and allow microphone access.

## Customising the product

Edit `src/lib/product.ts` to sell a different SaaS product: name, features, pricing, offer and objection answers. The sales prompt in `src/lib/assistant.ts` is built from it.

## Project structure

```
src/
  app/
    page.tsx                         Call screen
    history/page.tsx                 Call history list
    history/[id]/page.tsx            Call detail
    api/calls/route.ts               Save call, list calls
    api/calls/[id]/sync/route.ts     Fetch AI analysis + recording from Vapi
  components/                        Call screen, chat, badges, insights
  hooks/useVoiceCall.ts              Vapi call state, timer, live transcript
  hooks/useSaveCall.ts               Save call, then wait for analysis + recording
  lib/assistant.ts                   Sales prompt and voice settings
  lib/analysis.ts                    AI summary + status prompt and schema (run by Vapi)
  lib/product.ts                     Product being sold
supabase/schema.sql                  Database table
```
