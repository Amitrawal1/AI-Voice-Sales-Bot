# AI Voice Sales Bot

Voice bot that calls you from the browser and tries to sell **FlowCRM**, a made-up CRM for small businesses. You talk to it like a normal sales call, see the conversation as text while it happens, and when the call ends you get the recording, a short summary and a sales status.

Built for the Sankar Group intern assignment.

**Live:** _add Vercel link_

## Features

- Voice call with an AI sales rep ("Priya") in English or Hindi/Hinglish. She asks about your business, explains relevant features, handles objections (price, already using Excel, no time...) and tries to get you to start a trial or book a demo.
- Live transcript in a chat view
- Start / End call, timer and call status
- Asks for recording consent before the call starts; recording can be played back afterwards
- Summary with customer requirements, objections and next steps
- Sales status: Converted, Interested, Follow-up Required, Not Interested, Demo Requested or No Response
- Call history page with filters by status, and a detail page per call (recording, summary, transcript)

## Stack

- Next.js 15 + TypeScript + Tailwind
- [Vapi](https://vapi.ai) for the voice part: Deepgram for speech-to-text, Claude Sonnet as the model, Vapi/Azure voices for text-to-speech, plus call recording and the post-call analysis
- Supabase (Postgres) to store calls
- Deployed on Vercel

## How it works

1. The browser starts a call with the Vapi web SDK. The assistant config (prompt, voice, transcriber, recording, analysis) is in `src/lib/assistant.ts`.
2. Transcript events from Vapi are shown in the chat as they come in.
3. When the call ends, the transcript is saved through `POST /api/calls`.
4. Vapi takes a few seconds to finish the recording and the analysis, so `POST /api/calls/[id]/sync` polls the Vapi API and stores both once they are ready.
5. The history pages read straight from Supabase.

If the customer doesn't say anything, the call is marked "No Response" right away without waiting for the analysis.

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev
```

You need:

- Vapi public and private keys (Vapi dashboard → API Keys)
- Supabase project URL and secret key (Project Settings → API)

Run `supabase/schema.sql` once in the Supabase SQL editor to create the `calls` table.

Use Chrome and allow microphone access.

## Changing the product

Product details, pricing and objection answers are in `src/lib/product.ts`. The sales prompt is generated from that file, so you can switch the bot to a different product by editing it.

## Known limitations

- No login. Anyone with the link can make calls and see the call history.
- Recording and summary depend on Vapi finishing its processing. If they are not ready yet, use "Refresh results" on the call page.
- Hindi speech recognition works best with Hinglish (Hindi mixed with English words).
