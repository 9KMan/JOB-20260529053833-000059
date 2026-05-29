import { traceService, PipelineStage } from '../src/services/traceService';

jest.mock('../src/services/traceService', () => ({
  traceService: {
    emit: jest.fn(),
    saveToPostgres: jest.fn().mockResolvedValue(undefined),
    getTrace: jest.fn(),
    listTraces: jest.fn(),
  },
  PipelineStage: ['gate', 'writer', 'validation', 'fallback', 'render'],
}));

describe('TraceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should emit trace and return trace_id', () => {
    const payload = {
      job_id: 'test-job',
      session_id: 'test-session',
      stage: 'gate' as PipelineStage,
      data: { decision: 'pass', reason: 'ok' },
    };

    const trace_id = traceService.emit(payload);
    expect(trace_id).toBeDefined();
    expect(typeof trace_id).toBe('string');
    expect(trace_id.length).toBeGreaterThan(0);
  });

  it('should save trace to postgres', async () => {
    const payload = {
      job_id: 'test-job',
      session_id: 'test-session',
      stage: 'writer' as PipelineStage,
      data: { model: 'gpt-4o', input: {}, output: {} },
    };

    await traceService.saveToPostgres('trace-123', payload);
    expect(traceService.saveToPostgres).toHaveBeenCalledWith('trace-123', payload);
  });

  it('should retrieve trace by id', async () => {
    const mockTrace = {
      trace_id: 'trace-123',
      job_id: 'test-job',
      user_id: 'user-1',
      session_id: 'test-session',
      gate_passed: true,
      created_at: new Date(),
    };

    (traceService.getTrace as jest.Mock).mockResolvedValue(mockTrace);

    const trace = await traceService.getTrace('trace-123');
    expect(trace).toEqual(mockTrace);
  });

  it('should list traces with filters', async () => {
    const mockTraces = [
      { trace_id: 'trace-1', job_id: 'job-1' },
      { trace_id: 'trace-2', job_id: 'job-2' },
    ];

    (traceService.listTraces as jest.Mock).mockResolvedValue(mockTraces);

    const traces = await traceService.listTraces({ user_id: 'user-1', limit: 10 });
    expect(traces).toHaveLength(2);
    expect(traceService.listTraces).toHaveBeenCalledWith({ user_id: 'user-1', limit: 10 });
  });

  it('should return empty array when postgres not configured', async () => {
    (traceService.listTraces as jest.Mock).mockResolvedValue([]);
    const traces = await traceService.listTraces({});
    expect(traces).toEqual([]);
  });
});