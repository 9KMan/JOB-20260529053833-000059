import { traceService } from '../../services/traceService';
import { Request } from 'express';

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  latency_ms: number;
}

export async function validateOutput(req: Request, content: unknown): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  await new Promise(resolve => setTimeout(resolve, 20));

  if (!content) {
    errors.push('content_empty');
  }

  if (typeof content === 'string' && content.length < 10) {
    errors.push('content_too_short');
  }

  const latency_ms = Date.now() - startTime;

  await traceService.saveToPostgres(req.traceId || 'unknown', {
    job_id: req.traceContext?.job_id || 'unknown',
    user_id: req.traceContext?.user_id,
    session_id: req.traceContext?.session_id || 'unknown',
    stage: 'validation',
    data: {
      passed: errors.length === 0,
      errors,
      latency_ms,
    },
  });

  return { passed: errors.length === 0, errors, latency_ms };
}