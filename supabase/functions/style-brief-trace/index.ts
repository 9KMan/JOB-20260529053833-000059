import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { trace_id, job_id, user_id, session_id, stage, data } = await req.json();

  const stageData: Record<string, unknown> = {};

  switch (stage) {
    case 'gate':
      stageData.gate_passed = data.decision === 'pass';
      stageData.gate_reason = data.reason;
      if (data.decision === 'fail') {
        stageData.failed_at = 'gate';
        stageData.failure_reason = data.reason;
      }
      break;
    case 'writer':
      stageData.writer_called = true;
      stageData.writer_model = data.model;
      stageData.writer_input = data.input;
      stageData.writer_output = data.output;
      break;
    case 'validation':
      stageData.validation_passed = data.passed;
      stageData.validation_errors = data.errors;
      break;
    case 'fallback':
      stageData.fallback_used = true;
      stageData.fallback_reason = data.reason;
      break;
    case 'render':
      stageData.source = data.source;
      stageData.card_version = data.card_version;
      stageData.visible_card_id = data.card_id;
      break;
  }

  const { error } = await supabase.from('style_brief_traces').upsert({
    trace_id,
    job_id,
    user_id,
    session_id,
    ...stageData,
  }, { onConflict: 'trace_id' });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});