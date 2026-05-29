import { traceService } from '../../services/traceService';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RenderResult {
  source: string;
  card_id: string;
  card_version: string;
  render_time_ms: number;
}

export async function renderCard(req: Request, content: unknown, source: string): Promise<RenderResult> {
  const startTime = Date.now();
  const card_id = uuidv4();
  const card_version = `v_${Date.now()}`;

  await new Promise(resolve => setTimeout(resolve, 50));

  const render_time_ms = Date.now() - startTime;

  await traceService.saveToPostgres(req.traceId || 'unknown', {
    job_id: req.traceContext?.job_id || 'unknown',
    user_id: req.traceContext?.user_id,
    session_id: req.traceContext?.session_id || 'unknown',
    stage: 'render',
    data: {
      source,
      card_id,
      card_version,
      render_time_ms,
    },
  });

  return { source, card_id, card_version, render_time_ms };
}