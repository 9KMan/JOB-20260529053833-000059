CREATE TABLE IF NOT EXISTS style_brief_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id TEXT NOT NULL,
    job_id TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    gate_passed BOOLEAN,
    gate_reason TEXT,
    writer_called BOOLEAN,
    writer_model TEXT,
    writer_input JSONB,
    writer_output JSONB,
    validation_passed BOOLEAN,
    validation_errors JSONB,
    fallback_used BOOLEAN,
    fallback_reason TEXT,

    source TEXT,
    card_version TEXT,
    visible_card_id TEXT,

    failed_at TEXT,
    failure_reason TEXT,
    stack_trace TEXT
);

CREATE INDEX idx_style_brief_traces_trace_id ON style_brief_traces(trace_id);
CREATE INDEX idx_style_brief_traces_job_id ON style_brief_traces(job_id);
CREATE INDEX idx_style_brief_traces_user_id ON style_brief_traces(user_id);
CREATE INDEX idx_style_brief_traces_session_id ON style_brief_traces(session_id);
CREATE INDEX idx_style_brief_traces_created_at ON style_brief_traces(created_at DESC);

ALTER TABLE style_brief_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated reads" ON style_brief_traces
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert from authenticated" ON style_brief_traces
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update from authenticated" ON style_brief_traces
    FOR UPDATE USING (auth.role() = 'authenticated');