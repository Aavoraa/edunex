import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import {
  Badge, Banner, Button, Card, ErrorState, Grid, Page, PageHead, PageSkeleton, SelectField, Switch, TextField,
} from '@/components/ui';
import { errorMessage } from '@/components/ui/states';
import { fmt } from '@/lib/format';
import { BASE, EV, Connecting, NotConnected, usePcStatus } from './shared';

type ProviderId = 'claude' | 'openai' | 'gemini';
interface Provider { id: ProviderId; label: string; company: string; key_prefix: string; models: { id: string; label: string }[] }
interface AiConfig {
  config: Record<string, unknown> & {
    ai_provider: ProviderId; claude_enabled: boolean; claude_effort: string;
    claude_timeout: number | null; max_retries: number | null; claude_refusal_fallback: boolean; external_processing_acknowledged: boolean;
    external_processing_acknowledged_by: { user: string; at: string; provider?: string } | null; redact_top_percent: number | null;
  };
  options: { providers: Provider[]; efforts: string[] };
}
interface TestResult { ok: boolean; target: string; detail?: string; model?: string; duration_ms?: number; sample_text?: string; sample_name?: string | null }

const PROVIDER_IDS: ProviderId[] = ['claude', 'openai', 'gemini'];
const MODEL_KEYS = PROVIDER_IDS.flatMap((p) => [`${p}_vision_model`, `${p}_eval_model`]);
const OTHER = '__other__';

/**
 * Settings → AI Configuration for Paper Correction. The school picks one AI provider (Claude, ChatGPT or
 * Gemini); each keeps its own key and models. Keys go in and never come back out.
 */
export default function AiSettingsPage() {
  const st = usePcStatus();
  const q = useApiQuery<AiConfig>(st.data?.connected && st.data.role === 'admin' ? `${EV}/settings/ai` : null);
  const [f, setF] = useState<Record<string, string | boolean>>({});
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [custom, setCustom] = useState<Record<string, boolean>>({});
  const [test, setTest] = useState<TestResult | 'running' | null>(null);
  useEffect(() => {
    const c = q.data?.config;
    if (!c) return;
    setF({
      ai_provider: c.ai_provider, claude_enabled: !!c.claude_enabled, claude_effort: c.claude_effort,
      ...Object.fromEntries(MODEL_KEYS.map((k) => [k, String(c[k] ?? '')])),
      claude_timeout: String(c.claude_timeout ?? ''), max_retries: String(c.max_retries ?? ''), claude_refusal_fallback: !!c.claude_refusal_fallback,
      external_processing_acknowledged: !!c.external_processing_acknowledged, redact_top_percent: String(c.redact_top_percent ?? 0),
    });
  }, [q.data]);
  const save = useApiMutation<{ changes: Record<string, unknown> }>('put', `${EV}/settings/ai`, {
    invalidate: ['/exam-correction'], success: 'AI configuration saved', onSuccess: () => setKeys({}),
  });

  if (st.isLoading) return <Page><PageHead title="AI configuration" /><Connecting /></Page>;
  if (q.isLoading) return <Page><PageSkeleton /></Page>;
  if (st.data && !st.data.connected) return <Page><PageHead title="AI configuration" /><NotConnected status={st.data} onRetry={() => st.refetch()} /></Page>;
  if (st.data?.role !== 'admin') return <Page><PageHead title="AI configuration" /><Banner tone="neutral" icon="lock">Only administrators who manage settings can change the AI configuration.</Banner></Page>;
  if (q.error || !q.data) return <Page><PageHead title="AI configuration" /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
  const { config: c, options } = q.data;
  const set = (k: string) => (v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const pid = (f.ai_provider as ProviderId) || c.ai_provider;
  const provider = options.providers.find((p) => p.id === pid) ?? options.providers[0];
  const savedKey = c[`${pid}_api_key`] as string | null;
  const key = keys[pid] ?? '';
  const num = (v: string | boolean) => (v === '' ? null : Number(v));

  // Choosing a provider: the acknowledgement covers one provider only, so another one asks again.
  const pickProvider = (v: string) => setF((x) => ({
    ...x, ai_provider: v,
    external_processing_acknowledged: v === c.ai_provider ? !!c.external_processing_acknowledged : false,
  }));

  // A model list, plus "Other model…" for ChatGPT and Gemini, whose newer models can be typed in.
  const modelField = (label: string, k: string) => {
    const value = f[k] as string;
    const opts = provider.models.map((m) => ({ value: m.id, label: m.label }));
    const known = opts.some((o) => o.value === value);
    const typing = pid !== 'claude' && (custom[k] || !known);
    const choices = pid === 'claude'
      ? (known ? opts : [...opts, { value, label: value }])
      : [...opts, { value: OTHER, label: 'Other model…' }];
    return (
      <>
        <SelectField label={label} value={typing ? OTHER : value} options={choices}
          onChange={(v) => {
            if (v === OTHER) { setCustom((x) => ({ ...x, [k]: true })); return; }
            setCustom((x) => ({ ...x, [k]: false })); set(k)(v);
          }} />
        {typing && <TextField label={`${label}: model id`} value={value} onChange={set(k)}
          placeholder={pid === 'openai' ? 'e.g. gpt-5' : 'e.g. gemini-3.8-flash'} hint={`Any ${provider.company} model that accepts images and JSON output.`} />}
      </>
    );
  };

  // A browser may autofill a saved sign-in password here; only accept something shaped like this provider's key:
  // its known prefix, or (Gemini, whose key format has changed over time) a long value without spaces.
  const k = key.trim();
  const keyError = !k ? ''
    : provider.key_prefix ? (k.startsWith(provider.key_prefix) ? '' : `This is not a ${provider.label} API key — they start with "${provider.key_prefix}". Clear the field if your browser filled in a password.`)
    : (k.length >= 30 && !/\s/.test(k) ? '' : `This does not look like a ${provider.label} API key — copy the whole key from ${pid === 'gemini' ? 'Google AI Studio' : provider.company}. Clear the field if your browser filled in a password.`);
  const dirty = Object.values(keys).some(Boolean) || Object.entries(f).some(([k, v]) => {
    const cur = c[k];
    return typeof v === 'boolean' ? v !== !!cur : v !== String(cur ?? '');
  });
  const changes = () => ({
    changes: {
      ai_provider: f.ai_provider, claude_enabled: f.claude_enabled, claude_effort: f.claude_effort,
      ...Object.fromEntries(MODEL_KEYS.filter((k) => f[k] !== String(c[k] ?? '')).map((k) => [k, (f[k] as string).trim()])),
      claude_timeout: num(f.claude_timeout), max_retries: num(f.max_retries), claude_refusal_fallback: f.claude_refusal_fallback,
      external_processing_acknowledged: f.external_processing_acknowledged, redact_top_percent: num(f.redact_top_percent),
      ...Object.fromEntries(Object.entries(keys).filter(([, v]) => v).map(([p, v]) => [`${p}_api_key`, v!.trim()])),
    },
  });
  const submit = () => { if (!keyError) save.mutate(changes()); };
  const runTest = async (target: 'reading' | 'marking', sample = false) => {
    if (keyError) return;
    setTest('running');
    try {
      if (dirty) await save.mutateAsync(changes()); // tests use the saved configuration
      setTest((await api.postLong<TestResult>(`${EV}/settings/ai/test/${target}${sample ? '?sample=true' : ''}`)).data);
    } catch (e) { setTest({ ok: false, target, detail: errorMessage(e) }); }
  };
  const ackBy = c.external_processing_acknowledged_by;

  return (
    <Page>
      <PageHead title="AI configuration" crumbs={[{ label: 'Paper Correction', to: BASE }, { label: 'AI configuration' }]}
        sub="Choose the AI that reads the answer sheets and marks them. API keys are stored encrypted on the marking service and never shown again."
        actions={<Button variant="primary" icon="save" loading={save.isPending} onClick={submit}>Save configuration</Button>} />
      <Grid cols="g-2col">
        <Card icon="sparkle" title="AI provider">
          <div className="col g-3">
            <Switch checked={!!f.claude_enabled} onChange={set('claude_enabled')} label="Enabled" />
            <SelectField label="Provider" value={pid} onChange={pickProvider}
              options={options.providers.map((p) => ({ value: p.id, label: p.label }))}
              hint="Only the chosen provider is used. Each one keeps its own key and models." />
            <TextField label={`${provider.label} API key`} type="password" name={`${pid}-api-key`} autoComplete="new-password" value={key}
              onChange={(v) => { setKeys((x) => ({ ...x, [pid]: v })); if (v && !f.claude_enabled) set('claude_enabled')(true); }} error={keyError || undefined}
              placeholder={savedKey ? `set (${savedKey}) — type to replace` : 'not set'}
              hint="Stored encrypted; never sent back to the browser." />
            {modelField('Model for reading sheets', `${pid}_vision_model`)}
            {modelField('Model for marking answers', `${pid}_eval_model`)}
            <div className="grid g-2col g-3">
              {pid !== 'gemini'
                ? <SelectField label="Effort" value={f.claude_effort as string} onChange={set('claude_effort')} options={options.efforts} hint="Higher is more thorough, slower and costlier." />
                : <div />}
              <TextField label="Timeout (seconds)" type="number" min={10} value={f.claude_timeout as string} onChange={set('claude_timeout')} />
            </div>
            <TextField label="Retries for temporary failures" type="number" min={0} max={5} value={f.max_retries as string} onChange={set('max_retries')} />
            {pid === 'claude' && <Switch checked={!!f.claude_refusal_fallback} onChange={set('claude_refusal_fallback')} label="Use Anthropic's server-side refusal fallback" />}
          </div>
        </Card>
        <Card icon="shield" title={`Sending student pages to ${provider.company}`}>
          <div className="col g-3">
            <Banner tone="warning" icon="alert">
              Every answer sheet is read by {provider.label}, so photographs of students' work are sent to {provider.company}. Before using it, make sure the
              school's consent and data-processing arrangements cover this (for children's data, parental consent).
            </Banner>
            <Switch checked={!!f.external_processing_acknowledged} onChange={set('external_processing_acknowledged')} label="I acknowledge this external processing on behalf of the school" />
            {pid !== c.ai_provider && <p className="t-xs t-muted">A different provider needs its own acknowledgement.</p>}
            {pid === c.ai_provider && c.external_processing_acknowledged && ackBy && <p className="t-xs t-muted">Acknowledged by {ackBy.user}{ackBy.at ? ` on ${fmt.dateTime(ackBy.at)}` : ''}</p>}
            <TextField label="Blank this % of the top of page 1 before sending" type="number" min={0} max={50} value={f.redact_top_percent as string} onChange={set('redact_top_percent')}
              hint="0 = off. Blanking hides the name and roll number, but then the name on the sheet cannot be checked against the chosen student." />
          </div>
        </Card>
      </Grid>
      <div className="mt-4">
        <Card icon="activity" title="Test the connection" sub="Unsaved changes are saved first.">
          <div className="row g-2 wrap">
            <Button disabled={test === 'running'} onClick={() => runTest('marking')}>Test marking model</Button>
            <Button disabled={test === 'running'} onClick={() => runTest('reading')}>Test reading model</Button>
            <Button disabled={test === 'running'} onClick={() => runTest('reading', true)}>Read a sample page</Button>
          </div>
          {test === 'running' && <p className="t-sm t-muted mt-3">Testing…</p>}
          {test && test !== 'running' && (
            <div className="mt-3 col g-2">
              <div className="row g-2 wrap t-sm"><Badge tone={test.ok ? 'success' : 'critical'}>{test.ok ? 'OK' : 'FAILED'}</Badge>
                <span>{test.target}: {test.detail}{test.model ? ` · ${test.model}` : ''}{test.duration_ms ? ` · ${test.duration_ms} ms` : ''}</span></div>
              {test.sample_text && <div className="pc-answer">{test.sample_name ? `Name: ${test.sample_name}\n` : ''}{test.sample_text}</div>}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
