# SPEC.md — Aria Style Brief Observability Instrumentation

## 1. Concept & Vision

Add production-grade tracing to Aria's Style Brief pipeline — making every execution path visible, debuggable, and measurable. Instead of guessing which gate passed or why a card rendered, engineers get a complete trace: inputs, decisions, failures, and outputs — queryable in Postgres and viewable in Langfuse/LangSmith. The goal is a compact, reliable observability layer that doesn't rewrite the existing system but makes it transparent.

## 2. Tech Stack

- **Runtime:** TypeScript / JavaScript
- **Frontend:** React
- **Backend:** Supabase (Postgres, Edge Functions, Row Level Security)
- **LLM:** OpenAI / Anthropic via existing SDK
- **Vision:** Photo analysis (existing pipeline)
- **Observability:** Langfuse | LangSmith | OpenTelemetry (flexible, pick one based on existing infra)
- **Trace Storage:** Supabase Postgres table (primary), Langfuse/LangSmith (secondary UI)

## 3. Style Brief Pipeline — Trace Schema

### 3.1 Trace Row (Postgres)
Every Style Brief attempt creates one row in `style_brief_traces`:

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
trace_id        TEXT NOT NULL  -- stable ID returned to client in dev mode
job_id          TEXT NOT NULL  -- internal job/session reference
user_id         TEXT           -- which user triggered this
session_id      TEXT           -- chat session
created_at      TIMESTAMPTZ DEFAULT now()

-- Pipeline stage tracking
gate_passed     BOOLEAN
gate_reason     TEXT           -- which gate condition or 'n/a'
writer_called   BOOLEAN
writer_model    TEXT           -- e.g. 'gpt-4o', 'claude-3-opus'
writer_input    JSONB          -- full prompt/inputs sent to writer
writer_output   JSONB          -- raw response from writer
validation_passed BOOLEAN
validation_errors JSONB        -- any validation failures
fallback_used   BOOLEAN
fallback_reason TEXT           -- why fallback was triggered

-- Output
source          TEXT           -- which path produced the card: 'writer', 'cache', 'fallback', 'gate_reject'
card_version    TEXT           -- hash of the card content produced
visible_card_id TEXT           -- the final rendered card ID

-- Error tracking
failed_at       TEXT           -- stage where failure occurred
failure_reason  TEXT           -- human-readable reason
stack_trace     TEXT           -- dev mode only
```

### 3.2 Trace API Endpoints

```
POST /traces/style-brief
  Body: { job_id, user_id, session_id, inputs }
  Response: { trace_id, status }

GET /traces/style-brief/:trace_id
  Response: full trace row as JSON

GET /traces/style-brief?user_id=&session_id=&limit=50
  Response: paginated trace list for debugging
```

### 3.3 Observability Integration (Langfuse or LangSmith)

- Initialize Langfuse SDK with `trace_id` as `metadata.trace_id`
- Span for each pipeline stage: `gate_check`, `writer_call`, `validation`, `fallback`, `render`
- Attach trace row ID to Langfuse span for cross-reference
- In dev mode: return `trace_id` in response so engineer can paste into Langfuse UI

## 4. Pipeline Stages to Instrument

### Stage 1: Gate Check
- Log: `{ stage: 'gate', input: { user_profile, session_history }, decision: 'pass'|'fail', reason }`
- Capture: which gate rule fired, what inputs were evaluated

### Stage 2: Style Brief Writer
- Log: `{ stage: 'writer', model, prompt_tokens, completion_tokens, latency_ms }`
- Capture: exact inputs sent to LLM (prompt + image reference + style profile)

### Stage 3: Validation
- Log: `{ stage: 'validation', passed, errors[], latency_ms }`
- Capture: which validation rules were checked, which failed

### Stage 4: Fallback Path
- Log: `{ stage: 'fallback', triggered, reason, fallback_strategy }`
- Capture: what triggered fallback, what strategy was used

### Stage 5: Card Render
- Log: `{ stage: 'render', source, card_id, render_time_ms }`
- Capture: which source produced the visible card (writer | cache | fallback | gate_reject)

## 5. Implementation Steps

### Step 1: Add Postgres Trace Table
Create `style_brief_traces` table with RLS policies. Migration file in `migrations/`.

### Step 2: Create Trace Service
`src/services/traceService.ts` — thin wrapper around Postgres insert + optional Langfuse emit.
```typescript
interface TracePayload {
  job_id: string;
  user_id?: string;
  session_id: string;
  stage: 'gate' | 'writer' | 'validation' | 'fallback' | 'render';
  data: Record<string, unknown>;
}
traceService.emit(payload: TracePayload): string // returns trace_id
```

### Step 3: Instrument Each Pipeline Stage
Modify existing pipeline functions to call `traceService.emit()` at each stage.
- Preserve existing logic — no rewriting of business rules
- Wrap calls in try/catch so tracing never blocks the pipeline

### Step 4: Add Dev Mode Response
In development: append `X-Trace-ID` header and include `trace_id` in JSON response.
In production: trace silently, no trace_id in response.

### Step 5: Verify with One Real Chat Run
After deployment, run one real user conversation. Verify:
- [ ] Trace row appears in Postgres
- [ ] Langfuse shows spans for all 5 stages
- [ ] `trace_id` cross-reference works between Postgres row and Langfuse

## 6. File Structure

```
backend/
├── src/
│   ├── services/
│   │   └── traceService.ts      # Core tracing logic
│   ├── middleware/
│   │   └── traceMiddleware.ts   # HTTP trace context
│   └── pipelines/
│       └── styleBrief/
│           ├── gate.ts          # Instrumented gate check
│           ├── writer.ts        # Instrumented LLM writer
│           ├── validator.ts     # Instrumented validation
│           └── render.ts        # Instrumented card render
├── migrations/
│   └── 001_create_style_brief_traces.sql
├── supabase/
│   └── functions/
│       └── style-brief-trace/   # Edge function for trace ingestion
└── tests/
    └── trace.test.ts            # Unit tests for trace service
```

## 7. Acceptance Criteria

1. Every Style Brief attempt — success or failure — creates a Postgres trace row
2. Failed gates are logged with `gate_passed=false` and `failed_at='gate'`
3. `trace_id` is returned in dev mode responses
4. Langfuse/LangSmith shows spans for all pipeline stages
5. Postgres trace row ID is attached as metadata to Langfuse spans
6. Tracing code does NOT modify pipeline logic — only wraps it
7. One real chat run produces a queryable trace showing the full path

## 8. Constraints

- **No prompt rewriting** — this is observability, not AI engineering
- **Minimal disruption** — existing pipeline must remain functional
- **Backward compatible** — existing API contracts unchanged
- **Trace overhead < 50ms** — non-blocking async writes