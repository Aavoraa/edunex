import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import { useLookups } from '@/hooks/useLookups';
import { useSchool } from '@/layouts/SchoolContext';
import {
  AiNotice, Badge, Banner, Button, Card, DataTable, ErrorState, Grid, InlineError, Kpi, Modal, Page, PageHead, SearchInput,
  SelectField, TextArea, TextField, Toolbar,
} from '@/components/ui';
import { fmt } from '@/lib/format';
import { boardInfo, type Board } from '@/lib/grades';
import { AiNotReady, BASE, Connecting, EV, EvStatus, marks, NotConnected, useBoardOf, useClassLabel, usePcStatus, type Exam } from './shared';

/** Every examination, or (with `board`) one board's — Academics → IGCSE / CBSE / … → Paper Correction. */
export default function ExamsPage({ board }: { board?: Board } = {}) {
  const navigate = useNavigate();
  const st = usePcStatus();
  const connected = !!st.data?.connected;
  const exams = useApiQuery<Exam[]>(connected ? `${EV}/exams` : null);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const role = st.data?.role;
  const manager = role === 'admin' || role === 'coordinator';
  const sync = useApiMutation('post', '/exam-correction/sync', { invalidate: ['/exam-correction'] });
  const boardOf = useBoardOf();
  const info = board ? boardInfo(board) : null;

  const mine = useMemo(() => (exams.data ?? []).filter((e) => !board || boardOf(e) === board), [exams.data, board, boardOf]);
  const rows = useMemo(() => {
    const t = q.toLowerCase();
    return mine.filter((e) => !t || `${e.name} ${e.subject} ${e.class_name} ${e.section}`.toLowerCase().includes(t));
  }, [mine, q]);
  const sum = (k: keyof Exam['counts']) => mine.reduce((a, e) => a + e.counts[k], 0);

  return (
    <Page>
      <PageHead title={info ? `${info.menu} Paper Correction` : 'Paper Correction'}
        sub={info
          ? `${info.label} classes only. The AI marks the way ${info.awardingBody} mark schemes do and results are graded ${info.range}. Teachers check and approve every mark.`
          : 'The AI reads handwritten answer sheets and suggests marks against your rubrics, following each class\'s board. Teachers check and approve every mark.'}
        actions={connected && <>
          {role === 'admin' && <Button icon="settings" to={`${BASE}/settings`}>AI configuration</Button>}
          {manager && <Button icon="refresh" loading={sync.isPending} onClick={() => sync.mutate(undefined)}>Sync students & staff</Button>}
          {manager && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New examination</Button>}
        </>} />

      {st.isLoading ? <Connecting /> : st.error ? <ErrorState error={st.error} onRetry={() => st.refetch()} />
        : !connected ? <NotConnected status={st.data} onRetry={() => st.refetch()} />
        : (
          <>
            <div className="col g-3 mb-4">
              <AiNotice><strong>Advisory only.</strong> The AI's marks are suggestions. A teacher confirms each student's identity, checks the transcription and approves every mark before results are published.</AiNotice>
              <AiNotReady ai={st.data?.ai} />
            </div>
            <Grid cols="g-4col">
              <Kpi icon="clipboard" label="Examinations" value={mine.length} loading={exams.isLoading}
                foot={manager ? 'All examinations' : 'Assigned to you'} />
              <Kpi icon="fileText" label="Answer sheets" value={sum('submissions')} loading={exams.isLoading} tone="info"
                foot={sum('processing') ? `${sum('processing')} being read or marked` : 'None in progress'} />
              <Kpi icon="eye" label="Awaiting review" value={sum('pending_review')} loading={exams.isLoading} tone="amber" foot="Sheets with marks to check" />
              <Kpi icon="alert" label="Need attention" value={sum('failed')} loading={exams.isLoading} tone={sum('failed') ? 'critical' : 'teal'}
                foot={`${sum('approved')} sheet(s) fully approved`} />
            </Grid>

            <div className="mt-4">
              <Card icon="checkSquare" title="Examinations" flush
                sub={st.data?.lastSync ? `Roster synced ${fmt.relative(st.data.lastSync.at)} · ${st.data.ai?.vision_model ?? ''}` : undefined}>
                <Toolbar><SearchInput value={q} onSearch={setQ} placeholder="Search by name, subject or class" /></Toolbar>
                {exams.error ? <ErrorState error={exams.error} onRetry={() => exams.refetch()} /> : (
                  <DataTable rows={rows} loading={exams.isLoading} rowKey={(e) => e.id} onRowClick={(e) => navigate(`${BASE}/exams/${e.id}`)}
                    emptyText={info ? `No ${info.label} examinations yet.${manager ? ' Create one to start.' : ''}` : manager ? 'No examinations yet. Create one to start.' : 'No examinations are assigned to you yet.'}
                    columns={[
                      {
                        key: 'name', label: 'Examination', render: (e) => <><span className="t-bold">{e.name}</span>
                          <div className="t-micro t-muted">{e.academic_year} · {e.subject}{e.syllabus_title ? ` · ${e.syllabus_title}${e.component_name ? `, ${e.component_name}` : ''}` : ' · no syllabus linked'}</div></>,
                      },
                      { key: 'class', label: 'Class', render: (e) => `${e.class_name}${e.section ? ` · ${e.section}` : ''}` },
                      ...(board ? [] : [{ key: 'board', label: 'Board', render: (e: Exam) => <Badge>{boardInfo(boardOf(e)).short}</Badge> }]),
                      { key: 'q', label: 'Questions', className: 'num', render: (e) => <span className="t-num">{e.question_count} ({marks(e.maximum)} marks)</span> },
                      { key: 'sheets', label: 'Sheets', className: 'num', render: (e) => <span className="t-num">{e.counts.submissions}</span> },
                      { key: 'review', label: 'To review', className: 'num', render: (e) => <span className="t-num">{e.counts.pending_review}</span> },
                      { key: 'approved', label: 'Approved', className: 'num', render: (e) => <span className="t-num">{e.counts.approved}</span> },
                      { key: 'attn', label: 'Attention', className: 'num', render: (e) => e.counts.failed ? <Badge tone="critical">{e.counts.failed}</Badge> : <span className="t-num">0</span> },
                      { key: 'results', label: 'Results', render: (e) => <EvStatus value={e.results_status} /> },
                    ]} />
                )}
              </Card>
            </div>
          </>
        )}
      {creating && <ExamModal board={board} onClose={() => setCreating(false)} onSaved={(e) => navigate(`${BASE}/exams/${e.id}?tab=questions`)} />}
    </Page>
  );
}

// ---------------------------------------------------------------------------

/**
 * Create or edit an examination. Class and section come from Edunex so they match the synced roster; the
 * exam takes the class's board, which sets how the AI drafts rubrics and marks. With `board`, only that
 * board's classes are offered.
 */
interface SyllabusPaper { id: string; paperNo: string; name: string; tier: string; maxMarks: number | null }
interface SyllabusOption { id: string; syllabusCode: string | null; title: string; gradeLevels: number[]; components: SyllabusPaper[] }
interface SyllabusDetail extends SyllabusOption {
  awardingBody: string | null;
  topics: { unitNo: number | string | null; code: string | null; title: string; subtopics: string | null; tier: string | null }[];
}

/** "Paper 3 (Core) — Theory (Core)": the paper's own name, with its number when the name lacks one. */
const paperLabel = (p: SyllabusPaper) => (/^paper\s/i.test(p.name) ? p.name : `Paper ${p.paperNo} — ${p.name}`);

/** What the AI is told about the syllabus: its title, the paper and the units that paper covers. */
function syllabusContext(s: SyllabusDetail, paper?: SyllabusPaper) {
  const units = (s.topics ?? []).filter((t) => !paper || !paper.tier || paper.tier === 'All' || !t.tier || t.tier === 'All' || t.tier === paper.tier);
  return [
    `${s.title}${s.awardingBody ? ` — ${s.awardingBody}` : ''}.`,
    paper && `${paperLabel(paper)}${paper.tier && paper.tier !== 'All' ? ` (${paper.tier} tier)` : ''}${paper.maxMarks ? `, ${paper.maxMarks} marks` : ''}.`,
    units.length && `Units: ${units.map((t) => `${t.unitNo ?? t.code ?? ''} ${t.title}${t.subtopics ? ` (${t.subtopics})` : ''}`.trim()).join('; ')}`,
  ].filter(Boolean).join('\n').slice(0, 5800);
}

export function ExamModal({ exam, board, onClose, onSaved }: { exam?: Exam; board?: Board; onClose: () => void; onSaved: (e: Exam) => void }) {
  const { lookups } = useLookups();
  const { campusId } = useSchool();
  const label = useClassLabel();
  const boardOf = useBoardOf();
  const classBoard = (c: { board?: string }) => boardOf({ board: c.board, class_name: '' });
  const initialClass = exam ? lookups?.classes.find((c) => label(c) === exam.class_name)?.id ?? '' : '';
  const currentYear = lookups?.academicYears.find((y) => y.isCurrent)?.label ?? '';

  const [f, setF] = useState({
    name: exam?.name ?? '', academic_year: exam?.academic_year ?? currentYear, classId: initialClass, section: exam?.section ?? '',
    subject: exam?.subject ?? '', grade_level: exam?.grade_level ?? '', instructions: exam?.instructions ?? '',
    syllabusId: exam?.syllabus_id ?? '', componentId: exam?.component_id ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // A new class or subject means another syllabus; a new syllabus means another paper.
  const reset: Record<string, Partial<typeof f>> = {
    classId: { section: '', syllabusId: '', componentId: '' }, subject: { syllabusId: '', componentId: '' }, syllabusId: { componentId: '' },
  };
  const set = (k: keyof typeof f) => (v: string) => { setF((x) => ({ ...x, [k]: v, ...(reset[k] ?? {}) })); setErrors((e) => ({ ...e, [k]: '' })); };

  const classes = (lookups?.classes ?? []).filter((c) => c.id === f.classId
    || ((!campusId || c.campusId === campusId) && (!board || classBoard(c) === board)));
  const cls = lookups?.classes.find((c) => c.id === f.classId);
  const examBoard = cls ? classBoard(cls) : exam ? boardOf(exam) : board ?? null;
  const info = examBoard ? boardInfo(examBoard) : null;

  // The board's syllabuses for this subject (those covering the class's year first), and the chosen one's papers and units.
  const subjectId = lookups?.subjects.find((s) => s.name === f.subject)?.id;
  const syllabi = useApiQuery<SyllabusOption[]>(examBoard && subjectId ? '/syllabuses' : null, { board: examBoard ?? undefined, subjectId }, { staleTime: 60_000 });
  const forYear = (syllabi.data ?? []).filter((s) => !cls || !s.gradeLevels?.length || s.gradeLevels.includes(cls.gradeLevel));
  const syllabusOptions = forYear.length ? forYear : syllabi.data ?? [];
  const detail = useApiQuery<SyllabusDetail>(f.syllabusId ? `/syllabuses/${f.syllabusId}` : null, undefined, { staleTime: 60_000 });
  const syl = detail.data?.id === f.syllabusId ? detail.data : undefined;
  const papers = syl?.components ?? syllabusOptions.find((s) => s.id === f.syllabusId)?.components ?? [];
  const paper = papers.find((p) => p.id === f.componentId);
  const noSyllabus = !!subjectId && !!examBoard && syllabi.isSuccess && !syllabusOptions.length;
  const save = useApiMutation<Record<string, string>, Exam>(exam ? 'put' : 'post', exam ? `${EV}/exams/${exam.id}` : `${EV}/exams`, {
    invalidate: ['/exam-correction'], success: exam ? 'Examination updated' : 'Examination created', onSuccess: (r) => { onSaved(r.data); onClose(); }, error: false,
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Enter a name';
    if (f.academic_year.trim().length < 4) e.academic_year = 'Enter the academic year';
    if (!cls && !exam) e.classId = 'Choose a class';
    if (!f.subject) e.subject = 'Choose a subject';
    if (noSyllabus) e.syllabusId = `Add a ${info?.label} syllabus for ${f.subject} first`;
    else if (f.subject && !f.syllabusId) e.syllabusId = 'Choose the syllabus';
    else if (papers.length && !paper) e.componentId = 'Choose the paper';
    if (f.syllabusId && !syl) e.syllabusId = 'The syllabus is still loading — try again in a moment';
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate({
      name: f.name.trim(), academic_year: f.academic_year.trim(), class_name: cls ? label(cls) : exam!.class_name,
      section: f.section, subject: f.subject, grade_level: f.grade_level.trim(), instructions: f.instructions.trim(),
      board: examBoard ?? '',
      syllabus_id: syl?.id ?? '', syllabus_title: syl?.title ?? '', component_id: paper?.id ?? '',
      component_name: paper ? paperLabel(paper) : '', tier: paper?.tier ?? '',
      syllabus_context: syl ? syllabusContext(syl, paper) : '',
    });
  };

  return (
    <Modal open onClose={onClose} title={exam ? 'Edit examination' : 'New examination'} size="wide" busy={save.isPending}
      foot={<><Button onClick={onClose} disabled={save.isPending}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>Save</Button></>}>
      {save.error && <div className="mb-4"><InlineError error={save.error} /></div>}
      <div className="formsection">
        <div className="formsection__title">Examination</div>
        <div className="grid g-2col g-3">
          <TextField label="Name" required value={f.name} onChange={set('name')} error={errors.name} placeholder="Unit Test 1 — Science" maxLength={160} />
          <TextField label="Academic year" required value={f.academic_year} onChange={set('academic_year')} error={errors.academic_year} placeholder="2026-27" maxLength={20} />
        </div>
      </div>
      <div className="formsection">
        <div className="formsection__title">Who sits it</div>
        <div className="grid g-2col g-3">
          <SelectField label="Class" required value={f.classId} onChange={set('classId')} error={errors.classId} placeholder="Choose a class"
            options={classes.map((c) => ({ value: c.id, label: label(c) }))}
            hint={exam && !initialClass ? `Currently ${exam.class_name}`
              : examBoard ? `${boardInfo(examBoard).label}: the AI marks the ${boardInfo(examBoard).short} way; results are graded ${boardInfo(examBoard).range}.`
              : 'Students of this class are listed for upload.'} />
          <SelectField label="Section" value={f.section} onChange={set('section')} placeholder="Whole class" disabled={!cls}
            options={(cls?.sections ?? []).map((s) => ({ value: s.name, label: `Section ${s.name}` }))} />
          <SelectField label="Subject" required value={f.subject} onChange={set('subject')} error={errors.subject} placeholder="Choose a subject"
            options={(lookups?.subjects ?? []).map((s) => s.name)} />
        </div>
      </div>
      <div className="formsection">
        <div className="formsection__title">{info ? `${info.label} syllabus` : 'Syllabus'}</div>
        {noSyllabus && info && (
          <div className="mb-3"><Banner tone="warning" icon="alert">
            There is no {info.label} syllabus for {f.subject} yet. Add it in <Link to={info.routes.syllabus}>{info.menu} Syllabus</Link>, then come back.
          </Banner></div>
        )}
        <div className="grid g-2col g-3">
          <SelectField label="Syllabus" required value={f.syllabusId} onChange={set('syllabusId')} error={errors.syllabusId}
            placeholder={!cls && !exam ? 'Choose the class first' : !f.subject ? 'Choose the subject first' : syllabi.isLoading ? 'Loading…' : 'Choose the syllabus'}
            disabled={!syllabusOptions.length} options={syllabusOptions.map((s) => ({ value: s.id, label: s.syllabusCode ? `${s.title} (${s.syllabusCode})` : s.title }))}
            hint="The AI drafts rubrics and marks within this syllabus." />
          <SelectField label="Paper" required={papers.length > 0} value={f.componentId} onChange={set('componentId')} error={errors.componentId}
            placeholder={papers.length ? 'Choose the paper' : 'No papers in this syllabus'} disabled={!papers.length}
            options={papers.map((p) => ({ value: p.id, label: `${paperLabel(p)}${p.tier && p.tier !== 'All' && !p.name.includes(p.tier) ? ` (${p.tier})` : ''}${p.maxMarks ? ` · ${p.maxMarks} marks` : ''}` }))}
            hint={paper?.tier === 'Core' || paper?.tier === 'Extended' ? `${paper.tier} tier: grades are capped the way ${info?.short ?? 'the board'} caps this tier.` : 'Results are graded on the board\'s scale.'} />
          <TextField label="Grade level / stage" value={f.grade_level} onChange={set('grade_level')} placeholder="Stage 7, Std IX, Class X" maxLength={40}
            hint="Helps the AI pitch the marking. The board comes from the class." />
        </div>
      </div>
      <TextArea label="Instructions for markers" value={f.instructions} onChange={set('instructions')} rows={3}
        placeholder="e.g. Accept British or American spelling. Units are required in numerical answers." />
    </Modal>
  );
}
