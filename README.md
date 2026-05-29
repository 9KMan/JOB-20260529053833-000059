# Aria Style Brief Observability

**Business Problem Solved:** SaaS fashion marketplace platforms with AI stylist features face a critical challenge — when the Style Brief pipeline fails or takes an unexpected path, engineers have no visibility into what happened. Gates pass or fail silently, the writer may be called or skipped, fallbacks trigger without context, and the rendered card appears with no way to trace why. This makes debugging production issues time-consuming and risky. This project adds production-grade tracing to the Style Brief pipeline, making every execution path visible, debuggable, and measurable.

Production-grade tracing instrumentation for Aria's Style Brief pipeline with TypeScript, Supabase, and Langfuse.

## Overview

This project adds observability to Aria's Style Brief pipeline — making every execution path visible, debuggable, and measurable. Engineers get complete traces: inputs, decisions, failures, and outputs — queryable in Postgres and viewable in Langfuse.

## Tech Stack

- **Runtime:** TypeScript / Node.js
- **Backend:** Express.js with Supabase (Postgres, Edge Functions, RLS)
- **LLM Observability:** Langfuse (with OpenTelemetry support)
- **Trace Storage:** Supabase Postgres (primary), Langfuse (secondary UI)

## Quick Start

```bash
npm install
npm run dev
```

## Environment Variables

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
LANGFUSE_PUBLIC_KEY=your_langfuse_key
LANGFUSE_SECRET_KEY=your_langfuse_secret
LANGFUSE_HOST=https://cloud.langfuse.com
NODE_ENV=development
PORT=3000
```

## API Endpoints

### Create Trace
```bash
curl -X POST http://localhost:3000/traces/style-brief \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job-123", "session_id": "sess-456", "inputs": {}}'
```

### Get Trace
```bash
curl http://localhost:3000/traces/style-brief/:trace_id
```

### List Traces
```bash
curl http://localhost:3000/traces/style-brief?user_id=user-123&limit=50
```

### Execute Style Brief (Full Pipeline)
```bash
curl -X POST http://localhost:3000/style-brief/execute \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job-123", "session_id": "sess-456", "prompt": "Create style brief", "style_profile": {}}'
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Style Brief Pipeline                        │
├─────────────────────────────────────────────────────────────────┤
│  Gate Check → Writer → Validation → Fallback → Render           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Trace Service                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Postgres  │    │   Langfuse │    │  Dev Mode   │          │
│  │   (primary) │    │ (secondary)│    │   trace_id  │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Trace Schema

| Field | Type | Description |
|-------|------|-------------|
| trace_id | TEXT | Stable identifier returned to client |
| job_id | TEXT | Internal job/session reference |
| gate_passed | BOOLEAN | Whether gate condition passed |
| writer_called | BOOLEAN | Whether LLM writer was invoked |
| validation_passed | BOOLEAN | Whether output passed validation |
| source | TEXT | Path that produced card: writer, cache, fallback, gate_reject |

## Pipeline Stages

1. **Gate Check** - Evaluates user profile and session history
2. **Writer** - Calls LLM with prompt and style profile
3. **Validation** - Validates writer output
4. **Fallback** - Triggered if validation fails
5. **Render** - Produces visible card with trace metadata

## Development

```bash
# Run tests
npm test

# Type check
npx tsc --noEmit

# Start dev server
npm run dev
```

## Docker

```bash
docker build -t aria-observability .
docker run -p 3000:3000 --env-file .env aria-observability
```