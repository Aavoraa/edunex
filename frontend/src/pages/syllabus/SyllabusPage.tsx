import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useApiQuery } from '@/hooks/useApi';
import { useListParams } from '@/hooks/useListParams';
import { useLookups } from '@/hooks/useLookups';
import { Badge, Button, Card, DataTable, ErrorState, FilterSelect, Grid, Kpi, Meter, Page, PageHead, SearchInput, Toolbar } from '@/components/ui';
import { GradeDocs, StageBanner, SyllabusForm, gradesLabel, syllabusBase, type SyllabusBoard, type SyllabusRow } from './shared';
import { CatalogueModal } from './CatalogueModal';
import { boardInfo } from '@/lib/grades';

/**
 * A board's syllabuses: Cambridge IGCSE for Grades 9–10 (topic coverage and Core/Extended
 * entries), or Tamil Nadu Matriculation / CBSE per standard or class (textbook units and unit coverage).
 */
export default function SyllabusPage({ board = 'igcse' }: { board?: SyllabusBoard } = {}) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { lookups } = useLookups();
  const info = boardInfo(board);
  const matric = board !== 'igcse'; // Matriculation or CBSE
  const base = syllabusBase(board);
  const list = useListParams({ sort: 'code' }, ['subjectId', 'active']);
  const q = useApiQuery<SyllabusRow[]>('/syllabuses', { board, q: list.q || undefined, subjectId: list.filters.subjectId || undefined, active: list.filters.active || 'true' });
  const [adding, setAdding] = useState(false);
  const [catalogue, setCatalogue] = useState(false);
  const rows = q.data;

  const k = useMemo(() => {
    const r = rows ?? [];
    const slots = r.reduce((a, x) => a + x.topics * x.sections, 0);
    const covered = r.reduce((a, x) => a + x.covered, 0);
    return {
      count: r.length,
      cambridge: r.filter((x) => x.syllabusCode).length,
      coverage: slots ? Math.round((100 * covered) / slots) : null,
      entries: r.reduce((a, x) => a + x.entries, 0),
      core: r.reduce((a, x) => a + x.coreEntries, 0),
      tiered: r.filter((x) => x.tiered).length,
    };
  }, [rows]);

  return (
    <Page>
      <PageHead
        title={`${info.menu} Syllabus`}
        sub={matric
          ? `${info.label} syllabuses by ${info.level === 'Std' ? 'standard' : 'class'} — ${info.textbook} textbook units, papers, and unit coverage by section.`
          : 'Cambridge IGCSE syllabuses for Grades 9–10 — papers and weightings, topic coverage by section, and students’ Core or Extended entries.'}
        actions={<>
          <Button icon="award" to={info.routes.grading}>{matric ? `${info.menu} grading` : 'Grading scheme'}</Button>
          {!matric && <Button icon="bookOpen" onClick={() => setCatalogue(true)}>Cambridge catalogue</Button>}
          {can('grading.manage') && <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add syllabus</Button>}
        </>}
      />
      <StageBanner board={board} />

      <Grid cols="g-4col" className="mt-4">
        <Kpi loading={!rows} icon="book" label="Syllabuses" value={k.count} foot={matric ? `${new Set((rows ?? []).flatMap((x) => x.gradeLevels)).size} ${info.level === 'Std' ? 'standards' : 'classes'} · ${new Set((rows ?? []).map((x) => x.subjectId)).size} subjects` : `${k.cambridge} Cambridge IGCSE · ${k.tiered} tiered`} />
        <Kpi loading={!rows} icon="checkSquare" label={matric ? 'Unit coverage' : 'Topic coverage'} value={k.coverage == null ? '—' : `${k.coverage}%`} tone="teal" foot={matric ? `Units covered across ${info.short} sections` : 'Topics covered across Grade 9–10 sections'} />
        {matric ? (
          <>
            <Kpi loading={!rows} icon="list" label="Textbook units" value={(rows ?? []).reduce((a, x) => a + x.topics, 0)} tone="info" foot={`Across all ${info.level === 'Std' ? 'standards' : 'classes'}`} />
            <Kpi loading={!rows} icon="file" label="Papers" value={(rows ?? []).reduce((a, x) => a + x.componentCount, 0)} tone="amber" foot={`Graded ${info.range}`} />
          </>
        ) : (
          <>
            <Kpi loading={!rows} icon="users" label="Syllabus entries" value={k.entries} tone="info" foot="Student × syllabus entries" />
            <Kpi loading={!rows} icon="target" label="Core tier entries" value={k.core} tone="amber" foot="Graded C–G (capped at C)" />
          </>
        )}
      </Grid>

      <div className="mt-4">
        <Card icon="graduation" title="Syllabuses" flush>
          <Toolbar>
            <SearchInput value={list.q} onSearch={list.setQ} placeholder="Search by code, title or subject" />
            <FilterSelect label="Subject" value={list.filters.subjectId} onChange={(v) => list.setFilter('subjectId', v)} options={(lookups?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))} />
            <FilterSelect label="Status" allLabel={null} value={list.filters.active || 'true'} onChange={(v) => list.setFilter('active', v === 'true' ? '' : v)}
              options={[{ value: 'true', label: 'Active syllabuses' }, { value: 'false', label: 'Inactive' }, { value: 'all', label: 'All syllabuses' }]} />
          </Toolbar>
          {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
            <DataTable
              rows={rows}
              loading={q.isLoading}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`${base}/${r.id}`)}
              emptyText={list.hasFilters ? 'No syllabuses match these filters.' : 'No syllabuses yet.'}
              columns={[
                ...(matric ? [] : [{ key: 'code', label: 'Code', sortable: false, render: (r: SyllabusRow) => r.syllabusCode ? <span className="t-bold t-num">{r.syllabusCode}</span> : <Badge tone="neutral">School</Badge> }]),
                {
                  key: 'title', label: 'Syllabus', sortable: false, render: (r) => (
                    <>
                      <span className="t-bold">{r.title}</span>
                      <div className="t-micro t-muted">{r.subject} · {gradesLabel(r.gradeLevels, board)}{r.isActive ? '' : ' · inactive'}</div>
                    </>
                  ),
                },
                ...(matric ? [
                  { key: 'board', label: 'Awarding body', sortable: false, render: (r: SyllabusRow) => <span className="t-sm">{r.awardingBody}</span> },
                  { key: 'grading', label: 'Grading', sortable: false, render: () => <span className="t-sm t-muted">{info.range} (pass from D)</span> },
                ] : [
                  {
                    key: 'docs', label: 'Cambridge syllabus by grade', sortable: false, render: (r: SyllabusRow) => r.cambridge
                      // Links open in a new tab; keep the click off the row.
                      ? <div onClick={(e) => e.stopPropagation()}><GradeDocs compact byGrade={r.cambridge.byGrade} subjectPage={r.cambridge.subjectPage} /></div>
                      : <span className="t-micro t-muted">School-assessed</span>,
                  },
                  { key: 'tiered', label: 'Tiers', sortable: false, render: (r: SyllabusRow) => r.tiered ? <Badge tone="info">Core / Extended</Badge> : <span className="t-sm t-muted">Untiered (A*–G)</span> },
                ]),
                { key: 'papers', label: 'Papers', className: 'num', sortable: false, render: (r) => <span className="t-num">{r.componentCount}</span> },
                {
                  key: 'coverage', label: matric ? 'Unit coverage' : 'Topic coverage (Grade 9–10)', sortable: false, render: (r) => r.coveragePct == null
                    ? <span className="t-faint">—</span>
                    : <Meter label="" value={r.coveragePct} right={`${r.coveragePct}%`} tone={r.coveragePct >= 60 ? 'teal' : r.coveragePct >= 30 ? 'amber' : 'critical'}
                        hint={`${r.topics} topics × ${r.sections} sections${r.inProgress ? ` · ${r.inProgress} in progress` : ''}`} />,
                },
                ...(matric ? [] : [{
                  key: 'entries', label: 'Entries', sortable: false, className: 'num', render: (r: SyllabusRow) => (
                    <><span className="t-num">{r.entries}</span>{r.tiered && r.entries > 0 && <div className="t-micro t-muted">{r.coreEntries} Core · {r.entries - r.coreEntries} Extended</div>}</>
                  ),
                }]),
                { key: 'a', label: '', sortable: false, className: 'num', render: (r) => <Button size="sm" variant="ghost" iconRight="chevronRight" to={`${base}/${r.id}`}>Open</Button> },
              ]}
            />
          )}
        </Card>
      </div>
      {adding && <SyllabusForm board={board} onClose={() => setAdding(false)} onSaved={(id) => navigate(`${base}/${id}`)} />}
      {catalogue && <CatalogueModal onClose={() => setCatalogue(false)} />}
    </Page>
  );
}
