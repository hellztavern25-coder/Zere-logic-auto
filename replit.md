# ZereØ — Logic Monster AI Butler

A full-stack AI assistant ("ZereØ / The Steward") with a React frontend and Express backend, featuring real-time Socket.io comms, Gemini + Anthropic AI, and optional Discord integration.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend:** Express 5, tsx (dev), Socket.io
- **AI:** Google Gemini (`@google/genai`), Anthropic Claude (`@anthropic-ai/sdk`)
- **Discord:** discord.js 14 (optional; requires DISCORD_TOKEN)

## How to run

```
npm run dev
```

Server starts on port 5000. The Express server serves both the API/WebSocket layer and the Vite dev frontend middleware in one process.

## Required secrets

| Secret | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API — primary AI model |
| `API_KEY` | Anthropic Claude API — secondary AI model |
| `DISCORD_TOKEN` | Discord bot token — optional, enables Discord integration |

Set these in Replit Secrets. The app runs without them but AI chat and Discord features will fail until they are provided.

## Key files

- `server.ts` — Express + Socket.io server, Vite middleware, Discord bot setup
- `App.tsx` / `components/` — React UI (Chat, Memory Core, Neural Broker, Voice Portal, etc.)
- `services/` — Gemini and Anthropic API service wrappers
- `config.json` — Runtime config (`coreDirective`, `isPrincipalActive`)
- `memories.json` / `threads.json` — Persistent memory and conversation threads
- `AGENTS.md` — ZereØ persona and operational directives

## Notes

- `protobufjs` is overridden to `^8.0.0` in `package.json` to satisfy Replit's security policy (discord.js was pulling in a CVE-flagged 7.x version).
