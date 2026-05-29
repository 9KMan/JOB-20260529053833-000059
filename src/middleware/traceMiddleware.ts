import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      traceContext?: {
        trace_id: string;
        job_id?: string;
        session_id?: string;
        user_id?: string;
      };
    }
  }
}

export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId = req.headers['x-trace-id'] as string || uuidv4();
  req.traceId = traceId;

  req.traceContext = {
    trace_id: traceId,
    job_id: req.headers['x-job-id'] as string,
    session_id: req.headers['x-session-id'] as string,
    user_id: req.headers['x-user-id'] as string,
  };

  const isDevMode = process.env.NODE_ENV !== 'production';

  if (isDevMode) {
    res.setHeader('X-Trace-ID', traceId);
  }

  next();
}

export function attachTraceContext(req: Request, context: {
  job_id: string;
  user_id?: string;
  session_id: string;
}): void {
  req.traceContext = {
    trace_id: req.traceId || uuidv4(),
    ...context,
  };
}