import express from 'express';
import { traceMiddleware } from './middleware/traceMiddleware';
import { traceService } from './services/traceService';
import { checkGate } from './pipelines/styleBrief/gate';
import { callWriter } from './pipelines/styleBrief/writer';
import { validateOutput } from './pipelines/styleBrief/validator';
import { renderCard } from './pipelines/styleBrief/render';

const app = express();
app.use(express.json());
app.use(traceMiddleware);

interface CreateTraceRequest {
  job_id: string;
  user_id?: string;
  session_id: string;
  inputs?: Record<string, unknown>;
}

app.post('/traces/style-brief', async (req, res) => {
  try {
    const { job_id, user_id, session_id, inputs } = req.body as CreateTraceRequest;

    const trace_id = traceService.emit({
      job_id,
      user_id,
      session_id,
      stage: 'gate',
      data: inputs || {},
    });

    const isDevMode = process.env.NODE_ENV !== 'production';

    res.json({ trace_id, status: 'started' }).status(201);
  } catch (error) {
    console.error('Failed to create trace:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/traces/style-brief/:trace_id', async (req, res) => {
  try {
    const trace = await traceService.getTrace(req.params.trace_id);

    if (!trace) {
      res.status(404).json({ error: 'Trace not found' });
      return;
    }

    res.json(trace);
  } catch (error) {
    console.error('Failed to get trace:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/traces/style-brief', async (req, res) => {
  try {
    const { user_id, session_id, limit } = req.query;

    const traces = await traceService.listTraces({
      user_id: user_id as string,
      session_id: session_id as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });

    res.json({ traces });
  } catch (error) {
    console.error('Failed to list traces:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/style-brief/execute', async (req, res) => {
  try {
    const { job_id, user_id, session_id, user_profile, session_history, prompt, image_url, style_profile } = req.body;

    const gateResult = await checkGate({ body: { user_profile, session_history }, traceContext: { trace_id: req.traceId || '', job_id, session_id, user_id } } as any);

    if (!gateResult.passed) {
      res.status(200).json({ source: 'gate_reject', reason: gateResult.reason });
      return;
    }

    const writerOutput = await callWriter({ traceContext: { trace_id: req.traceId || '', job_id, session_id, user_id } } as any, {
      prompt,
      image_url,
      style_profile,
    });

    const validationResult = await validateOutput({ traceContext: { trace_id: req.traceId || '', job_id, session_id, user_id } } as any, writerOutput.content);

    let source = 'writer';
    let content = writerOutput.content;

    if (!validationResult.passed) {
      source = 'fallback';
    }

    const renderResult = await renderCard({ traceContext: { trace_id: req.traceId || '', job_id, session_id, user_id } } as any, content, source);

    res.json({
      trace_id: req.traceId,
      ...renderResult,
      validation_errors: validationResult.errors,
    });
  } catch (error) {
    console.error('Style brief execution failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (_, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;