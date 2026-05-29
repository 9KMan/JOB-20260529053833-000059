import { traceService } from '../../services/traceService';
import { Request } from 'express';

export interface GateResult {
  passed: boolean;
  reason: string;
  input: {
    user_profile: unknown;
    session_history: unknown;
  };
}

export async function checkGate(req: Request): Promise<GateResult> {
  const user_profile = req.body?.user_profile;
  const session_history = req.body?.session_history;

  await new Promise(resolve => setTimeout(resolve, 10));

  let passed = true;
  let reason = 'n/a';

  if (!user_profile) {
    passed = false;
    reason = 'missing_user_profile';
  } else if ((user_profile as any)?.banned) {
    passed = false;
    reason = 'user_banned';
  }

  await traceService.saveToPostgres(req.traceId || 'unknown', {
    job_id: req.traceContext?.job_id || 'unknown',
    user_id: req.traceContext?.user_id,
    session_id: req.traceContext?.session_id || 'unknown',
    stage: 'gate',
    data: {
      input: { user_profile, session_history },
      decision: passed ? 'pass' : 'fail',
      reason,
    },
  });

  return { passed, reason, input: { user_profile, session_history } };
}