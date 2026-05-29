import { traceService } from '../../services/traceService';
import { Request } from 'express';

export interface WriterInput {
  prompt: string;
  image_url?: string;
  style_profile: unknown;
}

export interface WriterOutput {
  content: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
}

export async function callWriter(req: Request, input: WriterInput): Promise<WriterOutput> {
  const startTime = Date.now();
  const model = 'gpt-4o';

  await new Promise(resolve => setTimeout(resolve, 100));

  const latency_ms = Date.now() - startTime;

  const output: WriterOutput = {
    content: `Style brief generated for: ${input.prompt.substring(0, 50)}...`,
    model,
    prompt_tokens: Math.floor(Math.random() * 500) + 100,
    completion_tokens: Math.floor(Math.random() * 200) + 50,
    latency_ms,
  };

  await traceService.saveToPostgres(req.traceId || 'unknown', {
    job_id: req.traceContext?.job_id || 'unknown',
    user_id: req.traceContext?.user_id,
    session_id: req.traceContext?.session_id || 'unknown',
    stage: 'writer',
    data: {
      model: output.model,
      prompt_tokens: output.prompt_tokens,
      completion_tokens: output.completion_tokens,
      latency_ms: output.latency_ms,
      input,
      output: { content: output.content },
    },
  });

  return output;
}