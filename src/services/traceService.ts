import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export type PipelineStage = 'gate' | 'writer' | 'validation' | 'fallback' | 'render';

export interface TracePayload {
  job_id: string;
  user_id?: string;
  session_id: string;
  stage: PipelineStage;
  data: Record<string, unknown>;
}

export interface TraceRecord {
  trace_id: string;
  job_id: string;
  user_id?: string;
  session_id: string;
  created_at: Date;
  gate_passed?: boolean;
  gate_reason?: string;
  writer_called?: boolean;
  writer_model?: string;
  writer_input?: Record<string, unknown>;
  writer_output?: Record<string, unknown>;
  validation_passed?: boolean;
  validation_errors?: unknown[];
  fallback_used?: boolean;
  fallback_reason?: string;
  source?: string;
  card_version?: string;
  visible_card_id?: string;
  failed_at?: string;
  failure_reason?: string;
  stack_trace?: string;
}

class TraceService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private langfuseClient: any = null;
  private isDevMode: boolean;

  constructor() {
    this.isDevMode = process.env.NODE_ENV !== 'production';
    this.initializeClients();
  }

  private initializeClients() {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    }

    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      try {
        const { Langfuse } = require('@langfuse/node');
        this.langfuseClient = new Langfuse({
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          secretKey: process.env.LANGFUSE_SECRET_KEY,
          baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
        });
      } catch (e) {
        console.warn('Langfuse initialization failed:', e);
      }
    }
  }

  emit(payload: TracePayload): string {
    const trace_id = uuidv4();

    this.saveToPostgres(trace_id, payload).catch(err => {
      console.error('Failed to save trace to Postgres:', err);
    });

    if (this.langfuseClient) {
      this.emitToLangfuse(trace_id, payload).catch(err => {
        console.error('Failed to emit trace to Langfuse:', err);
      });
    }

    return trace_id;
  }

  async saveToPostgres(trace_id: string, payload: TracePayload): Promise<void> {
    if (!this.supabase) return;

    const existingTrace = await this.supabase
      .from('style_brief_traces')
      .select('id')
      .eq('trace_id', trace_id)
      .single();

    const stageData = this.buildStageData(payload.stage, payload.data);

    if (existingTrace.data) {
      await (this.supabase
        .from('style_brief_traces') as any)
        .update({ ...stageData, trace_id })
        .eq('trace_id', trace_id);
    } else {
      await (this.supabase
        .from('style_brief_traces') as any)
        .insert({
          trace_id,
          job_id: payload.job_id,
          user_id: payload.user_id,
          session_id: payload.session_id,
          ...stageData,
        });
    }
  }

  private buildStageData(stage: PipelineStage, data: Record<string, unknown>): Partial<TraceRecord> {
    switch (stage) {
      case 'gate':
        return {
          gate_passed: data.decision === 'pass',
          gate_reason: data.reason as string,
          failed_at: data.decision === 'fail' ? 'gate' : undefined,
          failure_reason: data.decision === 'fail' ? data.reason as string : undefined,
        };
      case 'writer':
        return {
          writer_called: true,
          writer_model: data.model as string,
          writer_input: data.input as Record<string, unknown>,
          writer_output: data.output as Record<string, unknown>,
        };
      case 'validation':
        return {
          validation_passed: data.passed as boolean,
          validation_errors: data.errors as unknown[],
        };
      case 'fallback':
        return {
          fallback_used: true,
          fallback_reason: data.reason as string,
        };
      case 'render':
        return {
          source: data.source as string,
          card_version: data.card_version as string,
          visible_card_id: data.card_id as string,
        };
      default:
        return {};
    }
  }

  async emitToLangfuse(trace_id: string, payload: TracePayload): Promise<void> {
    if (!this.langfuseClient) return;

    const generation = this.langfuseClient.startGeneration({
      name: payload.stage,
      model: payload.stage === 'writer' ? (payload.data.model as string) : undefined,
      input: payload.stage === 'writer' ? payload.data.input : payload.data,
      metadata: { trace_id, job_id: payload.job_id, session_id: payload.session_id },
    });

    if (payload.stage === 'writer' && payload.data.output) {
      generation.end({
        output: payload.data.output,
      });
    } else {
      generation.end();
    }
  }

  async getTrace(trace_id: string): Promise<TraceRecord | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('style_brief_traces')
      .select('*')
      .eq('trace_id', trace_id)
      .single();

    if (error) return null;
    return data as TraceRecord;
  }

  async listTraces(filters: {
    user_id?: string;
    session_id?: string;
    limit?: number;
  }): Promise<TraceRecord[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('style_brief_traces')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters.session_id) {
      query = query.eq('session_id', filters.session_id);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) return [];

    return data as TraceRecord[];
  }
}

export const traceService = new TraceService();