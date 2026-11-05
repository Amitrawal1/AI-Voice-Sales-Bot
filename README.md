# AI Voice Sales Bot

Voice bot that calls you from the browser and tries to sell **FlowCRM**, a made-up CRM for small businesses. You talk to it like a normal sales call, see the conversation as text while it happens, and when the call ends you get the recording, a short summary and a sales status.

Built for the Sankar Group intern assignment.

**Live:** _https://ai-voice-sales-bot-eta.vercel.app_

## Features

- Voice call with an AI sales rep ("Priya") in English or Hindi/Hinglish. She asks about your business, explains relevant features, handles objections (price, already using Excel, no time...) and tries to get you to start a trial or book a demo.
- Live transcript in a chat view
- Start / End call, timer and call status
- Asks for recording consent before the call starts; recording can be played back afterwards
- Summary with customer requirements, objections and next steps
- Sales status: Converted, Interested, Follow-up Required, Not Interested, Demo Requested or No Response
- Call history page with filters by status, and a detail page per call (recording, summary, transcript)

## Stack

- Next.js 15 + TypeScript + Tailwind (web app, deployed on Vercel)
- A self-hosted voice server in `voice-server/` (Python, [Pipecat](https://github.com/pipecat-ai/pipecat)) on our own GPU machine, with open-source models only:
  - Speech-to-text: [Whisper-Hindi2Hinglish Apex](https://huggingface.co/Oriserve/Whisper-Hindi2Hinglish-Apex) (Oriserve) on faster-whisper
  - LLM: [Sarvam-30B](https://huggingface.co/sarvamai/sarvam-30b) served with vLLM (no external API)
  - Text-to-speech: [Indic Parler-TTS](https://huggingface.co/ai4bharat/indic-parler-tts) (AI4Bharat), streamed
  - Silero VAD for turn-taking, with interruptions (talking over the bot stops it)
- Supabase (Postgres) to store calls

## How it works

```
browser ──WebRTC audio──▶ voice-server (Pipecat)
                           Silero VAD → Whisper Apex → Sarvam-30B (vLLM) → Indic Parler-TTS
browser ◀─audio + live transcript (RTVI)─┘
```

1. The browser connects to the voice server over WebRTC with the Pipecat client (`src/hooks/useVoiceCall.ts`). It sends a call id and the language.
2. The voice server loads the sales prompt from the web app (`GET /api/agent-config`, built from `src/lib/assistant.ts` and `src/lib/product.ts`), greets the caller and runs the conversation. A turn ends after 0.4 s of silence (`VAD_STOP_SECS`, 0.3–0.5 s). LLM text and TTS audio are streamed sentence by sentence, and speaking over the bot interrupts it.
3. The live transcript is pushed to the browser and shown in the chat.
4. When the call ends, the transcript is saved through `POST /api/calls`, and the voice server saves the recording.
5. `POST /api/calls/[id]/sync` asks Sarvam-30B for the summary and sales status (JSON-schema constrained) and picks up the recording link from the voice server.
6. The history pages read straight from Supabase.

If the customer doesn't say anything, the call is marked "No Response" right away without waiting for the analysis.

## Running locally

First set up the GPU server: see [`voice-server/README.md`](voice-server/README.md).

Then the web app:

```bash
npm install
cp .env.example .env.local   # voice server URL + shared secret, vLLM URL + key, Supabase keys
npm run dev                  # http://localhost:3001
```

Run `supabase/schema.sql` once in the Supabase SQL editor to create the `calls` table. If your table was created before the move off Vapi, run `alter table calls rename column vapi_call_id to call_id;`.

Use Chrome and allow microphone access.

## Changing the product

Product details, pricing and objection answers are in `src/lib/product.ts`. The sales prompt is generated from that file, so you can switch the bot to a different product by editing it.

## Known limitations

- No login. Anyone with the link can make calls and see the call history.
- The start-call endpoint on the voice server is open to the allowed origins (`ALLOWED_ORIGINS`), the same as the old public Vapi key, so anyone using the site can use GPU time.
- Recordings are stored on the voice server's disk (`DATA_DIR`) and served by unguessable links.
- Hindi replies are written in Devanagari because Indic Parler-TTS reads Hindi best that way, so they show in Devanagari in the transcript. The caller's Hindi is transcribed as romanised Hinglish.
- If the summary or recording is missing, use "Refresh results" on the call page.
